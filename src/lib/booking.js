import { WORKSHOP_ADDRESS, WORKSHOP_DIRECTIONS } from '../constants'

// How far ahead customers can book a drop-off.
// Must stay in step with the horizon in the booking_requests insert policy —
// if this is larger, the form will offer days the database then refuses.
export const BOOKING_HORIZON_DAYS = 120

/**
 * Pre-filled confirmation. You read it and hit send — nothing goes
 * automatically. Postal jobs carry the workshop address, so the customer
 * gets it somewhere they can find again rather than only on the page they
 * saw once after booking.
 */
export function confirmationMessage({ name, dateLabel, items = [], posting = false }) {
  const first = String(name || '').trim().split(' ')[0] || 'there'
  const list = items
    .map(i => [i.brand, i.model].filter(Boolean).join(' ').trim())
    .filter(Boolean)

  return [
    posting
      ? `Hi ${first}, you're all set — send it over to land with me by ${dateLabel}.`
      : `Hi ${first}, you're booked in for ${dateLabel}.`,
    list.length ? `${posting ? 'Sending' : 'Bringing'}: ${list.join(', ')}.` : null,
    `${posting ? 'Send it to' : 'Drop it off at'}:\n${WORKSHOP_ADDRESS.join('\n')}`,
    posting
      ? 'Pop your name in the box, and send me the tracking number once it\'s gone.'
      : `${WORKSHOP_DIRECTIONS}`,
    'Thanks\nKeith',
  ].filter(Boolean).join('\n\n')
}

