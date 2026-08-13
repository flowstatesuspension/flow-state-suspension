// How far ahead customers can book a drop-off.
// Must stay in step with the horizon in the booking_requests insert policy —
// if this is larger, the form will offer days the database then refuses.
export const BOOKING_HORIZON_DAYS = 120

/**
 * A number wa.me can actually route to: full international, digits only.
 * Numbers get stored as 07547 585758 or +44 7547 585758 or 0044…, and only the
 * last of those is close to what wa.me wants. Returns null if it can't tell.
 */
export function waPhone(raw, defaultCountry = '44') {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)                  // 0044… → 44…
  else if (d.startsWith('0')) d = defaultCountry + d.slice(1) // 07…  → 447…
  return d.length >= 10 ? d : null
}

/** Pre-filled confirmation. You read it and hit send — nothing goes automatically. */
export function confirmationMessage({ name, dateLabel, items = [] }) {
  const first = String(name || '').trim().split(' ')[0] || 'there'
  const list = items
    .map(i => [i.brand, i.model].filter(Boolean).join(' ').trim())
    .filter(Boolean)
  return [
    `Hi ${first}, you're booked in for ${dateLabel}.`,
    list.length ? `Bringing: ${list.join(', ')}.` : null,
    'Give me a shout if anything changes.',
  ].filter(Boolean).join('\n\n')
}

export function waLink(phone, message) {
  const num = waPhone(phone)
  return num ? `https://wa.me/${num}?text=${encodeURIComponent(message)}` : null
}
