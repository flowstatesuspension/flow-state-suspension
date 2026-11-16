import { useState, useMemo, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { estimate, riderType, MIN_FACTOR, WORST_FACTOR } from '../lib/serviceIntervals'

// Public service interval estimator. Served at /intervals with no login.
//
// Entirely client side — it touches no table and needs no key, so it can be
// linked or iframed from the main site without widening anything. The only
// thing it knows about the workshop is the link through to /book.
//
// One unit, one question at a time, and the answer panel always on screen
// directly under the controls. The point of the page is watching the interval
// move as the conditions change, so the output must never be below the fold:
// that is why it covers a single unit rather than the whole bike.

const BRANDS = ['Fox', 'Rockshox', 'Other']

const UNITS = [
  { key: 'fork',    label: 'Fork',    brands: true },
  { key: 'shock',   label: 'Shock',   brands: true },
  { key: 'dropper', label: 'Dropper', brands: true },
]

const STYLES = [
  { key: 'casual', label: 'Casual',    hint: 'Towpaths, fire road, the odd blue' },
  { key: 'trail',  label: 'Trail',     hint: 'Red routes, natural singletrack' },
  { key: 'enduro', label: 'Enduro',    hint: 'Steep, fast, racing or training for it' },
  { key: 'park',   label: 'Downhill',  hint: 'Uplift days and bike park laps' },
]

const MODES = [
  { key: 'fresh', label: 'Just done' },
  { key: 'date',  label: 'Pick when' },
  { key: 'never', label: 'Never / not sure' },
]

const PARTIAL_LABEL = { fork: 'Lowers only', shock: 'Air can only', dropper: 'Grease only' }

const DEFAULTS = {
  unit: 'fork',
  brand: 'Fox',
  last: { mode: 'fresh', when: '', scope: 'full' },
  rideMinutes: 120,
  ridesPerWeek: 2,
  style: 'trail',
  jetwash: false,
  ridesYearRound: true,
}

// Asking "where do you ride" turned out to overlap almost entirely with the
// riding style question — a DH/park answer already implies uplift laps. The
// model still takes a terrain, so it is pinned to the local default: typical
// Tweed Valley trail centre grit, which is what REFERENCE normalises against.
const LOCAL_TERRAIN = 'centre'

const STEPS = [
  { id: 'unit',    title: "What are we looking at?", sub: 'One unit at a time' },
  { id: 'history', title: 'When was it last done?',  sub: 'The honest answer gives the best date' },
  { id: 'volume',  title: 'How much do you ride?',   sub: 'Roughly — nobody is counting' },
  { id: 'style',   title: 'How do you ride?',        sub: 'Harder riding works the damper harder' },
  { id: 'winter',  title: 'Winter and washing',      sub: 'The wet months do most of the damage' },
]

// ── URL round-trip, so a shared link opens on the same answers ─────────────

function encode(p) {
  const q = new URLSearchParams()
  q.set('u', p.unit)
  q.set('b', p.brand)
  if (p.last.mode === 'never') q.set('l', 'never')
  else if (p.last.mode === 'date' && p.last.when)
    q.set('l', `${p.last.when}:${p.last.scope === 'full' ? 'full' : 'partial'}`)
  q.set('m', p.rideMinutes)
  q.set('r', p.ridesPerWeek)
  q.set('y', p.style)
  if (p.jetwash) q.set('w', '1')
  if (!p.ridesYearRound) q.set('o', '1')
  return q.toString()
}

function decode() {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search)
  if (![...q.keys()].length) return null

  const int = (v, lo, hi, dflt) => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt
  }
  const l = q.get('l')
  let last = { mode: 'fresh', when: '', scope: 'full' }
  if (l === 'never') last = { mode: 'never', when: '', scope: 'full' }
  else if (l) {
    const [when, scope] = l.split(':')
    if (/^\d{4}-\d{2}$/.test(when ?? ''))
      last = { mode: 'date', when, scope: scope === 'full' ? 'full' : 'partial' }
  }

  return {
    unit: UNITS.some(u => u.key === q.get('u')) ? q.get('u') : DEFAULTS.unit,
    brand: BRANDS.includes(q.get('b')) ? q.get('b') : DEFAULTS.brand,
    last,
    rideMinutes: int(q.get('m'), 30, 360, DEFAULTS.rideMinutes),
    ridesPerWeek: int(q.get('r'), 1, 14, DEFAULTS.ridesPerWeek),
    style: STYLES.some(s => s.key === q.get('y')) ? q.get('y') : DEFAULTS.style,
    jetwash: q.get('w') === '1',
    ridesYearRound: q.get('o') !== '1',
  }
}

// ── Bits ───────────────────────────────────────────────────────────────────

const miniBtn = on =>
  `rounded-lg px-2 py-2 text-[12px] font-semibold border transition ${
    on
      ? 'border-sky-500 bg-sky-50 text-sky-900'
      : 'border-slate-200 bg-white text-slate-500 active:bg-slate-50'
  }`

function Chip({ on, onClick, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition ${
        on
          ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20'
          : 'border-slate-200 bg-white active:bg-slate-50'
      }`}
    >
      <span className={`block text-[14px] font-semibold ${on ? 'text-sky-900' : 'text-slate-800'}`}>
        {label}
      </span>
      {hint && <span className="block text-[11px] text-slate-400 mt-0.5 leading-snug">{hint}</span>}
    </button>
  )
}

function Slider({ label, value, display, min, max, step, onChange }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-slate-700">{label}</span>
        <span className="text-[15px] font-bold text-slate-900 tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full mt-1.5 accent-sky-500"
      />
    </label>
  )
}

/**
 * The wear meter. This is the thing the page exists to show — it moves on
 * every tap, so the cost of a choice is visible at the moment it is made.
 * It starts empty, at the manufacturer's own interval, and fills as the
 * rider describes conditions the manufacturer did not assume.
 */
function WearMeter({ severity, label, tone }) {
  // Scaled to the worst answer available, not to the safety clamp, so the
  // hardest settings fill the bar completely.
  const pct = Math.min(100, Math.max(0, ((severity - MIN_FACTOR) / (WORST_FACTOR - MIN_FACTOR)) * 100))
  // Written out in full so Tailwind's scanner emits every class — it cannot
  // see a class name built from a variable, so any new tone needs adding here.
  const bar = {
    emerald: 'bg-emerald-500', sky: 'bg-sky-500', amber: 'bg-amber-500', red: 'bg-red-500',
  }[tone]
  const text = {
    emerald: 'text-emerald-700', sky: 'text-sky-700', amber: 'text-amber-600', red: 'text-red-600',
  }[tone]

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={`text-[13px] font-bold ${text}`}>{label}</span>
        <span className="text-[12px] font-bold text-slate-500 tabular-nums">
          {severity.toFixed(2)}× wear
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400">Happy Cruiser</span>
        <span className="text-[10px] text-slate-400">Full Gnar Dog</span>
      </div>
    </div>
  )
}

/** Your interval against the published one, as a bar that shrinks. */
function IntervalBar({ yours, published }) {
  const pct = Math.min(100, Math.round((yours / published) * 100))
  const shortened = yours < published
  return (
    <div className="mt-1.5">
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${shortened ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
        {shortened ? (
          <>
            <strong className="text-slate-600">every ~{yours} hrs</strong> here
            {' · '}{published} hrs published
          </>
        ) : (
          <>
            <strong className="text-slate-600">every {published} hrs</strong> — the published interval
          </>
        )}
      </p>
    </div>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function IntervalScreen() {
  const shared = useRef(decode()).current
  const [p, setP] = useState(() => shared ?? DEFAULTS)
  const [step, setStep] = useState(() => (shared ? STEPS.length - 1 : 0))
  const [copied, setCopied] = useState(false)

  const set = patch => setP(prev => ({ ...prev, ...patch }))
  const setLast = patch => setP(prev => ({ ...prev, last: { ...prev.last, ...patch } }))

  // The model still takes the whole-bike shape; this page just drives one
  // slot of it at a time.
  const result = useMemo(
    () =>
      estimate({
        components: {
          fork: p.unit === 'fork' ? p.brand : null,
          shock: p.unit === 'shock' ? p.brand : null,
          dropper: p.unit === 'dropper' ? p.brand : null,
        },
        lastService: { [p.unit]: p.last },
        rideMinutes: p.rideMinutes,
        ridesPerWeek: p.ridesPerWeek,
        style: p.style,
        terrain: LOCAL_TERRAIN,
        jetwash: p.jetwash,
        ridesYearRound: p.ridesYearRound,
      }),
    [p]
  )

  const unit = result.components[0]
  const rider = riderType(p.style)

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}?${encode(p)}`)
  }, [p])

  const restart = () => {
    setP(DEFAULTS)
    setStep(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My suspension service dates — Flow State Suspension', url })
        return
      }
    } catch {
      // cancelled, or the browser refused — fall through to copy
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the URL is in the bar either way */
    }
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const thisMonth = new Date().toISOString().slice(0, 7)
  const unitLabel = UNITS.find(u => u.key === p.unit)?.label ?? ''

  const question = () => {
    switch (current.id) {
      case 'unit':
        return (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              {UNITS.map(u => (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => set({ unit: u.key })}
                  className={`rounded-xl border py-3 text-[14px] font-bold transition ${
                    p.unit === u.key
                      ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-white text-slate-500 active:bg-slate-50'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BRANDS.map(b => (
                <button key={b} type="button" onClick={() => set({ brand: b })} className={miniBtn(p.brand === b)}>
                  {b === 'Rockshox' ? 'RockShox' : b}
                </button>
              ))}
            </div>
          </div>
        )

      case 'history':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {MODES.map(m => (
                <button key={m.key} type="button" onClick={() => setLast({ mode: m.key })}
                  className={miniBtn(p.last.mode === m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            {p.last.mode === 'date' && (
              <div className="space-y-2">
                <input
                  type="month"
                  max={thisMonth}
                  value={p.last.when}
                  onChange={e => setLast({ when: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-sky-500"
                />
                {PARTIAL_LABEL[p.unit] && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setLast({ scope: 'full' })}
                      className={miniBtn(p.last.scope === 'full')}>
                      Full service
                    </button>
                    <button type="button" onClick={() => setLast({ scope: 'partial' })}
                      className={miniBtn(p.last.scope !== 'full')}>
                      {PARTIAL_LABEL[p.unit]}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )

      case 'volume':
        return (
          <div className="space-y-4">
            <Slider
              label="A typical ride"
              value={p.rideMinutes}
              display={
                p.rideMinutes >= 60
                  ? `${Math.floor(p.rideMinutes / 60)}h${p.rideMinutes % 60 ? ` ${p.rideMinutes % 60}m` : ''}`
                  : `${p.rideMinutes}m`
              }
              min={30} max={360} step={15}
              onChange={v => set({ rideMinutes: v })}
            />
            <Slider
              label="Rides a week" value={p.ridesPerWeek} display={p.ridesPerWeek}
              min={1} max={10} step={1}
              onChange={v => set({ ridesPerWeek: v })}
            />
            <p className="text-[11px] text-slate-400 -mt-1">
              About <strong className="text-slate-600">{result.hoursPerWeek.toFixed(1)} hours a week</strong> on the bike.
            </p>
          </div>
        )

      case 'style':
        return (
          <div className="space-y-2">
            {STYLES.map(s => (
              <Chip key={s.key} on={p.style === s.key} onClick={() => set({ style: s.key })}
                label={s.label} hint={s.hint} />
            ))}
          </div>
        )

      case 'winter':
        return (
          <div className="space-y-2">
            <Chip on={p.ridesYearRound} onClick={() => set({ ridesYearRound: true })}
              label="All year, whatever it's doing"
              hint="Winter hours are the ones that wear seals out" />
            <Chip on={!p.ridesYearRound} onClick={() => set({ ridesYearRound: false })}
              label="I ease off when it's grim"
              hint="Far less riding November to February" />
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
              <input type="checkbox" checked={p.jetwash}
                onChange={e => set({ jetwash: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-sky-500 shrink-0" />
              <span>
                <span className="block text-[14px] font-semibold text-slate-800">
                  I jet wash after most rides
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Drives water and grit straight past the dust wipers
                </span>
              </span>
            </label>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-black safe-top">
        <div className="max-w-xl mx-auto px-4 pt-3 pb-3 flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-9 w-auto shrink-0" />
          <div>
            <h1 className="text-white font-bold text-base leading-none tracking-tight">
              Service Interval Estimator
            </h1>
            <p className="text-slate-400 text-[11px] mt-1">Flow State Suspension · Edinburgh</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-3 pb-8 space-y-3">
        {/* ── Question ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex gap-1 px-4 pt-3.5">
            {STEPS.map((s, i) => (
              <button key={s.id} type="button" aria-label={s.title} onClick={() => setStep(i)}
                className={`h-1 flex-1 rounded-full transition ${i <= step ? 'bg-sky-500' : 'bg-slate-200'}`} />
            ))}
          </div>

          <div className="px-4 pt-2.5 pb-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-[17px] font-bold text-slate-900 mt-0.5 leading-tight">{current.title}</h2>
            {current.sub && <p className="text-[11px] text-slate-400 mt-0.5">{current.sub}</p>}
            <div className="mt-3">{question()}</div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 disabled:opacity-40 active:bg-slate-100">
              Back
            </button>
            <button type="button" onClick={restart}
              className="text-[12px] font-semibold text-slate-400 px-1.5 active:text-slate-600">
              Start again
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              disabled={isLast}
              className="rounded-xl bg-sky-500 px-5 py-2 text-[13px] font-bold text-white disabled:opacity-40 active:bg-sky-600"
            >
              Next
            </button>
          </div>
        </div>

        {/* ── Live output. Deliberately short so it shares the screen with
               the controls above — watching this move is the whole point. ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-baseline gap-2 mb-2.5">
              <h3 className="text-[15px] font-bold text-slate-900">{unitLabel}</h3>
              <span className="text-[11px] font-semibold text-slate-400">
                {p.brand === 'Rockshox' ? 'RockShox' : p.brand}
              </span>
            </div>
            <WearMeter severity={result.severity} label={rider.text} tone={rider.tone} />
          </div>

          <div className="divide-y divide-slate-50">
            {unit?.services.map(s => (
              <div key={s.key} className={`px-4 py-3 ${s.overdue ? 'bg-red-50/60' : ''}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[14px] font-semibold text-slate-800">{s.label}</p>
                  {s.unknown ? (
                    <p className="text-[14px] font-bold text-red-600 shrink-0">Due now</p>
                  ) : s.overdue ? (
                    <p className="text-[14px] font-bold text-red-600 shrink-0">
                      Overdue{s.monthsOverdue >= 1 ? ` ~${s.monthsOverdue}mo` : ''}
                    </p>
                  ) : (
                    <p className="text-[14px] font-bold text-slate-900 shrink-0">
                      {s.date ? format(s.date, 'MMM yyyy') : '—'}
                    </p>
                  )}
                </div>
                {s.unknown ? (
                  <p className="text-[10px] text-red-400 mt-0.5">
                    No record of one — worth doing before anything else
                  </p>
                ) : (
                  <IntervalBar yours={s.effectiveHours} published={s.hours} />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 p-3 bg-slate-50 border-t border-slate-100">
            <a href="/book"
              className="flex-1 rounded-xl bg-sky-500 px-4 py-2.5 text-center text-[14px] font-bold text-white active:bg-sky-600">
              Book {unitLabel.toLowerCase() === 'dropper' ? 'a dropper service' : `a ${unitLabel.toLowerCase()} service`}
            </a>
            <button type="button" onClick={share}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50">
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            How this is worked out
          </h2>
          <p className="text-[12px] text-slate-500 leading-relaxed mt-2">
            We start from the manufacturer's hour-based interval, then weigh each month by how hard
            it is on suspension round here. A wet January hour in the Tweed Valley costs your fork
            far more than a dry July hour on hardpack, so the interval shortens and the date moves.
            Jet washing, uplift days and hard riding all shorten it further.
          </p>
          <p className="text-[12px] text-slate-400 leading-relaxed mt-2">
            It's an estimate to plan around, not a diagnosis. If it feels harsh, sounds dry or is
            leaking, bring it in sooner — and anything sat unused for a season is worth a look
            regardless of hours.
          </p>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          Flow State Suspension Ltd · Edinburgh ·{' '}
          <a href="https://www.flowstatesuspension.co.uk" className="underline">
            flowstatesuspension.co.uk
          </a>
        </p>
      </div>
    </div>
  )
}
