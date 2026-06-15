import { useState } from 'react'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  format, parseISO, isWithinInterval,
} from 'date-fns'
import GanttWeekView from '../components/GanttWeekView'
import MonthCalendar from '../components/MonthCalendar'
import DayView from '../components/DayView'
import JobModal from '../components/JobModal'

function jobsInPeriod(jobs, calView, viewMode, dayAnchor, weekAnchor, monthAnchor) {
  const d = format(dayAnchor, 'yyyy-MM-dd')
  const wo = { weekStartsOn: 1 }

  if (calView === 'day') {
    return jobs.filter(j => {
      if (j.units?.length && j.units.every(u => u.status === 'complete')) return false
      if (viewMode === 'booking') return j.drop_off_date === d
      if (!j.drop_off_date) return false
      if (j.drop_off_date > d) return false
      if (j.pickup_date && j.pickup_date < d) return false
      return true
    })
  }

  if (calView === 'week') {
    const weekStart = startOfWeek(weekAnchor, wo)
    const weekEnd   = endOfWeek(weekAnchor, wo)
    return jobs.filter(j => {
      if (!j.drop_off_date) return false
      if (viewMode === 'booking') return parseISO(j.drop_off_date) >= weekStart && parseISO(j.drop_off_date) <= weekEnd
      if (j.units?.length && j.units.every(u => u.status === 'complete')) return false
      // No pickup_date = still active; include if dropped off before week ends
      return parseISO(j.drop_off_date) <= weekEnd && (!j.pickup_date || parseISO(j.pickup_date) >= weekStart)
    })
  }

  const monthStart = startOfMonth(monthAnchor)
  const monthEnd   = endOfMonth(monthAnchor)
  return jobs.filter(j => {
    if (!j.drop_off_date) return false
    if (viewMode === 'booking') return isWithinInterval(parseISO(j.drop_off_date), { start: monthStart, end: monthEnd })
    if (j.units?.length && j.units.every(u => u.status === 'complete')) return false
    return parseISO(j.drop_off_date) <= monthEnd && (!j.pickup_date || parseISO(j.pickup_date) >= monthStart)
  })
}

function visibleJobs(jobs, calView, viewMode, dayAnchor, weekAnchor, monthAnchor) {
  const d = format(dayAnchor, 'yyyy-MM-dd')
  const wo = { weekStartsOn: 1 }

  if (calView === 'day') {
    return jobs.filter(job => {
      if (viewMode === 'booking') return job.drop_off_date === d
      if (!job.drop_off_date) return false
      if (job.drop_off_date > d) return false
      if (job.pickup_date && job.pickup_date < d) return false
      return true
    })
  }

  if (calView === 'week') {
    const weekStart = startOfWeek(weekAnchor, wo)
    const weekEnd   = endOfWeek(weekAnchor, wo)
    return jobs.filter(j => {
      if (!j.drop_off_date) return false
      if (viewMode === 'booking') {
        const dd = parseISO(j.drop_off_date)
        return dd >= weekStart && dd <= weekEnd
      }
      if (!j.pickup_date) return false
      return parseISO(j.drop_off_date) <= weekEnd && parseISO(j.pickup_date) >= weekStart
    })
  }

  // month
  const monthStart = startOfMonth(monthAnchor)
  const monthEnd   = endOfMonth(monthAnchor)
  return jobs.filter(j => {
    if (!j.drop_off_date) return false
    if (viewMode === 'booking') {
      return isWithinInterval(parseISO(j.drop_off_date), { start: monthStart, end: monthEnd })
    }
    if (!j.pickup_date) return false
    return parseISO(j.drop_off_date) <= monthEnd && parseISO(j.pickup_date) >= monthStart
  })
}

export default function JobsScreen({ jobs, customers, loading, saveJob, deleteJob, settings, onStartTimer, activeTimer, timerStopKey }) {
  const [calView, setCalView]       = useState('week')
  const [viewMode, setViewMode]     = useState('work')
  const [selectedJob, setSelectedJob] = useState(null)
  const [showModal, setShowModal]   = useState(false)
  const [dayAnchor, setDayAnchor]   = useState(new Date())
  const [weekAnchor, setWeekAnchor] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [monthAnchor, setMonthAnchor] = useState(new Date())

  const allOnHold    = job => job.units?.length > 0 && job.units.every(u => u.status === 'on_hold')
  const allComplete  = job => job.units?.length > 0 && job.units.every(u => u.status === 'complete')

  // For work view: use visibleJobs (includes complete) as the base for all counts
  const periodJobs   = viewMode === 'work'
    ? visibleJobs(jobs, calView, viewMode, dayAnchor, weekAnchor, monthAnchor)
    : jobsInPeriod(jobs, calView, viewMode, dayAnchor, weekAnchor, monthAnchor)

  const activeJobs   = periodJobs.filter(j => !allComplete(j) && !allOnHold(j))
  const completeJobs = viewMode === 'work' ? periodJobs.filter(allComplete) : []
  const onHoldJobs   = periodJobs.filter(allOnHold)

  const allUnits     = periodJobs.flatMap(j => j.units || [])
  const activeUnits  = allUnits.filter(u => u.status !== 'complete' && u.status !== 'on_hold')
  const completeUnits = allUnits.filter(u => u.status === 'complete').length
  const onHoldUnits  = allUnits.filter(u => u.status === 'on_hold').length
  const currentRevenue = allUnits.filter(u => u.status !== 'on_hold').reduce((s, u) => s + (u.price || 0), 0)

  function openNew() {
    const defaultDate = calView === 'week' ? format(weekAnchor, 'yyyy-MM-dd') : undefined
    setSelectedJob(defaultDate ? { drop_off_date: defaultDate } : null)
    setShowModal(true)
  }
  function openJob(job) { setSelectedJob(job); setShowModal(true) }
  function closeModal() { setShowModal(false); setSelectedJob(null) }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-black safe-top shrink-0">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
            <div className="flex-1">
              <h1 className="text-white font-bold text-lg leading-none tracking-tight">Work Flow</h1>
              <p className="text-slate-400 text-xs mt-1">Job Schedule</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-slate-400 text-xs">
                <span className="text-slate-500 font-medium">Jobs</span>
                {' '}{activeJobs.length} Active
                {completeJobs.length > 0 ? ` · ${completeJobs.length} Done` : ''}
                {onHoldJobs.length > 0 ? ` · ${onHoldJobs.length} Hold` : ''}
              </p>
              <p className="text-slate-400 text-xs">
                <span className="text-slate-500 font-medium">Units</span>
                {' '}{activeUnits.length} Active
                {completeUnits > 0 ? ` · ${completeUnits} Done` : ''}
                {onHoldUnits > 0 ? ` · ${onHoldUnits} Hold` : ''}
              </p>
              <p className="text-slate-600 text-xs font-semibold">£{currentRevenue.toFixed(0)}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex bg-white/10 rounded-lg p-0.5">
              {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([id, label]) => (
                <button key={id} onClick={() => setCalView(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    calView === id ? 'bg-white text-slate-900' : 'text-slate-400'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex bg-white/10 rounded-lg p-0.5">
              {[['work', 'Work'], ['booking', 'Booking']].map(([id, label]) => (
                <button key={id} onClick={() => setViewMode(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === id ? 'bg-sky-500 text-white' : 'text-slate-400'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 flex flex-col bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full" />
          </div>
        ) : calView === 'day' ? (
          <DayView jobs={jobs} onJobClick={openJob} viewMode={viewMode}
            anchor={dayAnchor} onAnchorChange={setDayAnchor} settings={settings} />
        ) : calView === 'week' ? (
          <GanttWeekView jobs={jobs} onJobClick={openJob} viewMode={viewMode}
            anchor={weekAnchor} onAnchorChange={setWeekAnchor} settings={settings} />
        ) : (
          <MonthCalendar jobs={jobs} onJobClick={openJob} viewMode={viewMode}
            anchor={monthAnchor} onAnchorChange={setMonthAnchor} settings={settings} />
        )}
      </div>

      {/* FAB */}
      <button onClick={openNew}
        className="fixed right-5 bottom-24 flex items-center justify-center rounded-full shadow-lg z-30 bg-sky-500 hover:bg-sky-600 transition-colors"
        style={{ width: 52, height: 52 }}
        aria-label="Add job">
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="white" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {showModal && (
        <JobModal job={selectedJob} customers={customers}
          onSave={saveJob} onDelete={deleteJob} onClose={closeModal} settings={settings}
          onStartTimer={onStartTimer} activeTimer={activeTimer} timerStopKey={timerStopKey} />
      )}
    </div>
  )
}
