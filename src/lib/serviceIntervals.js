// ═══════════════════════════════════════════════════════════════════════════
// Service interval model — Edinburgh / Central Scotland
//
// Everything Keith might want to argue with lives in this file, at the top.
// The screen only renders what comes out of estimate().
//
// ── WHERE THESE NUMBERS COME FROM ──────────────────────────────────────────
// Every figure below is the manufacturer's own published interval, not a
// workshop rule of thumb. Sources:
//
//   Fox   service.ridefox.com/pages/bike — "your fork, shock or seat post
//         receive a Full Factory Service every 125hrs or yearly - whichever
//         comes first", and come in sooner for lift-accessed DH/Park or
//         "extremely wet/muddy" conditions.
//   Fox   tech.ridefox.com owner's manual, 2027 36mm, "Recommended Minimum
//         Fork Maintenance": ONE interval — every 125 hours/yearly, full fork
//         service, and it explicitly includes "bath oil and wiper
//         replacement". Fox folds the lower-leg work into the full service
//         and publishes no separate lower-leg figure. The widely repeated
//         "Fox lowers every 50 hours" is shop lore, not Fox's position.
//   Fox   tech.ridefox.com service procedures, Transfer seatpost, named in
//         Fox's own procedure titles: 25 Hour Simple Grease Service, 125 Hour
//         Intermediate Service, 300 Hour Full Rebuild.
//   RS    sram.com 2021-2022 ZEB service manual: "Every 50 hours - Perform
//         lower leg service", "Every 200 hours - Perform damper and spring
//         service".
//   RS    sram.com 2018-2022 Super Deluxe service manual: 50 hour air can
//         service, 200 hour damper service. Note the MY27 Super Deluxe
//         doubles the air can interval to 100 hours — if that becomes common
//         on customers' bikes it needs splitting out by model year.
//   RS    sram.com SRAM/RockShox Service Interval Counter Mat
//         (GEN.0000000005593 Rev H), seatpost columns: 50h lower post
//         service, 300h basic seatpost service (Reverb AXS B1), 600h
//         complete seatpost service (Reverb AXS A1, Stealth C1, XPLR A1,
//         AXS B1). Older non-AXS posts sit at 200h/400h — if those keep
//         coming in, they need splitting out by model.
//
// Two judgement calls that are Keith's, not the manufacturers':
//   - FOX FORK LOWER LEG AND FOX SHOCK AIR CAN, BOTH 50 HOURS. Fox's
//     published maintenance table shows only the 125h/yearly full service,
//     with bath oil and wipers folded in, and they give no hour figure for
//     air sleeve maintenance. Keith services these for a living and puts both
//     at 50 hours, which is also where RockShox put theirs. Those two figures
//     are his, not Fox's.
//   - 'Other' is a middle ground for brands we have no figures for.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Published service intervals, by part and brand.
 *
 * hours     — riding hours between services
 * capMonths — the "or yearly" half of the rule. Seals harden and oil degrades
 *             on the shelf as well as on the trail, so time can fall due
 *             before hours do.
 */
export const SERVICE_PLAN = {
  fork: {
    Fox: [
      // Keith's figure — see the note above. Not from Fox's published table.
      { key: 'lowers', hours: 50,  capMonths: 12 },
      { key: 'full',   hours: 125, capMonths: 12 },
    ],
    Rockshox: [
      { key: 'lowers', hours: 50,  capMonths: 12 },
      { key: 'full',   hours: 200, capMonths: 24 },
    ],
    Other: [
      { key: 'lowers', hours: 50,  capMonths: 12 },
      { key: 'full',   hours: 150, capMonths: 24 },
    ],
  },
  shock: {
    Fox: [
      // Keith's figure — see the note above. Not from Fox's published table.
      { key: 'air',  hours: 50,  capMonths: 12 },
      { key: 'full', hours: 125, capMonths: 12 },
    ],
    Rockshox: [
      { key: 'air',  hours: 50,  capMonths: 12 },
      { key: 'full', hours: 200, capMonths: 24 },
    ],
    Other: [
      { key: 'air',  hours: 50,  capMonths: 12 },
      { key: 'full', hours: 150, capMonths: 24 },
    ],
  },
  dropper: {
    Fox: [
      { key: 'grease', hours: 25,  capMonths: 12 },
      { key: 'mid',    hours: 125, capMonths: 24 },
      { key: 'full',   hours: 300, capMonths: 36 },
    ],
    Rockshox: [
      { key: 'lowers', hours: 50,  capMonths: 12, label: 'Lower post service',
        blurb: 'Lower post off, cleaned and re-greased' },
      { key: 'mid',    hours: 300, capMonths: 12, label: 'Basic service',
        blurb: 'Service kit parts, internals cleaned and re-lubed' },
      { key: 'full',   hours: 600, capMonths: 24, label: 'Complete service',
        blurb: 'Full overhaul, internal hydraulics restored' },
    ],
    Other: [{ key: 'full', hours: 150, capMonths: 24 }],
  },
}

/** How hard the rider is on the kit. Heat, shaft speed, oil shear. */
export const STYLE_FACTOR = {
  casual: 0.85,
  trail:  1.0,
  enduro: 1.25,
  park:   1.5,
}

/**
 * What the rider is riding *through*. This is the Scottish bit — the US
 * version asks which state you are in, which is no use here. What matters
 * locally is grit: Tweed Valley trail centres are crushed granite, which is
 * abrasive and gets everywhere. Pentlands peat is softer on seals but wetter.
 */
export const TERRAIN_FACTOR = {
  dry:     1.0,   // mostly hardpack, gravel, dry months only
  local:   1.1,   // Pentlands, local loops — peat and standing water
  centre:  1.3,   // Glentress, Innerleithen, Tweed Valley — crushed granite grit
  natural: 1.25,  // Highlands natural, big mountain days
  uplift:  1.5,   // uplift and bike park days
}

/**
 * Wear severity by month for Edinburgh / Central Scotland, Jan–Dec.
 * Driven by how wet and gritty it is underfoot, not air temperature:
 * Oct–Jan are the worst (standing water, grit, road salt on the way out),
 * Jun–Aug the kindest.
 */
export const MONTH_SEVERITY = [1.55, 1.50, 1.35, 1.20, 1.05, 1.00, 1.00, 1.05, 1.20, 1.40, 1.55, 1.60]

/** Riding volume by month relative to summer, for riders who ease off in winter. */
export const WINTER_VOLUME = [0.5, 0.5, 0.75, 1, 1, 1, 1, 1, 1, 0.9, 0.6, 0.5]

/** Jet washing forces water and grit past the dust wipers. Common here. */
export const JETWASH_FACTOR = 1.15

/**
 * The rider the published intervals are measured against.
 *
 * Without this the factors double-count: a manufacturer's 50 hours already
 * assumes somebody actually riding a bike, so multiplying style x terrain x
 * season on top of it told an ordinary Tweed Valley trail rider their lowers
 * were due at 25 hours. Normalising against this profile means a typical local
 * rider lands on the published figure and everyone else moves relative to them.
 */
export const REFERENCE = { style: 'trail', terrain: 'centre', jetwash: false }

/**
 * A blanket penalty on top of the rider's own answers.
 *
 * Deliberately 1.0: on first load nobody has told us anything, so the page
 * must show the published interval and nothing else. Any shortening the
 * visitor sees should be something they described — hard riding, a jet wash —
 * not a thumb we put on the scale before they touched it.
 *
 * Raise it only if you want every visitor's dates to come in regardless of
 * their answers. The Scottish conditions still show up without it, through
 * the month weighting on dates and through the jet wash and style factors.
 */
export const LOCAL_PENALTY = 1.0

/**
 * The published interval is a ceiling, never a floor.
 *
 * SRAM's own counter mat says each interval "indicates the MAXIMUM number of
 * riding hours" for that service, and Fox's is "125hrs or yearly, whichever
 * comes first". So a gentle rider is held at the published figure rather than
 * being told they can go longer than the manufacturer allows.
 */
export const MIN_FACTOR = 1.0

/** Stops the extremes running away. A DH/park rider who jet washes lands
 *  around 1.73, so this leaves a little headroom above the worst real answer. */
export const MAX_FACTOR = 1.8

// ───────────────────────────────────────────────────────────────────────────

/** How hard the conditions are, independent of what the rider answered. */
function conditions({ style, terrain, jetwash }) {
  return (
    (STYLE_FACTOR[style] ?? 1) *
    (TERRAIN_FACTOR[terrain] ?? 1) *
    (jetwash ? JETWASH_FACTOR : 1)
  )
}

const REFERENCE_CONDITIONS = conditions(REFERENCE)

const SEASON_MEAN = MONTH_SEVERITY.reduce((a, b) => a + b, 0) / 12

/**
 * The seasonal shape, averaging 1 across the year. This moves *when* in the
 * year a service falls due — a wet January hour costs more than a dry July
 * one — without changing the headline interval, which belongs to the rider's
 * conditions rather than the calendar.
 */
function seasonShape(monthIdx) {
  return MONTH_SEVERITY[monthIdx] / SEASON_MEAN
}

/**
 * The headline multiplier: how fast this rider wears kit relative to the
 * conditions the published interval assumes. Exactly 1.0 for the reference
 * rider, which is what first load shows before anything has been answered.
 */
export function profileFactor(profile) {
  const raw = (conditions(profile) / REFERENCE_CONDITIONS) * LOCAL_PENALTY
  return Math.min(Math.max(raw, MIN_FACTOR), MAX_FACTOR)
}

/** Wear rate for one month: the rider's own factor, shaped by the season. */
export function wearRate(profile, monthIdx) {
  return profileFactor(profile) * seasonShape(monthIdx)
}

/**
 * Walk forward a day at a time, accumulating "wear hours" — riding hours
 * weighted by how punishing that month is. A winter hour in the Tweed Valley
 * costs the fork far more than a July hour on dry hardpack, so a flat
 * hours-per-week average would put the dates in the wrong place.
 *
 * Returns the date the threshold is reached, plus the actual riding hours
 * that took, which is the number a rider can sanity-check against their own
 * Strava time.
 */
export function projectDate(profile, thresholdHours, maxMonths, since, now = new Date()) {
  const { hoursPerWeek, ridesYearRound } = profile
  if (!(hoursPerWeek > 0)) return null

  const hardStop = new Date(since)
  hardStop.setMonth(hardStop.getMonth() + maxMonths)

  const d = new Date(since)
  let wear = 0
  let ridingHours = 0
  let hoursToDate = null // riding hours put in since the service, up to today

  // Ten years of days — the walk can start well in the past now, so the old
  // five-year budget could run out before reaching the threshold for someone
  // who rides very little.
  for (let i = 0; i < 365 * 10; i++) {
    if (hoursToDate === null && d >= now) hoursToDate = ridingHours

    const m = d.getMonth()
    const volume = ridesYearRound ? 1 : WINTER_VOLUME[m]
    const dayHours = (hoursPerWeek / 7) * volume

    ridingHours += dayHours
    wear += dayHours * wearRate(profile, m)

    const done = wear >= thresholdHours
    const timedOut = d >= hardStop
    if (done || timedOut) {
      const date = timedOut && !done ? new Date(hardStop) : new Date(d)
      const alreadyDone = hoursToDate ?? ridingHours
      return {
        date,
        ridingHours: Math.round(ridingHours),
        hoursSinceService: Math.round(alreadyDone),
        // What the rider has left to ride before it's due. With no past
        // service date this equals the full interval; with one, it's the bit
        // that hasn't been used up yet — which is the number worth showing.
        hoursRemaining: Math.max(0, Math.round(ridingHours - alreadyDone)),
        capped: timedOut && !done,
        overdue: date < now,
        monthsOverdue: date < now ? monthsBetween(date, now) : 0,
      }
    }
    d.setDate(d.getDate() + 1)
  }
  return null
}

function monthsBetween(a, b) {
  return Math.max(
    0,
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  )
}

/** What each service is called and what it covers, per part. */
const SERVICE_META = {
  fork: {
    lowers: { label: 'Lower leg service', blurb: 'Fresh bath oil, clean wipers and foam rings' },
    full:   { label: 'Full service',      blurb: 'Damper and air spring rebuilt, bath oil and wipers renewed' },
  },
  shock: {
    air:  { label: 'Air can service', blurb: 'Air sleeve off, seals and lube renewed' },
    full: { label: 'Full service',    blurb: 'Damper rebuilt, seals and oil renewed' },
  },
  dropper: {
    grease: { label: 'Grease service',       blurb: 'Quick seal clean and re-grease' },
    lowers: { label: 'Lower post service',   blurb: 'Lower post off, cleaned and re-greased' },
    mid:    { label: 'Intermediate service', blurb: 'Seals, bushings and free play' },
    full:   { label: 'Full rebuild',         blurb: 'Stripped, rebuilt and recharged' },
  },
}

/**
 * Where the clock starts for one service.
 *
 * 'fresh'   — just serviced, or a new bike: count from today.
 * 'date'    — count from the month given. The answer can land in the past,
 *             which is the point: that rider is overdue and should be told so.
 * 'unknown' — never done, or can't remember. No honest date exists, so the
 *             screen says it's due rather than inventing one.
 *
 * A lower-leg or air-can service does not reset the full-service clock, so a
 * rider who has only ever had lowers done still has an unknown full service.
 */
function startFor(serviceKey, last, now) {
  if (!last || last.mode === 'fresh') return now
  if (last.mode === 'never') return null
  if (!last.when) return now

  if (serviceKey === 'full' && last.scope !== 'full') return null

  const [y, m] = last.when.split('-').map(Number)
  if (!y || !m) return now
  const d = new Date(y, m - 1, 1)
  // A date in the future is a typo, not a prediction
  return d > now ? now : d
}

/**
 * The whole estimate.
 *
 * profile: {
 *   components: { fork: 'Fox'|'Rockshox'|'Other'|null, shock: ..., dropper: bool },
 *   lastService: { fork: { mode, when, scope }, shock: {...}, dropper: {...} },
 *   rideMinutes, ridesPerWeek, style, terrain, jetwash, ridesYearRound
 * }
 */
export function estimate(profile, from = new Date()) {
  const hoursPerWeek = (profile.rideMinutes * profile.ridesPerWeek) / 60
  const p = { ...profile, hoursPerWeek }

  // The headline multiplier. Deliberately not weighted by riding volume: it
  // answers "how hard are you on kit", which does not change because somebody
  // rides less in February. When they ride only shifts the date, and that is
  // handled by the seasonal shape inside projectDate.
  const severity = profileFactor(p)

  const out = []
  for (const part of ['fork', 'shock', 'dropper']) {
    const brand = profile.components[part]
    if (!brand) continue

    const last = profile.lastService?.[part]

    const plan = SERVICE_PLAN[part][brand] ?? SERVICE_PLAN[part].Other

    const services = plan.map(({ key, hours, capMonths, label, blurb }) => {
      const since = startFor(key, last, from)
      const base = {
        key,
        ...SERVICE_META[part][key],
        // Brands name the equivalent service differently — Fox's dropper
        // "intermediate" is RockShox's "basic" — so a plan entry may override.
        ...(label ? { label } : {}),
        ...(blurb ? { blurb } : {}),
        hours,
        // What the interval actually works out at under these conditions.
        // Wear accrues as riding hours x severity, so reaching the threshold
        // takes hours/severity of real riding. Shown against the published
        // figure so the cost of grit, winter and jet washing is visible
        // rather than buried in a date.
        effectiveHours: Math.max(1, Math.round(hours / severity)),
        capMonths,
        since,
      }

      // Nothing to count from — say so rather than guess a date
      if (!since) return { ...base, unknown: true, overdue: true }

      return { ...base, ...projectDate(p, hours, capMonths, since, from) }
    })

    out.push({
      part,
      brand,
      label: part === 'fork' ? 'Fork' : part === 'shock' ? 'Rear shock' : 'Dropper post',
      services,
    })
  }

  return { hoursPerWeek, severity, components: out }
}

/**
 * What kind of rider this profile describes. 1.0 is the manufacturer's own
 * assumption — where the page sits before anything has been answered — and
 * it climbs from there as the answers get rowdier.
 */
export function severityLabel(severity) {
  if (severity < 1.05) return { text: 'Trail Cruiser',      tone: 'emerald' }
  if (severity < 1.25) return { text: 'Weekend Warrior',    tone: 'sky' }
  if (severity < 1.45) return { text: 'Proper Sender',      tone: 'amber' }
  if (severity < 1.65) return { text: 'Certified Hooligan', tone: 'orange' }
  return { text: 'Full Gnar Dog', tone: 'red' }
}
