import { useState } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { rankCustomerMatches, suggestAction } from '../lib/bookingMatch'

const CONFIDENCE_STYLE = {
  strong:   { label: 'Strong match',   bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
  possible: { label: 'Possible match', bg: '#fff7ed', border: '#fdba74', text: '#ea580c' },
  weak:     { label: 'Weak match',     bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' },
}

function itemsOf(req) {
  return Array.isArray(req.items) ? req.items : []
}

// ── One pending request ──────────────────────────────────────────────────────
function RequestCard({ req, customers, defaultPrice, onAccept, onReject }) {
  const { matches, conflict } = rankCustomerMatches(req, customers)
  const suggested = suggestAction({ matches, conflict })

  // Preselect the obvious answer, but never act on it without a tap
  const [choice, setChoice] = useState(
    suggested === 'attach' && matches[0] ? matches[0].customer.id : 'new'
  )
  const [busy, setBusy] = useState(null) // 'accept' | 'reject'
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const items = itemsOf(req)
  const visibleMatches = showAll ? matches : matches.slice(0, 3)

  async function run(action, fn) {
    setBusy(action); setError(null)
    try { await fn() }
    catch (e) { setError(e?.message || 'Could not save that.'); setBusy(null) }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3.5 py-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-slate-900 leading-tight">{req.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {req.phone}{req.email ? ` · ${req.email}` : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-bold text-slate-700">
              {format(parseISO(req.slot_date), 'EEE d MMM')}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              sent {format(parseISO(req.created_at), 'd MMM, HH:mm')}
            </p>
          </div>
        </div>
      </div>

      <div className="px-3.5 py-3 space-y-2 border-b border-slate-100">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-800">
                {[it.brand, it.model].filter(Boolean).join(' ') || 'Unspecified'}
              </p>
              {it.serial_number && (
                <p className="text-[11px] text-slate-400 font-mono">{it.serial_number}</p>
              )}
              {it.notes && <p className="text-[11px] text-slate-500 mt-0.5">{it.notes}</p>}
            </div>
          </div>
        ))}
        {req.notes && (
          <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-50">{req.notes}</p>
        )}
      </div>

      {/* Customer decision */}
      <div className="px-3.5 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</p>
          {conflict && (
            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
              Phone and email disagree
            </span>
          )}
        </div>

        {visibleMatches.map(m => {
          const cs = CONFIDENCE_STYLE[m.confidence]
          const selected = choice === m.customer.id
          return (
            <button key={m.customer.id} onClick={() => setChoice(m.customer.id)}
              className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                selected ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500/25' : 'border-slate-200 active:bg-slate-50'
              }`}>
              <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                selected ? 'border-sky-500' : 'border-slate-300'
              }`}>
                {selected && <span className="w-2 h-2 rounded-full bg-sky-500 block" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold text-slate-800 truncate">{m.customer.name}</span>
                <span className="block text-[10px] text-slate-400 truncate">{m.reasons.join(' · ')}</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>
                {cs.label}
              </span>
            </button>
          )
        })}

        {matches.length > 3 && !showAll && (
          <button onClick={() => setShowAll(true)} className="text-[11px] font-semibold text-sky-600">
            Show {matches.length - 3} more
          </button>
        )}

        <button onClick={() => setChoice('new')}
          className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
            choice === 'new' ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500/25' : 'border-slate-200 active:bg-slate-50'
          }`}>
          <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
            choice === 'new' ? 'border-sky-500' : 'border-slate-300'
          }`}>
            {choice === 'new' && <span className="w-2 h-2 rounded-full bg-sky-500 block" />}
          </span>
          <span className="flex-1 text-[13px] font-semibold text-slate-800">
            Create new customer
            {!matches.length && <span className="text-[10px] font-normal text-slate-400 ml-1.5">nothing matched</span>}
          </span>
        </button>
      </div>

      {error && (
        <div className="mx-3.5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[11px] text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2 px-3.5 pb-3.5">
        <button
          onClick={() => run('accept', () => onAccept(req, choice === 'new' ? null : choice, defaultPrice))}
          disabled={!!busy}
          className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white text-[13px] font-bold active:bg-sky-600 disabled:opacity-50">
          {busy === 'accept' ? 'Accepting…' : 'Accept booking'}
        </button>
        <button onClick={() => run('reject', () => onReject(req))} disabled={!!busy}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[13px] font-semibold active:bg-slate-50 disabled:opacity-50">
          {busy === 'reject' ? '…' : 'Reject'}
        </button>
      </div>
    </div>
  )
}

// ── Availability ─────────────────────────────────────────────────────────────
function SlotManager({ slots, onAdd, onUpdate, onRemove }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [capacity, setCapacity] = useState(2)
  const [error, setError] = useState(null)
  const upcoming = slots.filter(s => s.slot_date >= todayStr)

  async function add() {
    setError(null)
    try { await onAdd(date, capacity) }
    catch (e) {
      setError(/duplicate|unique/i.test(e?.message || '') ? 'That day is already open.' : (e?.message || 'Could not add that day.'))
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Days open for booking</p>
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          Only these days appear on your booking page. When a day is full it drops off automatically.
        </p>
      </div>

      <div className="flex gap-2">
        <input type="date" value={date} min={todayStr} onChange={e => setDate(e.target.value)}
          className="flex-1 min-w-0 text-sm border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-sky-500" />
        <input type="number" min={1} max={20} value={capacity}
          onChange={e => setCapacity(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 text-sm border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-sky-500"
          aria-label="Places available" />
        <button onClick={add}
          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold active:bg-slate-700">
          Open
        </button>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {upcoming.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2">
          No days open — your booking page will tell people to message you instead.
        </p>
      ) : (
        <div className="space-y-1.5">
          {upcoming.map(s => {
            const full = s.booked_count >= s.capacity
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">
                    {format(parseISO(s.slot_date), 'EEE d MMM')}
                  </p>
                  <p className={`text-[10px] ${full ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                    {s.booked_count} of {s.capacity} taken{full ? ' · full' : ''}
                  </p>
                </div>
                <input type="number" min={s.booked_count || 1} max={20} value={s.capacity}
                  onChange={e => onUpdate(s.id, Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 text-xs border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-sky-500"
                  aria-label={`Places on ${s.slot_date}`} />
                <button onClick={() => onRemove(s.id)} className="text-slate-300 active:text-red-500 shrink-0 p-1"
                  aria-label={`Close ${s.slot_date}`}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AutoBookScreen({
  bookingRequests = [], bookingSlots = [], customers = [], settings,
  acceptBooking, rejectBooking, addBookingSlot, updateBookingSlot, removeBookingSlot,
}) {
  const [tab, setTab] = useState('queue')
  const pending = bookingRequests.filter(r => r.status === 'pending')
  const decided = bookingRequests.filter(r => r.status !== 'pending').slice(0, 25)
  const bookingUrl = `${window.location.origin}/book`
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard?.writeText(bookingUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-black safe-top shrink-0">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
            <div className="flex-1">
              <h1 className="text-white font-bold text-lg leading-none tracking-tight">Work State</h1>
              <p className="text-slate-400 text-xs mt-1">Auto Book</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-lg leading-none">{pending.length}</p>
              <p className="text-slate-400 text-[10px] mt-0.5">waiting</p>
            </div>
          </div>
          <div className="flex bg-white/10 rounded-lg p-0.5 gap-0.5">
            {[['queue', `Queue${pending.length ? ` (${pending.length})` : ''}`], ['slots', 'Availability'], ['done', 'Decided']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  tab === id ? 'bg-white text-slate-900' : 'text-slate-400'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-2xl mx-auto p-4 space-y-3">

          {tab === 'queue' && (
            <>
              <button onClick={copyLink}
                className="w-full flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-left active:bg-sky-100">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-sky-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-sky-700">
                    {copied ? 'Link copied' : 'Your booking link'}
                  </p>
                  <p className="text-[11px] text-sky-600/80 truncate font-mono">{bookingUrl}</p>
                </div>
              </button>

              {pending.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <p className="text-sm font-semibold text-slate-500">Nothing waiting</p>
                  <p className="text-xs text-slate-400 mt-1">New bookings land here for you to accept.</p>
                </div>
              ) : (
                pending.map(req => (
                  <RequestCard key={req.id} req={req} customers={customers}
                    defaultPrice={settings?.defaultUnitPrice ?? 120}
                    onAccept={acceptBooking} onReject={rejectBooking} />
                ))
              )}
            </>
          )}

          {tab === 'slots' && (
            <SlotManager slots={bookingSlots} onAdd={addBookingSlot}
              onUpdate={updateBookingSlot} onRemove={removeBookingSlot} />
          )}

          {tab === 'done' && (
            decided.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-400">Nothing decided yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {decided.map(r => (
                  <div key={r.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-3 py-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.status === 'accepted' ? 'bg-green-500' : 'bg-slate-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{r.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {itemsOf(r).map(i => [i.brand, i.model].filter(Boolean).join(' ')).join(' · ')}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold shrink-0 ${
                      r.status === 'accepted' ? 'text-green-600' : 'text-slate-400'
                    }`}>
                      {r.status === 'accepted' ? 'Accepted' : 'Rejected'}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}

        </div>
      </div>
    </div>
  )
}
