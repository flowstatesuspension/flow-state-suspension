// Finding the customer behind a booking request.
//
// Every match is currently presented for a human decision — nothing attaches
// automatically. The confidence levels exist so that once the ranking has
// proved itself, switching 'strong' matches to automatic is a small change in
// AutoBookScreen rather than a rewrite.

// UK numbers get written every which way: +44 7547 585758, 07547585758,
// 44 7547-585758. Compare the last 9 digits and they all line up.
export function phoneKey(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length < 7) return null
  return digits.slice(-9)
}

export function emailKey(raw) {
  const e = String(raw || '').trim().toLowerCase()
  return e.includes('@') ? e : null
}

function nameKey(raw) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// Do two names plausibly refer to the same person? Catches "Gav" vs
// "Gav Storie" and word-order swaps, without matching every John.
function nameOverlap(a, b) {
  const A = nameKey(a), B = nameKey(b)
  if (!A || !B) return 0
  if (A === B) return 1
  const aw = A.split(' ').filter(Boolean)
  const bw = B.split(' ').filter(Boolean)
  if (!aw.length || !bw.length) return 0
  const shared = aw.filter(w => bw.includes(w)).length
  if (!shared) return 0
  // One name being a subset of the other is a decent signal
  return shared / Math.max(aw.length, bw.length)
}

/**
 * Rank existing customers against a booking request.
 *
 * Returns [{ customer, score, confidence, reasons[] }], best first.
 *   strong   — phone or email matched exactly
 *   possible — the name lines up but no contact detail does
 *   weak     — a partial name overlap only
 *
 * A 'conflict' flag is set when phone and email point at different people,
 * which always needs a human.
 */
export function rankCustomerMatches(request, customers = []) {
  const rPhone = phoneKey(request?.phone)
  const rEmail = emailKey(request?.email)

  const scored = customers.map(c => {
    const reasons = []
    let score = 0

    if (rPhone && phoneKey(c.phone) === rPhone) { score += 100; reasons.push('Phone matches') }
    if (rEmail && emailKey(c.email) === rEmail) { score += 90;  reasons.push('Email matches') }

    const overlap = nameOverlap(request?.name, c.name)
    if (overlap === 1) { score += 40; reasons.push('Name matches exactly') }
    else if (overlap >= 0.5) { score += 20; reasons.push('Name partly matches') }

    return { customer: c, score, reasons }
  }).filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score || a.customer.name.localeCompare(b.customer.name))

  const withConfidence = scored.map(m => ({
    ...m,
    confidence: m.score >= 90 ? 'strong' : m.score >= 40 ? 'possible' : 'weak',
  }))

  // Phone says one person, email says another — never guess between them
  const phoneHit = withConfidence.find(m => m.reasons.includes('Phone matches'))
  const emailHit = withConfidence.find(m => m.reasons.includes('Email matches'))
  const conflict = !!(phoneHit && emailHit && phoneHit.customer.id !== emailHit.customer.id)

  return { matches: withConfidence, conflict }
}

// What the queue should suggest, given the ranking above.
// 'new' — nothing matched, offer to create a customer
// 'attach' — one clear match to confirm
// 'choose' — several candidates, or a phone/email conflict
export function suggestAction({ matches, conflict }) {
  if (conflict) return 'choose'
  if (!matches.length) return 'new'
  const strong = matches.filter(m => m.confidence === 'strong')
  if (strong.length === 1) return 'attach'
  if (strong.length > 1) return 'choose'
  return matches.length === 1 ? 'attach' : 'choose'
}
