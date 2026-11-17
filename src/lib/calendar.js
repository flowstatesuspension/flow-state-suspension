// ═══════════════════════════════════════════════════════════════════════════
// Calendar export for the service interval estimator.
//
// Builds an .ics the visitor saves to their own calendar. Nothing is stored
// and nobody is asked for an email, so this works for someone who never comes
// back to the site — which is most of them.
//
// RFC 5545 is fussier than it looks: CRLF line endings, 75-octet folding, and
// escaping for commas, semicolons and backslashes. Calendar apps fail quietly
// on malformed files, so the mechanics below are deliberate.
// ═══════════════════════════════════════════════════════════════════════════

/** Reminder lead time before the due date. */
const ALARM_DAYS = 7

/** RFC 5545 text escaping. Order matters — backslash first. */
function esc(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Fold to 75 octets, continuation lines starting with a space.
 * Measured in bytes, not characters — the em dashes and £ signs in our
 * summaries are multi-byte, and splitting mid-character corrupts the file.
 */
function fold(line) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line

  const out = []
  let chunk = ''
  let used = 0
  const limit = () => (out.length === 0 ? 75 : 74) // continuations lose one to the leading space

  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length
    if (used + size > limit()) {
      out.push(chunk)
      chunk = ''
      used = 0
    }
    chunk += ch
    used += size
  }
  if (chunk) out.push(chunk)
  return out.join('\r\n ')
}

const pad = n => String(n).padStart(2, '0')

/** YYYYMMDD, in local time — these are all-day events, not moments. */
function dateValue(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

/** YYYYMMDDTHHMMSSZ */
function utcStamp(d) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function addDays(d, n) {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/**
 * One all-day event per service.
 *
 * Anything already due — overdue, or with no service history to count from —
 * lands on today rather than in the past, where it would import as an event
 * nobody ever sees.
 */
export function buildIcs({ unitLabel, brand, services, bookingUrl, now = new Date() }) {
  const stamp = utcStamp(now)
  const slug = `${brand}-${unitLabel}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Flow State Suspension//Service Interval Estimator//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const s of services) {
    const dueNow = s.unknown || s.overdue
    const start = dueNow ? now : s.date
    if (!start) continue

    const label = `${brand} ${unitLabel.toLowerCase()} — ${s.label.toLowerCase()}`
    const summary = dueNow ? `${label} (due now)` : `${label} due`

    const notes = [
      s.blurb,
      s.unknown
        ? 'No record of a previous one, so this is worth doing before anything else.'
        : s.overdue
          ? 'This was already due when the estimate was made.'
          : `Roughly every ${s.effectiveHours} riding hours in Scottish conditions (${s.hours} hours published).`,
      'Estimated by Flow State Suspension. An estimate to plan around, not a diagnosis — if it feels harsh, sounds dry or is leaking, bring it in sooner.',
      bookingUrl ? `Book: ${bookingUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n\n')

    lines.push(
      'BEGIN:VEVENT',
      // Deterministic, so re-importing after changing an answer updates the
      // existing entry rather than stacking duplicates in their calendar.
      `UID:fss-${slug}-${s.key}@flowstatesuspension.co.uk`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateValue(start)}`,
      `DTEND;VALUE=DATE:${dateValue(addDays(start, 1))}`,
      'SEQUENCE:0',
      'TRANSP:TRANSPARENT',
      fold(`SUMMARY:${esc(summary)}`),
      fold(`DESCRIPTION:${esc(notes)}`),
      ...(bookingUrl ? [fold(`URL:${esc(bookingUrl)}`)] : []),
      'BEGIN:VALARM',
      // A "7 days before" alarm on something already due would sit in the
      // past and never fire. Those get a morning-of trigger instead.
      dueNow ? 'TRIGGER;RELATED=START:PT9H' : `TRIGGER:-P${ALARM_DAYS}D`,
      'ACTION:DISPLAY',
      fold(`DESCRIPTION:${esc(summary)}`),
      'END:VALARM',
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/** Hand the file to the browser. */
export function downloadIcs(filename, content) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked late: Safari can still be reading the blob when the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
