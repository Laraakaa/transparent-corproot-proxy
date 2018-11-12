const fs = require('fs');
const net = require('net');
const http = require('http');
const https = require('https');
const request = require('request');
const httpProxy = require('http-proxy');

const config = require('./config');

debugLog = false;

const proxy = httpProxy.createProxyServer({
  xfwd: true,
  toProxy: true,
  prependPath: false
});

let currentStatus = {
  // No proxy
}

// The first proxy that allows a connection to both proxies (http & https) is used.
// If one or both proxies are missing, direct connection is used. That will be
// checked using http(s)_check
const updateCurrentStatus = () => {
  let i = 0;
  let proxy = config.proxies[0];

  const callback = hasConnectivity => {
    if (debugLog) console.log("Proxy check complete: " + JSON.stringify(proxy) + ", status = " + hasConnectivity);

    if (hasConnectivity) {
      if (!(
        currentStatus['http_proxy'] === proxy['http_proxy'] &&
        currentStatus['https_proxy'] == proxy['https_proxy']
      )) {
        // Proxy change
        console.log("Now using: " + JSON.stringify(proxy));
        currentStatus = proxy;
      }
      return setTimeout(updateCurrentStatus, config.check_interval);
    }

    i++;

    // is there a next one?
    if (config.proxies.length === i) {
      console.log('No proxy is matching. Please add one proxy that matches your current environment. Use {} for direct connection.');
      // Defaulting to direct connection
      currentStatus = {};
      return setTimeout(updateCurrentStatus, config.check_interval);
    } else {
      proxy = config.proxies[i];
      checkProxyConnectivity(proxy, callback)
    }
  }

  checkProxyConnectivity(proxy, callback);
}

const checkProxyConnectivity = (proxy, callback) => {
  let httpCheck = config.http_check;
  let httpsCheck = config.https_check;

  if (proxy['http_proxy']) {
    httpCheck = proxy['http_proxy'];
  }
  if (proxy['https_proxy']) {
    httpsCheck = proxy['https_proxy'];
  }

  const parsedHttp = getHostPortFromString(httpCheck, 80);
  const parsedHttps = getHostPortFromString(httpsCheck, 443);

  if (debugLog) console.log("Checking connection to " + parsedHttp[0] + ":" + parsedHttp[1]);
  checkConnection(parsedHttp[0], parsedHttp[1], hasHTTPConnectivity => {
    if (!hasHTTPConnectivity) {
      if (debugLog) console.log(parsedHttp[0] + ":" + parsedHttp[1] + " - FAILED");
      callback(false);
    } else {
      if (debugLog) console.log(parsedHttp[0] + ":" + parsedHttp[1] + " - SUCCEEDED");
      if (debugLog) console.log("Checking connection to " + parsedHttps[0] + ":" + parsedHttps[1]);
      checkConnection(parsedHttps[0], parsedHttps[1], hasHTTPSConnectivity => {
        if (!hasHTTPSConnectivity) {
          if (debugLog) console.log(parsedHttps[0] + ":" + parsedHttps[1] + " - FAILED");
          callback(false);
        } else {
          if (debugLog) console.log(parsedHttps[0] + ":" + parsedHttps[1] + " - SUCCEEDED");
          callback(true);
        }
      });
    }
  });
}

const checkConnection = (host, port, callback) => {
  const timer = setTimeout(() => {
    callback(false);
    socket.end();
  }, config.check_timeout);
  var socket = net.createConnection(port, host, () => {
    clearTimeout(timer);
    callback(true);
    socket.end();
  });
  socket.on('error', err => {
    clearTimeout(timer);
    //console.log(err);
    callback(false);
  })
}

const getHostPortFromString = (hostString, defaultPort) => {
  let host = hostString;
  let port = defaultPort;

  var result = /^([^:]+)(:([0-9]+))?$/.exec(hostString);
  if (result != null) {
    host = result[1];
    if (result[2] != null) {
      port = result[3];
    }
  }

  return ( [host, port] );
};

setTimeout(updateCurrentStatus, 500);

//proxy.on('proxyReq', (proxyReq, req, res, options) => {
  // console.log(proxyReq.path);
  //console.log(proxyReq.headers);
// });

const httpServer = http.createServer(function(req, res) {
  let target = req.url;

  if (currentStatus['http_proxy']) {
    target = currentStatus['http_proxy'];
  }

  if (!target.startsWith('http://')) {
    target = 'http://' + target;
  }

  proxy.web(req, res, { target }, err => {
    if (debugLog) console.log(err);
    res.write("Proxy: " + err);
    res.end();
  });

  if (debugLog) console.log('HTTP: ' + req.url);
});

httpServer.addListener('connect', (req, socket, bodyHead) => {
  let target = req.url;
  let isUsingProxy = false;

  if (currentStatus['https_proxy']) {
    target = currentStatus['https_proxy'];
    isUsingProxy = true;
  }

  //console.log(req);

  const parsed = getHostPortFromString(target, 443);
  const hostDomain = parsed[0];
  const hostPort = parseInt(parsed[1]);
  if (debugLog) console.log('HTTPS: ' + hostDomain + ":" + hostPort);
  //console.log(bodyHead);

  var proxySocket = new net.Socket();
  proxySocket.connect(hostPort, hostDomain, () => {
    if (isUsingProxy) {
      let connectionString = 'CONNECT ' + req.url + " HTTP/" + req.httpVersion + '\r\n';

      for(let key in req.headers) {
        if (req.headers.hasOwnProperty(key)) {
          connectionString += key + ': ' + req.headers[key] + '\r\n'
        }
      }

      connectionString += '\r\n';

      proxySocket.write(connectionString);
    } else {
      proxySocket.write(bodyHead);
      socket.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
    }
  });

  proxySocket.on('data', function (chunk) {
    socket.write(chunk);
  });

  proxySocket.on('end', function () {
    socket.end();
  });

  proxySocket.on('error', function () {
    socket.write("HTTP/" + req.httpVersion + " 500 Connection error\r\n\r\n");
    socket.end();
  });

  socket.on('data', function (chunk) {
    proxySocket.write(chunk);
  });

  socket.on('end', function () {
    proxySocket.end();
  });

  socket.on('error', function () {
    proxySocket.end();
  });
});

console.log("HTTP listening on 5050");
httpServer.listen(5050);
