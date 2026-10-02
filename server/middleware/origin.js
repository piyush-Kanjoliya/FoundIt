import {config} from '../config.js'

export function checkOrigin(req, res, next) {
  // Safe HTTP methods do not require origin checks
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  const originHeader = req.headers.origin
  if (!originHeader) {
    return res.status(403).json({
      error:
        'Request origin is not allowed. Open the app on localhost; for deployment, ' +
        'set APP_ORIGIN to the exact website address and restart the backend.'
    })
  }

  // Exact match with configured origin
  if (originHeader === config.origin) {
    return next()
  }

  // In development and test, allow loopback addresses on any port
  if (!config.isProduction) {
    try {
      const url = new URL(originHeader)
      const isLoopback =
        ['http:', 'https:'].includes(url.protocol) &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
        url.origin === originHeader
      const isPrivateLan =
        ['http:', 'https:'].includes(url.protocol) &&
        /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)
      if (isLoopback || isPrivateLan) {
        return next()
      }
    } catch {}
  }

  return res.status(403).json({
    error:
      'Request origin is not allowed. Open the app on localhost; for deployment, ' +
      'set APP_ORIGIN to the exact website address and restart the backend.'
  })
}
