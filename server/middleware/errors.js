import {z} from 'zod'

export function errorHandler(err, req, res, _next) {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' · ')
    })
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({error: 'Photos must be 5 MB or smaller.'})
  }

  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({error: 'Attach one photo at a time.'})
  }

  if (
    ['LIMIT_FIELD_COUNT', 'LIMIT_FIELD_KEY', 'LIMIT_FIELD_VALUE', 'LIMIT_PART_COUNT'].includes(
      err.code
    ) ||
    err.type === 'entity.too.large'
  ) {
    return res.status(413).json({error: 'The upload form is too large.'})
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({error: 'Request must contain valid JSON.'})
  }

  const status = err.status || 500
  if (status >= 500 && process.env.NODE_ENV !== 'test') {
    console.error(err)
  }

  res.status(status).json({
    error: err.status ? err.message : 'Something went wrong. Please try again.'
  })
}
