// ═══════════════════════════════════════════════════════════════════════════
// Service interval model — Edinburgh / Central Scotland
//
// Everything Keith might want to argue with lives in this file, at the top.
// The screen only renders what comes out of estimate().
//
// ── THE NUMBERS NEED SIGNING OFF ───────────────────────────────────────────
// Manufacturer guidance is messier than it looks. Fox's own service page gives
// 125 hours or yearly for a FULL service, and says to come in sooner for
// uplift/park riding or muddy conditions — that part is solid. There is no
// equally clear official figure for lower-leg intervals, and the widely quoted
// RockShox 50h/200h pair does not appear on a RockShox page. The defaults below
// are the usual workshop figures, not gospel. Change them to whatever you tell
// customers in person — that is the number that should be on your website.
// ═══════════════════════════════════════════════════════════════════════════

/** Riding hours between services, per brand. */
export const BASE_HOURS = {
  Fox: {
    fork:  { lowers: 50, full: 125 },
    shock: { air: 50, full: 125 },
  },
  Rockshox: {
    fork:  { lowers: 50, full: 200 },
    shock: { air: 50, full: 200 },
  },
  Other: {
    fork:  { lowers: 50, full: 150 },
    shock: { air: 50, full: 150 },
  },
}

/** Droppers are simpler — one service, and most makers also say "or yearly". */
export const DROPPER_HOURS = 100

/** Hard ceiling regardless of hours. Fox says 125h *or yearly*, whichever
 *  first; seals harden and oil degrades on the shelf as well as on the trail. */
export const MAX_MONTHS = { lowers: 12, full: 24, air: 12, dropper: 18 }

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
export function projectDate(profile, thresholdHours, maxMonths, from = new Date()) {
  const { hoursPerWeek, ridesYearRound } = profile
  if (!(hoursPerWeek > 0)) return null

  const hardStop = new Date(from)
  hardStop.setMonth(hardStop.getMonth() + maxMonths)

  const d = new Date(from)
  let wear = 0
  let ridingHours = 0

  // Five years of days is plenty; beyond that the estimate is meaningless
  for (let i = 0; i < 365 * 5; i++) {
    const m = d.getMonth()
    const volume = ridesYearRound ? 1 : WINTER_VOLUME[m]
    const dayHours = (hoursPerWeek / 7) * volume

    ridingHours += dayHours
    wear += dayHours * wearRate(profile, m)

    if (wear >= thresholdHours) {
      return { date: new Date(d), ridingHours: Math.round(ridingHours), capped: false }
    }
    if (d >= hardStop) {
      return { date: new Date(hardStop), ridingHours: Math.round(ridingHours), capped: true }
    }
    d.setDate(d.getDate() + 1)
  }
  return null
}

/** Which services apply to each component, in the order they should be shown. */
const SERVICES = {
  fork: [
    { key: 'lowers', label: 'Lower leg service', blurb: 'Fresh oil, clean wipers and foam rings' },
    { key: 'full',   label: 'Full service',      blurb: 'Damper and air spring stripped and rebuilt' },
  ],
  shock: [
    { key: 'air',  label: 'Air can service', blurb: 'Air sleeve off, seals and lube renewed' },
    { key: 'full', label: 'Full service',    blurb: 'Damper rebuilt, nitrogen recharged' },
  ],
  dropper: [
    { key: 'dropper', label: 'Dropper service', blurb: 'Seals, lube and free play checked' },
  ],
}

/**
 * The whole estimate.
 *
 * profile: {
 *   components: { fork: 'Fox'|'Rockshox'|'Other'|null, shock: ..., dropper: bool },
 *   rideMinutes, ridesPerWeek, style, terrain, jetwash, ridesYearRound
 * }
 */
export function estimate(profile, from = new Date()) {
  const hoursPerWeek = (profile.rideMinutes * profile.ridesPerWeek) / 60
  const p = { ...profile, hoursPerWeek }

  const out = []
  for (const part of ['fork', 'shock', 'dropper']) {
    const brand = profile.components[part]
    if (!brand) continue

    const services = SERVICES[part].map(s => {
      const hours =
        part === 'dropper'
          ? DROPPER_HOURS
          : BASE_HOURS[brand]?.[part]?.[s.key] ?? BASE_HOURS.Other[part][s.key]
      return {
        ...s,
        hours,
        capMonths: MAX_MONTHS[s.key],
        ...projectDate(p, hours, MAX_MONTHS[s.key], from),
      }
    })

    out.push({
      part,
      brand: part === 'dropper' ? null : brand,
      label: part === 'fork' ? 'Fork' : part === 'shock' ? 'Rear shock' : 'Dropper post',
      services,
    })
  }

  // Average severity across a year, for the "conditions" readout. Weighted by
  // riding volume so a summer-only rider is not judged on January.
  let sevSum = 0, volSum = 0
  for (let m = 0; m < 12; m++) {
    const v = profile.ridesYearRound ? 1 : WINTER_VOLUME[m]
    sevSum += wearRate(p, m) * v
    volSum += v
  }

  return { hoursPerWeek, severity: sevSum / volSum, components: out }
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
