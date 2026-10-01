const patterns = [
  /(?:\+?91[\s-]?)?(?:\b\d[\s.-]*){10,}\b/,
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
  /\b\d{2}[A-Z]{3}\d{4,5}\b/i,
  /(?:@\w{4,}|wa\.me\/|t\.me\/|whatsapp)/i,
  /\bat\b.+\bdot\b/i,
];

export function piiWarning(text) {
  if (!text) return '';
  return patterns.some(p => p.test(text))
    ? 'This looks like personal contact information. The server will reject it.'
    : '';
}
