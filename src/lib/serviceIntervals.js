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

/**
 * How hard the rider is on the kit. Heat, shaft speed, oil shear.
 *
 * These are distances from trail, which is the reference. Only the distance
 * matters: scaling all four by the same amount cancels out in profileFactor
 * and would change nothing on screen.
 *
 * Downhill is the hardest answer on the page and tops out at 1.30 — what a
 * rider gets for taking it through the winter. Easing off for the worst
 * months pulls back from there rather than adding to it, so 1.30 is the
 * ceiling on the whole page, not a mid-point.
 *
 * Enduro sits half that distance above trail, which is the proportion it had
 * before the range was brought in (it was +0.20 against downhill's +0.40).
 *
 * Casual reads 0.85 on the meter and still gets the published interval:
 * MIN_FACTOR holds it there, because the manufacturer's figure is a ceiling
 * rather than a target.
 */
export const STYLE_FACTOR = {
  casual: 0.85,
  trail:  1.0,
  enduro: 1.15,
  park:   1.30,
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

/**
 * What easing off through winter is worth, as a multiplier on wear.
 *
 * Partly derived, partly judgement. Weighting MONTH_SEVERITY by WINTER_VOLUME
 * moves the average hour from 1.29 to 1.23, which is about 4% — the honest
 * figure for "your hours are now better hours". The rest of the allowance is
 * for the kit sitting out the worst of the salt, slurry and standing water
 * rather than being ridden through it, which the per-hour weighting does not
 * capture. Turn it toward 0.96 to keep only what the months themselves say.
 */
export const WINTER_RELIEF = 0.93

/**
 * How far easing off pulls the needle back, in gauge points.
 *
 * Separate from WINTER_RELIEF on purpose. Tier positions are fixed anchors,
 * so a 7% multiplier against a 25-point anchor moves the bar by less than two
 * points — real, but invisible. This is the visible acknowledgement, and it
 * is a presentation choice rather than a measurement.
 */
export const WINTER_GAUGE_RELIEF = 10

/**
 * The rider the published intervals are measured against.
 *
 * Without this the factors double-count: a manufacturer's 50 hours already
 * assumes somebody actually riding a bike, so multiplying style x terrain x
 * season on top of it told an ordinary Tweed Valley trail rider their lowers
 * were due at 25 hours. Normalising against this profile means a typical local
 * rider lands on the published figure and everyone else moves relative to them.
 */
export const REFERENCE = { style: 'trail', terrain: 'centre' }

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

/** Stops the extremes running away. Downhill, the hardest answer available,
 *  lands on 1.30, so this leaves a little headroom above it. */
export const MAX_FACTOR = 1.4

// ───────────────────────────────────────────────────────────────────────────

/** How hard the conditions are, independent of what the rider answered. */
function conditions({ style, terrain }) {
  return (STYLE_FACTOR[style] ?? 1) * (TERRAIN_FACTOR[terrain] ?? 1)
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
  // Nothing applies until the rider has said how they ride. Until then the
  // page is showing the manufacturer's own figure and has no grounds to move it.
  if (!profile?.style) return 1

  const raw =
    (conditions(profile) / REFERENCE_CONDITIONS) *
    LOCAL_PENALTY *
    (profile.ridesYearRound === false ? WINTER_RELIEF : 1)
  return Math.min(raw, MAX_FACTOR)
}

/** Where the needle sits, 0-100: the rider's tier, pulled back if they sit
 *  the worst of the winter out. */
export function gaugePosition(profile) {
  const tier = RIDER_TYPE[profile?.style]
  if (!tier) return 0
  const relief = profile.ridesYearRound === false ? WINTER_GAUGE_RELIEF : 0
  return Math.max(0, tier.gauge - relief)
}

/**
 * What we actually apply to the intervals, as opposed to what the meter
 * shows.
 *
 * A gentle rider can read below 1.0 on the meter — that is a fair description
 * of them — but the published interval is a ceiling, not a target. SRAM call
 * theirs the maximum riding hours and Fox's is "125hrs or yearly, whichever
 * comes first", so the page never tells anyone they can go longer than the
 * manufacturer allows. Happy Cruiser therefore reads 0.85x and still gets the
 * published figure.
 */
export function appliedFactor(profile) {
  return Math.max(profileFactor(profile), MIN_FACTOR)
}

/** Wear rate for one month: the applied factor, shaped by the season. */
export function wearRate(profile, monthIdx) {
  return appliedFactor(profile) * seasonShape(monthIdx)
}

/**
 * The worst answer anyone can actually give. Derived rather than hardcoded so
 * the meter still reaches its end if the factors above are ever retuned — a
 * scale whose top nobody can reach makes the hardest setting look like there
 * is more to come.
 *
 * Terrain is pinned to the reference by the screen, so it cancels out here.
 */
export const WORST_FACTOR = Math.max(
  ...Object.keys(STYLE_FACTOR).map(style =>
    profileFactor({ style, terrain: REFERENCE.terrain })
  )
)

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

/** Not answered yet — deliberately distinct from 'never', which IS an answer. */
const PENDING = Symbol('pending')

/**
 * Where the clock starts for one service.
 *
 * unanswered — nothing said yet. Returns PENDING. This used to fall through
 *              to 'fresh', which put a confident due month on screen before
 *              the rider had told us anything at all.
 * 'fresh'    — just serviced, or a new bike: count from today.
 * 'date'     — count from the month given. The answer can land in the past,
 *              which is the point: that rider is overdue and should be told so.
 * 'never'    — never done, or can't remember. No honest date exists, so the
 *              screen says it's due rather than inventing one.
 *
 * A lower-leg or air-can service does not reset the full-service clock, so a
 * rider who has only ever had lowers done still has an unknown full service.
 */
function startFor(serviceKey, last, now) {
  if (!last?.mode) return PENDING
  if (last.mode === 'fresh') return now
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
 *   rideMinutes, ridesPerWeek, style, terrain, ridesYearRound
 * }
 */
export function estimate(profile, from = new Date()) {
  const hoursPerWeek = (profile.rideMinutes * profile.ridesPerWeek) / 60
  const p = { ...profile, hoursPerWeek }

  // The headline multiplier. Deliberately not weighted by riding volume: it
  // answers "how hard are you on kit", which does not change because somebody
  // rides less in February. When they ride only shifts the date, and that is
  // handled by the seasonal shape inside projectDate.
  const severity = profileFactor(p)   // what the meter shows
  const applied = appliedFactor(p)    // what the intervals actually use

  const out = []
  for (const part of ['fork', 'shock', 'dropper']) {
    const brand = profile.components[part]
    if (!brand) continue

    const last = profile.lastService?.[part]

    const plan = SERVICE_PLAN[part][brand] ?? SERVICE_PLAN[part].Other

    const services = plan.map(({ key, hours, capMonths, label, blurb }) => {
      const start = startFor(key, last, from)
      const pending = start === PENDING
      const since = pending ? null : start
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
        effectiveHours: Math.max(1, Math.round(hours / applied)),
        capMonths,
        since,
      }

      // Not asked yet. The published interval still stands and is still
      // worth showing — it is the manufacturer's, not ours — but a date needs
      // something real to count from, so it stays blank until there is one.
      if (pending) return { ...base, pending: true }

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
 * What kind of rider this is, taken straight from the trails they ride.
 *
 * Deliberately one name per style rather than thresholds on the wear
 * multiplier, which left some names unreachable and let other answers promote
 * a trail rider to a gnar dog.
 *
 * `gauge` is where this tier sits on the meter, 0-100. Set per tier rather
 * than derived, so the positions are a deliberate choice — riding style is
 * the only thing feeding the multiplier, so the two are one-to-one and
 * nothing is lost by stating them.
 */
export const RIDER_TYPE = {
  casual: { text: 'Happy Cruiser',   eased: 'Sunshine Cruiser',      tone: 'emerald', gauge: 0 },
  trail:  { text: 'Weekend Warrior', eased: 'Fair Weather Warrior',  tone: 'sky',     gauge: 25 },
  enduro: { text: 'Proper Sender',   eased: 'Summer Sender',         tone: 'amber',   gauge: 60 },
  park:   { text: 'Full Gnar Dog',   eased: 'Almost Gnar Dog',       tone: 'red',     gauge: 100 },
}

/**
 * null until they have picked their trails — see profileFactor.
 *
 * Sitting the worst of the winter out earns the softer name: you are not
 * quite the rider the all-year answer describes, and the needle has already
 * come back to match.
 */
export function riderType(style, easesOff = false) {
  const tier = RIDER_TYPE[style]
  if (!tier) return null
  return { ...tier, text: easesOff ? tier.eased : tier.text }
}
