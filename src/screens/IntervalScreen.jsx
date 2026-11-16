import { useState, useMemo, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { estimate, severityLabel } from '../lib/serviceIntervals'

// Public service interval estimator. Served at /intervals with no login.
//
// Entirely client side — it touches no table and needs no key, so it can be
// linked or iframed from the main site without widening anything. The only
// thing it knows about the workshop is the link through to /book.
//
// One question at a time, with the answer panel live underneath: every change
// updates the dates immediately, so the effect of each answer is visible while
// it is being given rather than only at the end.

const BRANDS = ['Fox', 'Rockshox', 'Other']

const STYLES = [
  { key: 'casual', label: 'Casual',    hint: 'Towpaths, fire road, the odd blue' },
  { key: 'trail',  label: 'Trail',     hint: 'Red routes, natural singletrack' },
  { key: 'enduro', label: 'Enduro',    hint: 'Steep, fast, racing or training for it' },
  { key: 'park',   label: 'DH / Park', hint: 'Uplift days and bike park laps' },
]

const TERRAINS = [
  { key: 'local',   label: 'Local loops',   hint: 'Pentlands, peat and puddles' },
  { key: 'centre',  label: 'Trail centres', hint: 'Glentress, Innerleithen, Tweed Valley grit' },
  { key: 'natural', label: 'Big mountain',  hint: 'Highlands, Torridon, long natural days' },
  { key: 'uplift',  label: 'Uplift & park', hint: 'Fort William, Innerleithen uplift' },
  { key: 'dry',     label: 'Mostly dry',    hint: 'Hardpack and gravel, fair weather only' },
]

const MODES = [
  { key: 'fresh', label: 'Just done' },
  { key: 'date',  label: 'Pick when' },
  { key: 'never', label: "Never / not sure" },
]

const blankLast = () => ({ mode: 'fresh', when: '', scope: 'full' })

const DEFAULTS = {
  components: { fork: 'Fox', shock: 'Fox', dropper: false },
  lastService: { fork: blankLast(), shock: blankLast(), dropper: blankLast() },
  rideMinutes: 120,
  ridesPerWeek: 2,
  style: 'trail',
  terrain: 'centre',
  jetwash: false,
  ridesYearRound: true,
}

const STEPS = [
  { id: 'units',   title: "What's on the bike?",       sub: 'Pick what you want dates for' },
  { id: 'history', title: 'When was it last serviced?', sub: 'The honest answer gives the best dates' },
  { id: 'volume',  title: 'How much do you ride?',      sub: 'Roughly — nobody is counting' },
  { id: 'style',   title: 'How do you ride?',           sub: 'Harder riding works the damper harder' },
  { id: 'terrain', title: 'Where do you ride?',         sub: 'Grit is what kills seals round here' },
  { id: 'winter',  title: 'Winter and washing',         sub: 'The wet months do most of the damage' },
]

// ── URL round-trip, so shared dates open on the same answers ───────────────

/** "fresh" | "never" | "2026-03:full" | "2026-03:partial" */
function encodeLast(l) {
  if (!l || l.mode === 'fresh') return 'fresh'
  if (l.mode === 'never') return 'never'
  if (!l.when) return 'fresh'
  return `${l.when}:${l.scope === 'full' ? 'full' : 'partial'}`
}

function decodeLast(v) {
  if (!v || v === 'fresh') return blankLast()
  if (v === 'never') return { mode: 'never', when: '', scope: 'full' }
  const [when, scope] = v.split(':')
  if (!/^\d{4}-\d{2}$/.test(when ?? '')) return blankLast()
  return { mode: 'date', when, scope: scope === 'full' ? 'full' : 'partial' }
}

function encode(p) {
  const q = new URLSearchParams()
  if (p.components.fork) q.set('f', p.components.fork)
  if (p.components.shock) q.set('s', p.components.shock)
  if (p.components.dropper) q.set('d', '1')
  for (const [part, key] of [['fork', 'lf'], ['shock', 'ls'], ['dropper', 'ld']]) {
    const v = encodeLast(p.lastService?.[part])
    if (v !== 'fresh') q.set(key, v)
  }
  q.set('m', p.rideMinutes)
  q.set('r', p.ridesPerWeek)
  q.set('y', p.style)
  q.set('t', p.terrain)
  if (p.jetwash) q.set('w', '1')
  if (!p.ridesYearRound) q.set('o', '1')
  return q.toString()
}

function decode() {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search)
  if (![...q.keys()].length) return null
  const brand = v => (BRANDS.includes(v) ? v : null)
  const int = (v, lo, hi, dflt) => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt
  }
  return {
    components: {
      fork: brand(q.get('f')),
      shock: brand(q.get('s')),
      dropper: q.get('d') === '1',
    },
    lastService: {
      fork: decodeLast(q.get('lf')),
      shock: decodeLast(q.get('ls')),
      dropper: decodeLast(q.get('ld')),
    },
    rideMinutes: int(q.get('m'), 30, 360, DEFAULTS.rideMinutes),
    ridesPerWeek: int(q.get('r'), 1, 14, DEFAULTS.ridesPerWeek),
    style: STYLES.some(s => s.key === q.get('y')) ? q.get('y') : DEFAULTS.style,
    terrain: TERRAINS.some(t => t.key === q.get('t')) ? q.get('t') : DEFAULTS.terrain,
    jetwash: q.get('w') === '1',
    ridesYearRound: q.get('o') !== '1',
  }
}

// ── Bits ───────────────────────────────────────────────────────────────────

const miniBtn = on =>
  `rounded-lg px-2 py-1.5 text-[12px] font-semibold border transition ${
    on
      ? 'border-sky-500 bg-sky-50 text-sky-900'
      : 'border-slate-200 bg-white text-slate-500 active:bg-slate-50'
  }`

function Chip({ on, onClick, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-3.5 py-3 transition ${
        on
          ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20'
          : 'border-slate-200 bg-white active:bg-slate-50'
      }`}
    >
      <span className={`block text-[15px] font-semibold ${on ? 'text-sky-900' : 'text-slate-800'}`}>
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
        <span className="text-[14px] font-semibold text-slate-700">{label}</span>
        <span className="text-[15px] font-bold text-slate-900 tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full mt-2 accent-sky-500"
      />
    </label>
  )
}

/** Fork/shock get a brand picker; the dropper is just on or off. */
function UnitRow({ label, value, onChange, brands = true }) {
  const on = brands ? !!value : value
  return (
    <div className={`rounded-xl border p-3 ${on ? 'border-slate-300 bg-slate-50' : 'border-slate-200'}`}>
      <button
        type="button"
        onClick={() => onChange(on ? (brands ? null : false) : (brands ? 'Fox' : true))}
        className="w-full flex items-center justify-between"
      >
        <span className={`text-[15px] font-semibold ${on ? 'text-slate-900' : 'text-slate-400'}`}>
          {label}
        </span>
        <span className={`w-11 h-6 rounded-full relative transition shrink-0 ${on ? 'bg-sky-500' : 'bg-slate-200'}`}>
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
              on ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      {on && brands && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {BRANDS.map(b => (
            <button key={b} type="button" onClick={() => onChange(b)} className={miniBtn(value === b)}>
              {b === 'Rockshox' ? 'RockShox' : b}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** One component's service history, on the history step. */
function HistoryRow({ label, last, onLast, partialLabel }) {
  const thisMonth = new Date().toISOString().slice(0, 7)
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-[14px] font-semibold text-slate-800 mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            onClick={() => onLast({ ...last, mode: m.key })}
            className={miniBtn((last?.mode ?? 'fresh') === m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {last?.mode === 'date' && (
        <div className="mt-2 space-y-2">
          <input
            type="month"
            max={thisMonth}
            value={last.when ?? ''}
            onChange={e => onLast({ ...last, when: e.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-sky-500"
          />
          {partialLabel && (
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => onLast({ ...last, scope: 'full' })}
                className={miniBtn(last.scope === 'full')}>
                Full service
              </button>
              <button type="button" onClick={() => onLast({ ...last, scope: 'partial' })}
                className={miniBtn(last.scope !== 'full')}>
                {partialLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function IntervalScreen() {
  const shared = useRef(decode()).current
  const [p, setP] = useState(() => shared ?? DEFAULTS)
  // A shared link already has answers, so open it on the last step with the
  // full picture rather than making the reader click through someone else's.
  const [step, setStep] = useState(() => (shared ? STEPS.length - 1 : 0))
  const [copied, setCopied] = useState(false)
  const resultsRef = useRef(null)

  const set = patch => setP(prev => ({ ...prev, ...patch }))
  const setComponent = (key, value) =>
    setP(prev => ({ ...prev, components: { ...prev.components, [key]: value } }))
  const setLast = (key, value) =>
    setP(prev => ({ ...prev, lastService: { ...prev.lastService, [key]: value } }))

  const result = useMemo(() => estimate(p), [p])
  const sev = severityLabel(result.severity)
  const chosen = result.components.length > 0

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
    const text = 'My MTB suspension service dates — Flow State Suspension'
    try {
      if (navigator.share) {
        await navigator.share({ title: text, url })
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

  const toneCls = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }[sev.tone]

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  // ── The question for this step ──
  const question = () => {
    switch (current.id) {
      case 'units':
        return (
          <div className="space-y-2">
            <UnitRow label="Fork" value={p.components.fork} onChange={v => setComponent('fork', v)} />
            <UnitRow label="Rear shock" value={p.components.shock} onChange={v => setComponent('shock', v)} />
            <UnitRow label="Dropper post" value={p.components.dropper}
              onChange={v => setComponent('dropper', v)} brands={false} />
          </div>
        )

      case 'history':
        if (!chosen) {
          return <p className="text-[13px] text-slate-400">Go back and pick a fork, shock or dropper first.</p>
        }
        return (
          <div className="space-y-2">
            {p.components.fork && (
              <HistoryRow label="Fork" last={p.lastService.fork}
                onLast={v => setLast('fork', v)} partialLabel="Lowers only" />
            )}
            {p.components.shock && (
              <HistoryRow label="Rear shock" last={p.lastService.shock}
                onLast={v => setLast('shock', v)} partialLabel="Air can only" />
            )}
            {p.components.dropper && (
              <HistoryRow label="Dropper post" last={p.lastService.dropper}
                onLast={v => setLast('dropper', v)} />
            )}
            <p className="text-[11px] text-slate-400 leading-snug pt-1">
              A lower leg or air can service doesn't reset the full service clock — if the damper
              has never been apart, say so and we'll tell you straight.
            </p>
          </div>
        )

      case 'volume':
        return (
          <div className="space-y-5">
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
              label="Rides a week"
              value={p.ridesPerWeek}
              display={p.ridesPerWeek}
              min={1} max={10} step={1}
              onChange={v => set({ ridesPerWeek: v })}
            />
            <p className="text-[12px] text-slate-400 -mt-1">
              That's about{' '}
              <strong className="text-slate-600">{result.hoursPerWeek.toFixed(1)} hours a week</strong>{' '}
              on the bike.
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

      case 'terrain':
        return (
          <div className="space-y-2">
            {TERRAINS.map(t => (
              <Chip key={t.key} on={p.terrain === t.key} onClick={() => set({ terrain: t.key })}
                label={t.label} hint={t.hint} />
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
              hint="Far less riding from November to February" />
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3 mt-1">
              <input type="checkbox" checked={p.jetwash}
                onChange={e => set({ jetwash: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-sky-500 shrink-0" />
              <span>
                <span className="block text-[15px] font-semibold text-slate-800">
                  I jet wash the bike after most rides
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5 leading-snug">
                  A pressure washer drives water and grit straight past the dust wipers
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
        <div className="max-w-xl mx-auto px-4 pt-3 pb-4 flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-auto shrink-0" />
          <div>
            <h1 className="text-white font-bold text-lg leading-none tracking-tight">
              Service Interval Estimator
            </h1>
            <p className="text-slate-400 text-xs mt-1">Flow State Suspension · Edinburgh</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-4 pb-10">
        {/* ── Question card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Progress */}
          <div className="flex gap-1 px-4 pt-4">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={s.title}
                onClick={() => setStep(i)}
                className={`h-1 flex-1 rounded-full transition ${
                  i <= step ? 'bg-sky-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          <div className="px-4 pt-3 pb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-[19px] font-bold text-slate-900 mt-0.5 leading-tight">
              {current.title}
            </h2>
            {current.sub && <p className="text-[12px] text-slate-400 mt-0.5">{current.sub}</p>}

            <div className="mt-4">{question()}</div>
          </div>

          {/* Nav */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 disabled:opacity-40 active:bg-slate-100"
            >
              Back
            </button>

            <button
              type="button"
              onClick={restart}
              className="text-[13px] font-semibold text-slate-400 px-2 active:text-slate-600"
            >
              Start again
            </button>

            <div className="flex-1" />

            {isLast ? (
              <button
                type="button"
                onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-[14px] font-bold text-white active:bg-slate-700"
              >
                See my dates
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                disabled={step === 0 && !chosen}
                className="rounded-xl bg-sky-500 px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-40 active:bg-sky-600"
              >
                Next
              </button>
            )}
          </div>
        </div>

        {/* ── Live results, always on screen ── */}
        <div ref={resultsRef} className="scroll-mt-4 mt-4 space-y-3">
          {!chosen ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
              <p className="text-sm text-slate-500">
                Pick a fork, shock or dropper and your dates appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  You're due
                </h2>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${toneCls}`}>
                  {sev.text}
                </span>
              </div>

              {result.components.map(c => (
                <div key={c.part} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-baseline gap-2">
                    <h3 className="text-[15px] font-bold text-slate-900">{c.label}</h3>
                    {c.brand && (
                      <span className="text-[11px] font-semibold text-slate-400">
                        {c.brand === 'Rockshox' ? 'RockShox' : c.brand}
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-50">
                    {c.services.map(s => (
                      <div key={s.key}
                        className={`px-4 py-3 flex items-baseline justify-between gap-3 ${
                          s.overdue ? 'bg-red-50/60' : ''
                        }`}>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-slate-800">{s.label}</p>
                          <p className="text-[11px] text-slate-400 leading-snug">{s.blurb}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {s.unknown ? (
                            <>
                              <p className="text-[14px] font-bold text-red-600">Due now</p>
                              <p className="text-[11px] text-red-400">no record of one</p>
                            </>
                          ) : s.overdue ? (
                            <>
                              <p className="text-[14px] font-bold text-red-600">Overdue</p>
                              <p className="text-[11px] text-red-400 tabular-nums">
                                {s.monthsOverdue < 1
                                  ? 'due this month'
                                  : `by ~${s.monthsOverdue} month${s.monthsOverdue === 1 ? '' : 's'}`}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[14px] font-bold text-slate-900">
                                {s.date ? format(s.date, 'MMM yyyy') : '—'}
                              </p>
                              <p className="text-[11px] text-slate-400 tabular-nums">
                                {s.capped
                                  ? s.capMonths === 12
                                    ? 'time, not hours'
                                    : `${s.capMonths} months, not hours`
                                  : `~${s.hoursRemaining} hrs riding away`}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <a href="/book"
                  className="flex-1 rounded-xl bg-sky-500 px-4 py-3 text-center text-[15px] font-bold text-white active:bg-sky-600">
                  Book a service
                </a>
                <button type="button" onClick={share}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] font-semibold text-slate-700 active:bg-slate-50">
                  {copied ? 'Copied' : 'Share'}
                </button>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              How this is worked out
            </h2>
            <p className="text-[12px] text-slate-500 leading-relaxed mt-2">
              We start from the manufacturer's hour-based interval, then weigh each month by how
              hard it is on suspension round here. A wet January hour in the Tweed Valley costs
              your fork far more than a dry July hour on hardpack, so the dates shift accordingly.
              Jet washing, uplift days and hard riding all shorten the gap.
            </p>
            <p className="text-[12px] text-slate-400 leading-relaxed mt-2">
              It's an estimate to plan around, not a diagnosis. If it feels harsh, sounds dry or
              is leaking, bring it in sooner — and anything that's been sat unused for a season
              is worth a look regardless of hours.
            </p>
          </div>

          <p className="text-center text-[11px] text-slate-400 pt-1">
            Flow State Suspension Ltd · Edinburgh ·{' '}
            <a href="https://www.flowstatesuspension.co.uk" className="underline">
              flowstatesuspension.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
