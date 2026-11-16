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
//   - FOX FORK LOWER LEG, 50 HOURS. Fox's published maintenance table shows
//     only the 125h/yearly full service, with bath oil and wipers folded in.
//     Keith services these for a living and puts lowers at 50 hours, which is
//     also where RockShox put theirs. That figure is his, not Fox's.
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
    Fox: [{ key: 'full', hours: 125, capMonths: 12 }],
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
 * How much harder riding here is than the conditions the published figures
 * assume. 1.0 would mean Scotland is no worse than anywhere else; Fox
 * explicitly says to come in sooner for muddy conditions, so a modest penalty
 * is fair. This is the single number to turn if the dates feel off across the
 * board — raise it and everyone's dates come in, lower it and they go out.
 */
export const LOCAL_PENALTY = 1.15

/** Stops the extremes running away. Applied after normalising, so a park
 *  rider jet washing all winter tops out at just over twice the wear of the
 *  reference rider rather than four times. */
export const MAX_FACTOR = 2.2

// ───────────────────────────────────────────────────────────────────────────

/** Raw, un-normalised severity for one month. */
function rawRate({ style, terrain, jetwash }, monthIdx) {
  return (
    (STYLE_FACTOR[style] ?? 1) *
    (TERRAIN_FACTOR[terrain] ?? 1) *
    MONTH_SEVERITY[monthIdx] *
    (jetwash ? JETWASH_FACTOR : 1)
  )
}

/** The reference rider's average severity across the year — the divisor that
 *  puts a typical local rider on the published interval. */
const REFERENCE_RATE =
  MONTH_SEVERITY.reduce((sum, _, m) => sum + rawRate(REFERENCE, m), 0) / 12

/**
 * Severity multiplier for one month, relative to the reference rider.
 * 1.0 means "wearing at the rate the published interval assumes".
 */
export function wearRate(profile, monthIdx) {
  return Math.min((rawRate(profile, monthIdx) / REFERENCE_RATE) * LOCAL_PENALTY, MAX_FACTOR)
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

  // Average severity across a year. Weighted by riding volume so a
  // summer-only rider is not judged on January. Computed before the services
  // because each one reports its interval against it.
  let sevSum = 0, volSum = 0
  for (let m = 0; m < 12; m++) {
    const v = profile.ridesYearRound ? 1 : WINTER_VOLUME[m]
    sevSum += wearRate(p, m) * v
    volSum += v
  }
  const severity = sevSum / volSum

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
 * Plain-English read on how hard this profile is on suspension, relative to
 * the reference local rider. Centred on 1.0 so "average" means average here,
 * not average in California.
 */
export function severityLabel(severity) {
  if (severity < 0.85) return { text: 'Easy on kit', tone: 'emerald' }
  if (severity < 1.25) return { text: 'About average round here', tone: 'sky' }
  if (severity < 1.7) return { text: 'Hard on kit', tone: 'amber' }
  return { text: 'Brutal', tone: 'red' }
}
