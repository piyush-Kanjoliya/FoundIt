/**
 * Privacy hardening and PII screening for public listings and private handoff messages.
 */

// Digits spelled out as words
const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const DIGIT_WORD_PATTERN = new RegExp(
  `\\b(?:${DIGIT_WORDS.join('|')})(?:[\\s,-]+(?:${DIGIT_WORDS.join('|')})){5,}\\b`,
  'i'
)

// Obfuscated email addresses e.g. "name at domain dot com" or "[at]" or "(at)"
const OBFUSCATED_EMAIL_PATTERN = new RegExp(
  '(?:[\\w.-]+\\s*(?:\\[at\\]|\\(at\\))\\s*[\\w.-]+\\s*' +
    '(?:\\.|\\bdot\\b|\\[dot\\]|\\(dot\\))\\s*[a-z]{2,}' +
    '|[\\w.-]+\\s*\\bat\\b\\s*[\\w.-]+\\s*' +
    '(?:\\bdot\\b|\\[dot\\]|\\(dot\\))\\s*[a-z]{2,})',
  'i'
)

// Spaced or punctuated phone numbers (e.g. 9 8 7 6 5 4 3 2 1 0, +91-98765-43210)
const PHONE_PATTERN = /(?:\+?91[\s-]?)?(?:\b\d[\s.-]*){10,}\b/

// Standard email addresses
const STANDARD_EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i

// VIT Registration number (e.g. 24BIT9001)
const REGISTRATION_PATTERN = /\b\d{2}[A-Z]{3}\d{4,5}\b/i

// Social messaging handles / URLs
const SOCIAL_HANDLE_PATTERN = /(?:@\w{4,}|wa\.me\/|t\.me\/|instagram\.com\/|whatsapp:)/i

/**
 * Validates that string does not contain phone numbers, emails, registration numbers,
 * or messaging handles. Throws a 400 error if PII is detected.
 */
export function assertNoPII(text) {
  if (!text || typeof text !== 'string') return

  if (
    REGISTRATION_PATTERN.test(text) ||
    STANDARD_EMAIL_PATTERN.test(text) ||
    OBFUSCATED_EMAIL_PATTERN.test(text) ||
    PHONE_PATTERN.test(text) ||
    DIGIT_WORD_PATTERN.test(text) ||
    SOCIAL_HANDLE_PATTERN.test(text)
  ) {
    const error = new Error(
      'Remove registration numbers, emails, phone numbers, or social handles from public text.'
    )
    error.status = 400
    throw error
  }
}

/**
 * Legacy alias for backwards compatibility.
 */
export const publicPrivacy = assertNoPII

/**
 * Escapes special SQLite LIKE wildcards (% and _ and \).
 */
export function escapeLike(str) {
  if (!str || typeof str !== 'string') return ''
  return str.replace(/[%_\\]/g, '\\$&')
}

/**
 * Normalizes text for comparison (lowercase, trimmed, stripped of punctuation).
 */
export function normalizeText(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * G-8 Expected Answer comparison hint (guidance only, computed safely for finders).
 * Returns 'Looks similar' | "Doesn't match" | null
 */
export function calculateMatchHint(givenAnswer, expectedAnswer) {
  if (!givenAnswer || !expectedAnswer) return null
  const normGiven = normalizeText(givenAnswer)
  const normExpected = normalizeText(expectedAnswer)

  if (!normGiven || !normExpected) return null

  // Direct match or substring inclusion
  if (normGiven.includes(normExpected) || normExpected.includes(normGiven)) {
    return 'Looks similar'
  }

  // Word token overlap (Jaccard similarity)
  const givenWords = new Set(normGiven.split(' ').filter(w => w.length > 2))
  const expectedWords = new Set(normExpected.split(' ').filter(w => w.length > 2))

  if (givenWords.size === 0 || expectedWords.size === 0) {
    return "Doesn't match"
  }

  let intersection = 0
  for (const word of givenWords) {
    if (expectedWords.has(word)) intersection++
  }

  const union = new Set([...givenWords, ...expectedWords]).size
  const similarity = intersection / union

  return similarity >= 0.25 || intersection >= 2 ? 'Looks similar' : "Doesn't match"
}
