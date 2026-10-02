import multer from 'multer'
import sharp from 'sharp'
import {randomUUID} from 'node:crypto'
import {resolve} from 'node:path'
import {existsSync, mkdirSync, writeFileSync, unlinkSync} from 'node:fs'
import {config} from '../config.js'

const uploadDir = resolve(config.UPLOADS_DIR)
mkdirSync(uploadDir, {recursive: true})

const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
    fields: 16,
    fieldSize: 16 * 1024,
    parts: 18
  },
  fileFilter(_req, file, callback) {
    if (!acceptedImageTypes.has(file.mimetype)) {
      const error = new Error('Choose a JPEG, PNG, or WebP image.')
      error.status = 415
      return callback(error)
    }
    callback(null, true)
  }
})

function detectImageFormat(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return 'png'
  }
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return 'jpg'
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }
  const error = new Error('That file is not a valid JPEG, PNG, or WebP image.')
  error.status = 415
  throw error
}

export async function storePhoto(file) {
  if (!file) return null

  const ext = detectImageFormat(file.buffer)
  const expected = {jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp'}[ext]
  if (file.mimetype !== expected) {
    const error = new Error('The selected file does not match its image format.')
    error.status = 415
    throw error
  }

  let safeBuffer
  try {
    // Sharp strips EXIF metadata and re-encodes as optimized WebP
    safeBuffer = await sharp(file.buffer, {limitInputPixels: 40_000_000})
      .rotate()
      .resize({width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true})
      .webp({quality: 84})
      .toBuffer()
  } catch {
    const error = new Error(
      'This image could not be decoded. Choose a valid JPEG, PNG, or WebP photo.'
    )
    error.status = 415
    throw error
  }

  const key = `${randomUUID()}.webp`
  writeFileSync(resolve(uploadDir, key), safeBuffer, {flag: 'wx'})
  return key
}

export function discardPhoto(key) {
  if (key) {
    try {
      unlinkSync(resolve(uploadDir, key))
    } catch {}
  }
}

export function servePhoto(res, key, next, isPrivate = false) {
  if (
    typeof key !== 'string' ||
    !/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/i.test(key)
  ) {
    const error = new Error('Photo not found.')
    error.status = 404
    throw error
  }

  const photoPath = resolve(uploadDir, key)
  if (!existsSync(photoPath)) {
    const error = new Error('Photo not found.')
    error.status = 404
    throw error
  }

  res.set('Cache-Control', isPrivate ? 'private, no-store' : 'public, max-age=3600')
  res.type('image/webp')
  res.sendFile(photoPath, error => {
    if (error) next(error)
  })
}
