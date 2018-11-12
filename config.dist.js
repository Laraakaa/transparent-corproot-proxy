module.exports = {
  proxies: [
    {},
    {
      http_proxy: 'proxy.company.com:8080',
      https_proxy: 'proxy.company.com:8080'
    }
  ],
  http_check: 'google.ch',
  https_check: 'google.ch',
  check_timeout: 5000,
  check_interval: 10000
}
