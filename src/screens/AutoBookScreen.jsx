import { useState } from 'react'
import { format, parseISO, addDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { rankCustomerMatches, suggestAction } from '../lib/bookingMatch'
import MonthGrid from '../components/MonthGrid'
import JobModal from '../components/JobModal'
import { BOOKING_HORIZON_DAYS, confirmationMessage, waLink } from '../lib/booking'

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

  const whatsapp = waLink(req.phone, confirmationMessage({
    name: req.name,
    dateLabel: format(parseISO(req.slot_date), 'EEEE d MMMM'),
    items,
  }))

  async function run(action, fn) {
    setBusy(action); setError(null)
    try { await fn() }
    catch (e) { setError(e?.message || 'Could not save that.'); setBusy(null) }
  }

  // Accept, then hand off to WhatsApp with the confirmation written out.
  // The tab is opened synchronously inside the tap — iOS blocks window.open
  // once an await has broken the user-gesture chain — then pointed at the link
  // only if the accept actually succeeded, and closed if it didn't.
  async function acceptAndMessage() {
    setBusy('accept'); setError(null)
    const win = window.open('', '_blank')
    try {
      await onAccept(req, choice === 'new' ? null : choice, defaultPrice)
      if (win && !win.closed) win.location.href = whatsapp
      else window.location.href = whatsapp
    } catch (e) {
      if (win && !win.closed) win.close()
      setError(e?.message || 'Could not save that.')
      setBusy(null)
    }
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

      <div className="px-3.5 pb-3.5 space-y-2">
        {whatsapp && (
          <button onClick={acceptAndMessage} disabled={!!busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-[13px] font-bold active:brightness-95 disabled:opacity-50"
            style={{ backgroundColor: '#25D366' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden="true">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.057 23.885a.5.5 0 0 0 .612.612l6.03-1.474A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.528-5.2-1.444l-.373-.222-3.868.945.965-3.868-.241-.384A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
            </svg>
            {busy === 'accept' ? 'Accepting…' : 'Accept & WhatsApp'}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => run('accept', () => onAccept(req, choice === 'new' ? null : choice, defaultPrice))}
            disabled={!!busy}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50 ${
              whatsapp
                ? 'bg-white border border-slate-200 text-slate-700 active:bg-slate-50'
                : 'bg-sky-500 text-white active:bg-sky-600'
            }`}>
            {busy === 'accept' && !whatsapp ? 'Accepting…' : whatsapp ? 'Accept only' : 'Accept booking'}
          </button>
          <button onClick={() => run('reject', () => onReject(req))} disabled={!!busy}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[13px] font-semibold active:bg-slate-50 disabled:opacity-50">
            {busy === 'reject' ? '…' : 'Reject'}
          </button>
        </div>
        {!whatsapp && (
          <p className="text-[10px] text-slate-400 text-center">
            No WhatsApp option — {req.phone ? "couldn't read that phone number" : 'no phone number given'}
          </p>
        )}
      </div>
    </div>
  )
}

// ── What's arriving on a given day ───────────────────────────────────────────
function DayUnitsModal({ dateStr, jobs, requests, onSelectJob, onGoToQueue, onClose }) {
  const dayJobs = jobs.filter(j => j.drop_off_date === dateStr)
  const dayReqs = requests.filter(r => r.status === 'pending' && r.slot_date === dateStr)
  const unitsOf = j => (j.units || []).map(u => [u.brand, u.model].filter(Boolean).join(' ')).filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-800">{format(parseISO(dateStr), 'EEEE d MMMM')}</p>
          <button onClick={onClose} className="text-slate-400 active:text-slate-600" aria-label="Close">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-96 p-3 space-y-2">
          {dayJobs.map(job => (
            <button key={job.id} onClick={() => { onSelectJob(job); onClose() }}
              className="w-full flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 text-left active:bg-slate-100"
              style={{ borderLeft: '4px solid #0ea5e9' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{job.customers?.name || '—'}</p>
                <p className="text-xs text-slate-400 truncate">{unitsOf(job).join(', ') || 'No units'}</p>
                {job.pickup_date && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Pickup {format(parseISO(job.pickup_date), 'd MMM yyyy')}
                  </p>
                )}
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}

          {dayReqs.map(req => (
            <button key={req.id} onClick={() => { onGoToQueue(); onClose() }}
              className="w-full flex items-center gap-3 bg-amber-50 rounded-xl px-3 py-2.5 text-left active:bg-amber-100"
              style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{req.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {itemsOf(req).map(i => [i.brand, i.model].filter(Boolean).join(' ')).filter(Boolean).join(', ') || 'No units'}
                </p>
                <p className="text-[10px] font-bold text-amber-600 mt-0.5">Waiting for you to accept</p>
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-amber-300" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}

          {dayJobs.length === 0 && dayReqs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Nothing due in that day</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Availability ─────────────────────────────────────────────────────────────
// Every day is bookable by default. Tapping one closes it; tapping again
// reopens it. Bookings never close a day — that stays your call.
function AvailabilityCalendar({ closures, requests, jobs, onToggle, onToggleMany, onShowDay }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [error, setError] = useState(null)

  const closedSet = new Set(closures.map(c => c.closed_date))
  const horizonStr = format(addDays(new Date(), BOOKING_HORIZON_DAYS), 'yyyy-MM-dd')

  // Units arriving each day, however they were booked — jobs you entered
  // yourself count the same as ones that came through the booking page.
  // Accepting a request creates a job, so counting all jobs plus only the
  // still-pending requests covers everything without double counting.
  const unitCount = {}
  const add = (date, n) => { if (date && n) unitCount[date] = (unitCount[date] || 0) + n }

  jobs.forEach(j => add(j.drop_off_date, (j.units || []).length))
  requests
    .filter(r => r.status === 'pending')
    .forEach(r => add(r.slot_date, Array.isArray(r.items) ? r.items.length : 0))

  function getDay(dateStr) {
    return {
      closed: closedSet.has(dateStr),
      disabled: dateStr < todayStr || dateStr > horizonStr,
      count: unitCount[dateStr] || 0,
    }
  }

  async function toggle(dateStr) {
    setError(null)
    try { await onToggle(dateStr, !closedSet.has(dateStr)) }
    catch (e) { setError(e?.message || 'Could not save that.') }
  }

  // Tap a weekday header to shut or reopen that whole column for the month
  async function toggleWeekday(weekdayIndex) {
    const first = startOfMonth(month)
    const last = endOfMonth(month)
    const dates = eachDayOfInterval({ start: first, end: last })
      .filter(d => ((d.getDay() + 6) % 7) === weekdayIndex)
      .map(d => format(d, 'yyyy-MM-dd'))
      .filter(ds => ds >= todayStr && ds <= horizonStr)
    if (!dates.length) return
    // If any are still open, close the lot; otherwise reopen them
    const shouldClose = dates.some(ds => !closedSet.has(ds))
    setError(null)
    try { await onToggleMany(dates, shouldClose) }
    catch (e) { setError(e?.message || 'Could not save that.') }
  }

  const closedThisMonth = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
    .filter(d => closedSet.has(format(d, 'yyyy-MM-dd'))).length

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 p-3.5">
        <div className="mb-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">When you'll take drop-offs</p>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Every day is open unless you close it. Tap a date to close it, tap again to reopen.
            Tap a weekday name to do the whole column.
          </p>
        </div>

        <MonthGrid
          month={month}
          onPrev={() => setMonth(m => subMonths(m, 1))}
          onNext={() => setMonth(m => addMonths(m, 1))}
          canPrev={format(month, 'yyyy-MM') > format(new Date(), 'yyyy-MM')}
          canNext={format(month, 'yyyy-MM') < format(addDays(new Date(), BOOKING_HORIZON_DAYS), 'yyyy-MM')}
          getDay={getDay}
          onDayClick={toggle}
          onWeekdayClick={toggleWeekday}
          onCountClick={onShowDay}
          availableTone="green"
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 pt-3 border-t border-slate-100">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-3 h-3 rounded border border-green-300 bg-green-50 block" /> Open
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-3 h-3 rounded border border-slate-200 bg-slate-100 block" /> Closed
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-3 h-3 rounded-full bg-amber-400 block" /> Units due in
          </span>
          {closedThisMonth > 0 && (
            <span className="ml-auto text-[10px] font-semibold text-slate-400">
              {closedThisMonth} closed this month
            </span>
          )}
        </div>

        {error && <p className="text-[11px] text-red-600 mt-2">{error}</p>}
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed px-1">
        Customers can book up to {BOOKING_HORIZON_DAYS} days ahead. Closing a day doesn't affect
        bookings already made on it — those stay in your queue.
      </p>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AutoBookScreen({
  bookingRequests = [], bookingClosures = [], customers = [], jobs = [], settings,
  acceptBooking, rejectBooking, deleteBookingRequest, setBookingClosure, setBookingClosures,
  saveJob, deleteJob, archiveJob, restoreJob, onStartTimer, activeTimer, timerStopKey,
}) {
  const [tab, setTab] = useState('queue')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [dayView, setDayView] = useState(null)   // date string
  const [editJob, setEditJob] = useState(null)
  const onDelete = deleteBookingRequest
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
            <AvailabilityCalendar closures={bookingClosures} requests={bookingRequests} jobs={jobs}
              onToggle={setBookingClosure} onToggleMany={setBookingClosures}
              onShowDay={setDayView} />
          )}

          {tab === 'done' && (
            decided.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-400">Nothing decided yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {decided.map(r => {
                  const jobGone = r.status === 'accepted' && !r.job_id
                  return (
                    <div key={r.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 pl-3 pr-2 py-2.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        jobGone ? 'bg-slate-200' : r.status === 'accepted' ? 'bg-green-500' : 'bg-slate-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-semibold truncate ${jobGone ? 'text-slate-400' : 'text-slate-800'}`}>
                          {r.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {itemsOf(r).map(i => [i.brand, i.model].filter(Boolean).join(' ')).join(' · ')}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 ${
                        jobGone ? 'text-slate-400' : r.status === 'accepted' ? 'text-green-600' : 'text-slate-400'
                      }`}>
                        {jobGone ? 'Job deleted' : r.status === 'accepted' ? 'Accepted' : 'Rejected'}
                      </span>
                      {onDelete && (
                        <button
                          onClick={() => setConfirmDelete(confirmDelete === r.id ? null : r.id)}
                          className="shrink-0 p-1 text-slate-300 active:text-red-500"
                          aria-label={`Remove ${r.name}'s booking record`}>
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.35 9m-4.78 0L9.26 9m9.97-3.21c.34.05.68.1 1.02.16M3.75 5.79A48.1 48.1 0 0 1 7.5 5.4m0 0v-1.5a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5v1.5m-9 0h9" />
                          </svg>
                        </button>
                      )}
                      {confirmDelete === r.id && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-slate-400 px-1">No</button>
                          <button onClick={async () => { await onDelete(r.id); setConfirmDelete(null) }}
                            className="text-[10px] font-bold text-red-500 px-1">Delete</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

        </div>
      </div>

      {dayView && (
        <DayUnitsModal
          dateStr={dayView}
          jobs={jobs}
          requests={bookingRequests}
          onSelectJob={setEditJob}
          onGoToQueue={() => setTab('queue')}
          onClose={() => setDayView(null)}
        />
      )}

      {editJob && (
        <JobModal job={editJob} customers={customers}
          onSave={saveJob} onDelete={deleteJob} onArchive={archiveJob} onRestore={restoreJob}
          onClose={() => setEditJob(null)}
          settings={settings}
          onStartTimer={onStartTimer} activeTimer={activeTimer} timerStopKey={timerStopKey} />
      )}
    </div>
  )
}
