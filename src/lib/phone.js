// Phone numbers arrive in every shape a person might type: 07547 585758,
// +44 7547 585758, 0044 7547-585758, (07547) 585758. Stripping punctuation
// isn't enough — wa.me needs a country code, so a plain 07… number opens
// nothing at all.

const DEFAULT_COUNTRY = '44'

/** Digits only, with a country code. Null when it can't be made sense of. */
export function phoneDigits(raw, defaultCountry = DEFAULT_COUNTRY) {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)                       // 0044… → 44…
  else if (d.startsWith('0')) d = defaultCountry + d.slice(1)  // 07…   → 447…
  return d.length >= 10 ? d : null
}

/**
 * Canonical storage form: +447547585758. Unambiguous, works in tel: and
 * wa.me links, and doesn't depend on the reader knowing which country it's in.
 * Returns the input untouched if it can't be parsed — better to keep what
 * someone typed than to throw it away.
 */
export function toE164(raw, defaultCountry = DEFAULT_COUNTRY) {
  const d = phoneDigits(raw, defaultCountry)
  return d ? `+${d}` : (raw || '')
}

/** wa.me link, optionally with the message pre-filled. Null if unusable. */
export function waLink(phone, message) {
  const d = phoneDigits(phone)
  if (!d) return null
  return message ? `https://wa.me/${d}?text=${encodeURIComponent(message)}` : `https://wa.me/${d}`
}
