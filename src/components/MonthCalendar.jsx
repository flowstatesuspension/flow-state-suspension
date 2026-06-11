import { useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, parseISO,
  addMonths, subMonths, isSameMonth, isToday, isWithinInterval,
} from 'date-fns'
import { STATUS_CONFIG, STATUS_ORDER } from '../constants'

export default function MonthCalendar({ jobs, onJobClick, viewMode }) {
  const [anchor, setAnchor] = useState(new Date())

  const monthStart = startOfMonth(anchor)
  const monthEnd = endOfMonth(anchor)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const visibleJobs = jobs.filter(j => {
    if (!j.drop_off_date || !j.pickup_date) return false
    if (viewMode === 'work' && j.units?.every(u => u.status === 'complete')) return false
    return true
  })

  const allVisibleUnits = visibleJobs.flatMap(j => j.units || [])
  const totalUnits = allVisibleUnits.length

  function jobsOnDay(day) {
    const dayStr = format(day, 'yyyy-MM-dd')
    return visibleJobs.filter(j => {
      if (viewMode === 'booking') return j.drop_off_date === dayStr
      if (!j.pickup_date) return j.drop_off_date === dayStr
      return isWithinInterval(day, { start: parseISO(j.drop_off_date), end: parseISO(j.pickup_date) })
    })
  }

  function jobColor(job) {
    const statuses = job.units?.map(u => u.status) || ['booked_in']
    const priority = ['awaiting_parts', 'in_progress', 'ready', 'booked_in', 'complete']
    const top = priority.find(s => statuses.includes(s)) || 'booked_in'
    return STATUS_CONFIG[top]?.bg || '#94a3b8'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Month navigator */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <button
          onClick={() => setAnchor(m => subMonths(m, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 text-lg"
        >‹</button>
        <span className="text-sm font-semibold text-slate-700">{format(anchor, 'MMMM yyyy')}</span>
        <button
          onClick={() => setAnchor(m => addMonths(m, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 text-lg"
        >›</button>
      </div>

      {/* Colour key with counts */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 shrink-0">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CONFIG[s]
            const count = allVisibleUnits.filter(u => u.status === s).length
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.bg }} />
                <span className="text-[11px] text-slate-600 font-medium">{cfg.label}</span>
                <span className="text-[11px] font-bold text-slate-800">{count}</span>
              </div>
            )
          })}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Total</span>
            <span className="text-[11px] font-bold text-slate-900">{totalUnits}</span>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-white border-b border-slate-200 shrink-0">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="py-1.5 text-center text-[10px] font-semibold text-slate-400 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="flex-1 overflow-auto scrollbar-none">
        <div className="grid grid-cols-7 h-full" style={{ gridAutoRows: 'minmax(64px, 1fr)' }}>
          {days.map(day => {
            const dayJobs = jobsOnDay(day)
            const inMonth = isSameMonth(day, anchor)
            const today = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className={`border-b border-r border-slate-100 p-1 flex flex-col ${inMonth ? '' : 'bg-slate-50'}`}
              >
                <span
                  className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${
                    today ? 'bg-sky-500 text-white' : inMonth ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayJobs.slice(0, 3).map(job => (
                    <button
                      key={job.id}
                      onClick={() => onJobClick(job)}
                      className="text-left rounded px-1 py-0.5 text-[9px] font-semibold text-white leading-tight truncate"
                      style={{ backgroundColor: jobColor(job) }}
                    >
                      {job.customers?.name?.split(' ')[0] || '—'}
                    </button>
                  ))}
                  {dayJobs.length > 3 && (
                    <span className="text-[9px] text-slate-400 px-1">+{dayJobs.length - 3} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
