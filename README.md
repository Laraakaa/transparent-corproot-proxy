# Transparent Corporate Network Proxy
In corporates, developers often face the problem of a proxy.

## Daily story:
You enter the corporate network.
Git: Broke. (Cannot connect)
Docker: Broke. (Cannot connect)
Sometimes, even the webbrowser: Broke. (Cannot connect)

Okay, nevermind. I'll just set up the proxy in all those applications.

Then you leave the corporate network.
Git: Broke. (Cannot find proxy)
Docker: Broke. (Cannot find proxy)
Sometimes, even the webbrowser: Broke. (Cannot connect to proxy)

This is because the corporate proxy is not accessible from outside the corporate network.

Means you have to remove all proxy settings again. Repeat that task as long
as you want. Or switch now to transparent-corproot-proxy.

## Setup & Installation
Install the application in a folder of your choice:
- `git pull https://github.com/LarsBaertschi/transparent-corproot-proxy`
- `yarn` or `npm install`
- Copy config.dist.js to config.js and adapt the contents to your needs.
  Please note: {} is a direct connection. You can also only supply http_proxy OR
  https_proxy, in this case the type not supplied will use direct connection.
- `yarn start` or `npm start`
