// How far ahead customers can book a drop-off.
// Must stay in step with the horizon in the booking_requests insert policy —
// if this is larger, the form will offer days the database then refuses.
export const BOOKING_HORIZON_DAYS = 120

/** Pre-filled confirmation. You read it and hit send — nothing goes automatically. */
export function confirmationMessage({ name, dateLabel, items = [] }) {
  const first = String(name || '').trim().split(' ')[0] || 'there'
  const list = items
    .map(i => [i.brand, i.model].filter(Boolean).join(' ').trim())
    .filter(Boolean)
  return [
    `Hi ${first}, you're booked in for ${dateLabel}.`,
    list.length ? `Bringing: ${list.join(', ')}.` : null,
    'Just let me know your ETA nearer the time.',
    'Thanks\nKeith',
  ].filter(Boolean).join('\n\n')
}

