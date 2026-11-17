// ═══════════════════════════════════════════════════════════════════════════
// Visit counting for the two public pages, /book and /intervals.
//
// What this deliberately does NOT do: no cookies, no localStorage, no
// sessionStorage, no IP address, no user agent, no fingerprint, nothing a
// visitor typed, and nothing that follows anyone between visits or between
// the two pages.
//
// Nothing is written to the visitor's device at all. That is the point: PECR
// and the ICO's guidance treat analytics storage on someone's device as
// needing consent, cookie or not, and the cheapest way past that argument is
// to store nothing there. The id below is a random string held in memory for
// the life of this page load, and its only job is to let several events from
// one visit count as one visit rather than six.
//
// The trade: a reload, or walking from the estimator to the booking page,
// starts a new id. So a "visit" here means one page load, and the same person
// on two days counts twice. For a rough read on traffic and what people do,
// that is the right side of the trade.
//
// See supabase-analytics.sql for the table — anonymous visitors can insert
// and nothing else, so the page can never read back what anyone else did.
// ═══════════════════════════════════════════════════════════════════════════

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    // Not a secure context, or an older browser
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

const VISIT = newId()

/**
 * Record one thing that happened.
 *
 * Posted straight to PostgREST rather than through the supabase client so it
 * can carry keepalive: the "Book a service" button navigates away the instant
 * it is tapped, and without keepalive the browser cancels the request as the
 * page unloads — losing exactly the click that matters most.
 *
 * Fire and forget, and silent on failure. Counting visits must never be able
 * to break a booking.
 */
export function track(app, event, detail = null) {
  if (!URL_BASE || !ANON) return
  try {
    fetch(`${URL_BASE}/rest/v1/page_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ app, event, detail, session_id: VISIT }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* never let this surface */
  }
}

const sent = new Set()

/**
 * Record it at most once per page load.
 *
 * For the funnel steps — a view, or reaching the end — where the question is
 * "did this visit get here", not "how many times". Also stops React's
 * StrictMode double-mount counting every view twice in development.
 */
export function trackOnce(app, event, detail = null) {
  const key = `${app}:${event}`
  if (sent.has(key)) return
  sent.add(key)
  track(app, event, detail)
}
