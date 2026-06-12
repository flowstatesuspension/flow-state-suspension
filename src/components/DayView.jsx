import { useState } from 'react'
import { format, addDays, subDays, isToday, parseISO } from 'date-fns'
import { STATUS_CONFIG } from '../constants'

function jobTotal(job) {
  return (job.units || []).reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0)
}

function jobsOnDay(jobs, date, viewMode) {
  const d = format(date, 'yyyy-MM-dd')
  return jobs.filter(job => {
    if (job.units?.length && job.units.every(u => u.status === 'complete')) return false
    if (viewMode === 'booking') {
      return job.drop_off_date === d
    }
    // work mode: job spans this day
    if (!job.drop_off_date) return false
    if (job.drop_off_date > d) return false
    if (job.pickup_date && job.pickup_date < d) return false
    return true
  })
}

export default function DayView({ jobs, onJobClick, viewMode }) {
  const [date, setDate] = useState(new Date())
  const dayJobs = jobsOnDay(jobs, date, viewMode)
  const today = isToday(date)

  return (
    <div className="flex flex-col h-full">
      {/* Day nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 bg-white">
        <button onClick={() => setDate(d => subDays(d, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 text-lg font-light">
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-800">{format(date, 'EEEE')}</p>
          <p className={`text-xs font-medium ${today ? 'text-sky-500' : 'text-slate-400'}`}>
            {today ? 'Today · ' : ''}{format(date, 'd MMM yyyy')}
          </p>
        </div>
        <button onClick={() => setDate(d => addDays(d, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 text-lg font-light">
          ›
        </button>
      </div>

      {/* Today shortcut if not already today */}
      {!today && (
        <button onClick={() => setDate(new Date())}
          className="mx-4 mt-3 py-1.5 text-xs font-semibold text-sky-600 bg-sky-50 rounded-lg border border-sky-100">
          Jump to Today
        </button>
      )}

      {/* Job list */}
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-2">
        {dayJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-slate-400 font-medium text-sm">No jobs {viewMode === 'booking' ? 'booked in' : 'open'} on this day</p>
            <p className="text-slate-300 text-xs mt-1">Use ‹ › to navigate</p>
          </div>
        ) : (
          dayJobs.map(job => (
            <button key={job.id} onClick={() => onJobClick(job)}
              onTouchEnd={e => { e.preventDefault(); onJobClick(job) }}
              className="w-full bg-white rounded-xl border border-slate-200 p-3 text-left active:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-800 text-sm">{job.customers?.name || '—'}</span>
                <span className="text-sm font-bold text-slate-700">£{jobTotal(job).toFixed(0)}</span>
              </div>
              <div className="flex gap-1 flex-wrap mb-1.5">
                {job.units?.map(u => (
                  <span key={u.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: STATUS_CONFIG[u.status]?.light, color: STATUS_CONFIG[u.status]?.text, border: `1px solid ${STATUS_CONFIG[u.status]?.border}` }}>
                    {u.brand} {u.model}
                  </span>
                ))}
              </div>
              {job.drop_off_date && (
                <p className="text-[10px] text-slate-400">
                  {format(parseISO(job.drop_off_date), 'd MMM')}
                  {job.pickup_date ? ` → ${format(parseISO(job.pickup_date), 'd MMM yyyy')}` : ''}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
