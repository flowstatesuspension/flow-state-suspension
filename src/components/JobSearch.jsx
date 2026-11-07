import { useState, useMemo, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'

// Job number, customer name, or a brand/model. Numbers win outright — a
// customer quoting 10042 should land on that job, not a list of maybes.
function rank(job, q) {
  const num = String(job.job_number ?? '')
  const name = (job.customers?.name || '').toLowerCase()
  const units = (job.units || [])
    .map(u => [u.brand, u.model, u.serial_number].filter(Boolean).join(' ').toLowerCase())
    .join(' ')

  if (num && num === q) return 100
  if (num && num.startsWith(q)) return 80
  if (name.startsWith(q)) return 60
  if (name.includes(q)) return 40
  if (units.includes(q)) return 20
  return 0
}

export default function JobSearch({ jobs, requests = [], onPick, onClose }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const term = q.trim().toLowerCase()
  const isNumber = /^\d+$/.test(term)

  const results = useMemo(() => {
    if (!term) return []
    // Bookings not yet accepted have a number but no job behind them
    const pending = requests
      .filter(r => r.status === 'pending')
      .map(r => ({
        id: r.id,
        job_number: r.job_number,
        customers: { name: r.name },
        units: Array.isArray(r.items) ? r.items : [],
        drop_off_date: r.slot_date,
        __pending: true,
      }))
    return [...jobs, ...pending]
      .map(j => ({ job: j, score: rank(j, term) }))
      .filter(r => r.score > 0)
      .sort((a, b) =>
        b.score - a.score ||
        (b.job.drop_off_date || '').localeCompare(a.job.drop_off_date || ''))
      .slice(0, 25)
  }, [jobs, requests, term])

  return (
    <div className="fixed inset-0 z-50 flex flex-col px-4 pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-2xl overflow-hidden shadow-xl flex flex-col max-h-[70vh]"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            inputMode="search"
            placeholder="Job number, name, or brand…"
            className="flex-1 text-[15px] text-slate-900 outline-none placeholder-slate-400 bg-transparent"
          />
          <button onClick={onClose} className="text-slate-400 active:text-slate-600 shrink-0 p-1" aria-label="Close search">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-2 space-y-1.5">
          {!q.trim() ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Search by job number, customer name, brand or serial
            </p>
          ) : results.length === 0 ? (
            <div className="text-center py-6 px-4">
              <p className="text-sm text-slate-500">
                {isNumber ? `No job ${q.trim()}` : `Nothing matches “${q.trim()}”`}
              </p>
              {isNumber && (
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  It may have been deleted, archived, or the number misheard.
                  Archived jobs are only on the customer's record.
                </p>
              )}
            </div>
          ) : results.map(({ job }) => (
            <button key={job.id} disabled={job.__pending}
              onClick={() => { if (!job.__pending) { onPick(job); onClose() } }}
              className="w-full flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left active:bg-slate-50">
              <span className="font-mono text-[12px] font-bold text-slate-500 shrink-0 tabular-nums">
                {job.job_number ?? '—'}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold text-slate-900 truncate">
                  {job.customers?.name || '—'}
                </span>
                <span className="block text-[11px] text-slate-400 truncate">
                  {(job.units || []).map(u => [u.brand, u.model].filter(Boolean).join(' ')).join(' · ') || 'No units'}
                </span>
              </span>
              {job.__pending ? (
                <span className="text-[10px] font-bold text-amber-600 shrink-0">Not accepted</span>
              ) : job.drop_off_date && (
                <span className="text-[10px] text-slate-400 shrink-0">
                  {format(parseISO(job.drop_off_date), 'd MMM yy')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
