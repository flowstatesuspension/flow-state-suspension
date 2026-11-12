import { useState, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { estimate, severityLabel } from '../lib/serviceIntervals'

// Public service interval estimator. Served at /intervals with no login.
//
// Entirely client side — it touches no table and needs no key, so it can be
// linked or iframed from the main site without widening anything. The only
// thing it knows about the workshop is the link through to /book.

const BRANDS = ['Fox', 'Rockshox', 'Other']

const STYLES = [
  { key: 'casual', label: 'Casual',  hint: 'Towpaths, fire road, the odd blue' },
  { key: 'trail',  label: 'Trail',   hint: 'Red routes, natural singletrack' },
  { key: 'enduro', label: 'Enduro',  hint: 'Steep, fast, racing or training for it' },
  { key: 'park',   label: 'DH / Park', hint: 'Uplift days and bike park laps' },
]

const TERRAINS = [
  { key: 'local',   label: 'Local loops',    hint: 'Pentlands, peat and puddles' },
  { key: 'centre',  label: 'Trail centres',  hint: 'Glentress, Innerleithen, Tweed Valley grit' },
  { key: 'natural', label: 'Big mountain',   hint: 'Highlands, Torridon, long natural days' },
  { key: 'uplift',  label: 'Uplift & park',  hint: 'Fort William, Innerleithen uplift' },
  { key: 'dry',     label: 'Mostly dry',     hint: 'Hardpack and gravel, fair weather only' },
]

const DEFAULTS = {
  components: { fork: 'Fox', shock: 'Fox', dropper: false },
  rideMinutes: 120,
  ridesPerWeek: 2,
  style: 'trail',
  terrain: 'centre',
  jetwash: false,
  ridesYearRound: true,
}

// ── URL round-trip, so shared dates open on the same answers ───────────────

function encode(p) {
  const q = new URLSearchParams()
  if (p.components.fork) q.set('f', p.components.fork)
  if (p.components.shock) q.set('s', p.components.shock)
  if (p.components.dropper) q.set('d', '1')
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
    rideMinutes: int(q.get('m'), 30, 360, DEFAULTS.rideMinutes),
    ridesPerWeek: int(q.get('r'), 1, 14, DEFAULTS.ridesPerWeek),
    style: STYLES.some(s => s.key === q.get('y')) ? q.get('y') : DEFAULTS.style,
    terrain: TERRAINS.some(t => t.key === q.get('t')) ? q.get('t') : DEFAULTS.terrain,
    jetwash: q.get('w') === '1',
    ridesYearRound: q.get('o') !== '1',
  }
}

// ── Bits ───────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4">
      <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Chip({ on, onClick, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
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
        <span className="text-[13px] font-bold text-slate-900 tabular-nums">{display}</span>
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
function ComponentRow({ label, value, onChange, brands = true }) {
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
        <span
          className={`w-11 h-6 rounded-full relative transition shrink-0 ${
            on ? 'bg-sky-500' : 'bg-slate-200'
          }`}
        >
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
            <button
              key={b}
              type="button"
              onClick={() => onChange(b)}
              className={`rounded-lg px-2 py-1.5 text-[12px] font-semibold border transition ${
                value === b
                  ? 'border-sky-500 bg-sky-50 text-sky-900'
                  : 'border-slate-200 bg-white text-slate-500 active:bg-slate-50'
              }`}
            >
              {b === 'Rockshox' ? 'RockShox' : b}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function IntervalScreen() {
  const [p, setP] = useState(() => decode() ?? DEFAULTS)
  const [copied, setCopied] = useState(false)

  const set = patch => setP(prev => ({ ...prev, ...patch }))
  const setComponent = (key, value) =>
    setP(prev => ({ ...prev, components: { ...prev.components, [key]: value } }))

  const result = useMemo(() => estimate(p), [p])
  const sev = severityLabel(result.severity)
  const nothingPicked = result.components.length === 0

  // Keep the address bar in step so a copied URL carries the answers
  useEffect(() => {
    const url = `${window.location.pathname}?${encode(p)}`
    window.history.replaceState(null, '', url)
  }, [p])

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

      <div className="max-w-xl mx-auto px-4 py-4 space-y-3 pb-10">
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Manufacturer service intervals assume dry, clean conditions. Scotland is neither.
          Tell us how and where you ride and we'll work out when your suspension is actually
          due, based on the hours you'll put through it and what those hours cost it.
        </p>

        <Section title="What's on the bike?">
          <div className="space-y-2">
            <ComponentRow
              label="Fork"
              value={p.components.fork}
              onChange={v => setComponent('fork', v)}
            />
            <ComponentRow
              label="Rear shock"
              value={p.components.shock}
              onChange={v => setComponent('shock', v)}
            />
            <ComponentRow
              label="Dropper post"
              value={p.components.dropper}
              onChange={v => setComponent('dropper', v)}
              brands={false}
            />
          </div>
        </Section>

        <Section title="How much do you ride?">
          <div className="space-y-4">
            <Slider
              label="A typical ride"
              value={p.rideMinutes}
              display={
                p.rideMinutes >= 60
                  ? `${Math.floor(p.rideMinutes / 60)}h${p.rideMinutes % 60 ? ` ${p.rideMinutes % 60}m` : ''}`
                  : `${p.rideMinutes}m`
              }
              min={30}
              max={360}
              step={15}
              onChange={v => set({ rideMinutes: v })}
            />
            <Slider
              label="Rides a week"
              value={p.ridesPerWeek}
              display={p.ridesPerWeek}
              min={1}
              max={10}
              step={1}
              onChange={v => set({ ridesPerWeek: v })}
            />
            <p className="text-[12px] text-slate-400 -mt-1">
              That's about <strong className="text-slate-600">{result.hoursPerWeek.toFixed(1)} hours
              a week</strong> on the bike.
            </p>
          </div>
        </Section>

        <Section title="How do you ride?">
          <div className="space-y-2">
            {STYLES.map(s => (
              <Chip
                key={s.key}
                on={p.style === s.key}
                onClick={() => set({ style: s.key })}
                label={s.label}
                hint={s.hint}
              />
            ))}
          </div>
        </Section>

        <Section title="Where do you ride?">
          <div className="space-y-2">
            {TERRAINS.map(t => (
              <Chip
                key={t.key}
                on={p.terrain === t.key}
                onClick={() => set({ terrain: t.key })}
                label={t.label}
                hint={t.hint}
              />
            ))}
          </div>
        </Section>

        <Section title="Through the winter">
          <div className="space-y-2">
            <Chip
              on={p.ridesYearRound}
              onClick={() => set({ ridesYearRound: true })}
              label="All year, whatever it's doing"
              hint="Winter hours are the ones that wear seals out"
            />
            <Chip
              on={!p.ridesYearRound}
              onClick={() => set({ ridesYearRound: false })}
              label="I ease off when it's grim"
              hint="Far less riding from November to February"
            />
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 mt-2">
              <input
                type="checkbox"
                checked={p.jetwash}
                onChange={e => set({ jetwash: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-sky-500 shrink-0"
              />
              <span>
                <span className="block text-[14px] font-semibold text-slate-800">
                  I jet wash the bike after most rides
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5 leading-snug">
                  A pressure washer drives water and grit straight past the dust wipers
                </span>
              </span>
            </label>
          </div>
        </Section>

        {/* ── Results ── */}
        {nothingPicked ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm text-slate-500">
              Switch on a fork, shock or dropper above to see your dates.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between pt-2">
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
                    <div key={s.key} className="px-4 py-3 flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-slate-800">{s.label}</p>
                        <p className="text-[11px] text-slate-400 leading-snug">{s.blurb}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-bold text-slate-900">
                          {s.date ? format(s.date, 'MMM yyyy') : '—'}
                        </p>
                        <p className="text-[11px] text-slate-400 tabular-nums">
                          {s.capped
                            ? s.capMonths === 12
                              ? 'time, not hours'
                              : `${s.capMonths} months, not hours`
                            : `~${s.ridingHours} hrs riding`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <a
                href="/book"
                className="flex-1 rounded-xl bg-sky-500 px-4 py-3 text-center text-[15px] font-bold text-white active:bg-sky-600"
              >
                Book a service
              </a>
              <button
                type="button"
                onClick={share}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] font-semibold text-slate-700 active:bg-slate-50"
              >
                {copied ? 'Copied' : 'Share'}
              </button>
            </div>
          </>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 mt-2">
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

        <p className="text-center text-[11px] text-slate-400 pt-2">
          Flow State Suspension Ltd · Edinburgh ·{' '}
          <a href="https://www.flowstatesuspension.co.uk" className="underline">
            flowstatesuspension.co.uk
          </a>
        </p>
      </div>
    </div>
  )
}
