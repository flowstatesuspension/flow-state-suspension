import { useState } from 'react'
import {
  format, parseISO, differenceInDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  addWeeks, addMonths, isWithinInterval,
} from 'date-fns'
import { STATUS_CONFIG, STATUS_ORDER } from '../constants'
import JobModal from '../components/JobModal'

function jobTotal(job) {
  return (job.units || []).reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0)
}

function SectionLabel({ children }) {
  return <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{children}</p>
}

function StatCard({ value, label, sub, accent, onClick }) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-3 text-left active:bg-slate-50 transition-colors w-full"
      style={accent ? { borderLeftWidth: 4, borderLeftColor: accent } : {}}>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-xs text-slate-600 mt-1 leading-tight font-medium">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </button>
  )
}

function RevenueCard({ value, label, sub, onClick }) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-3 text-center active:bg-slate-50 transition-colors">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-slate-400">{sub}</p>}
    </button>
  )
}

function JobListSheet({ title, jobs, customers, saveJob, deleteJob, onClose }) {
  const [editJob, setEditJob] = useState(null)
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl flex flex-col max-h-[75vh] w-full md:w-[480px] md:shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-sky-600 font-medium text-sm">Done</button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-none p-3 space-y-2">
          {jobs.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No jobs</p>}
          {jobs.map(job => (
            <button key={job.id} onClick={() => setEditJob(job)}
              className="w-full bg-slate-50 rounded-xl border border-slate-200 p-3 text-left hover:border-sky-300 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-800 text-sm">{job.customers?.name || '—'}</span>
                <span className="text-sm font-bold text-slate-700">£{jobTotal(job).toFixed(0)}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {job.units?.map(u => (
                  <span key={u.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: STATUS_CONFIG[u.status]?.light, color: STATUS_CONFIG[u.status]?.text, border: `1px solid ${STATUS_CONFIG[u.status]?.border}` }}>
                    {u.brand} {u.model}
                  </span>
                ))}
              </div>
              {job.drop_off_date && (
                <p className="text-[10px] text-slate-400 mt-1">
                  {format(parseISO(job.drop_off_date), 'd MMM yyyy')}
                  {job.pickup_date ? ` → ${format(parseISO(job.pickup_date), 'd MMM')}` : ''}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
      {editJob && <JobModal job={editJob} customers={customers} onSave={saveJob} onDelete={deleteJob} onClose={() => setEditJob(null)} />}
    </div>
  )
}

const MODES = [
  { id: 'this-week',  label: 'This Week' },
  { id: 'pick-week',  label: 'Week' },
  { id: 'this-month', label: 'This Month' },
  { id: 'pick-month', label: 'Month' },
  { id: 'this-year',  label: 'This Year' },
]

function getRange(mode, ref) {
  const now = new Date()
  const wo = { weekStartsOn: 1 }
  switch (mode) {
    case 'this-week':  return { start: startOfWeek(now, wo),  end: endOfWeek(now, wo) }
    case 'pick-week':  return { start: startOfWeek(ref, wo),  end: endOfWeek(ref, wo) }
    case 'this-month': return { start: startOfMonth(now),     end: endOfMonth(now) }
    case 'pick-month': return { start: startOfMonth(ref),     end: endOfMonth(ref) }
    case 'this-year':  return { start: startOfYear(now),      end: endOfYear(now) }
    default:           return null
  }
}

function periodLabel(mode, ref) {
  const wo = { weekStartsOn: 1 }
  if (mode === 'pick-week') {
    const s = startOfWeek(ref, wo), e = endOfWeek(ref, wo)
    return `${format(s, 'd MMM')} – ${format(e, 'd MMM')}`
  }
  if (mode === 'pick-month') return format(ref, 'MMM yyyy')
  return null
}

export default function DashboardScreen({ jobs, customers, loading, saveJob, deleteJob }) {
  const [sheet, setSheet]   = useState(null)
  const [mode, setMode]     = useState('this-week')
  const [ref, setRef]       = useState(new Date())

  const today = new Date()
  const range = getRange(mode, ref)

  // Period-filtered jobs (by drop_off_date). null range = no filter (shouldn't happen)
  const filteredJobs = range
    ? jobs.filter(j => j.drop_off_date && isWithinInterval(parseISO(j.drop_off_date), range))
    : jobs

  const allUnits      = filteredJobs.flatMap(j => j.units || [])
  const completedJobs = filteredJobs.filter(j => j.units?.length && j.units.every(u => u.status === 'complete'))
  const activeJobs    = filteredJobs.filter(j => !j.units?.length || j.units.some(u => u.status !== 'complete'))
  const activeUnits   = allUnits.filter(u => u.status !== 'complete')
  const completeUnits = allUnits.filter(u => u.status === 'complete')

  const totalRevenue     = filteredJobs.reduce((s, j) => s + jobTotal(j), 0)
  const completedRevenue = completedJobs.reduce((s, j) => s + jobTotal(j), 0)
  const activeRevenue    = activeJobs.reduce((s, j) => s + jobTotal(j), 0)
  const avgActiveValue   = activeJobs.length ? activeRevenue / activeJobs.length : 0

  const unitCounts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = allUnits.filter(u => u.status === s).length
    return acc
  }, {})

  // Brand splits (period-filtered)
  const foxJobs      = filteredJobs.filter(j => j.units?.some(u => u.brand === 'Fox'))
  const rockshoxJobs = filteredJobs.filter(j => j.units?.some(u => u.brand === 'Rockshox'))
  const foxPct       = allUnits.length ? Math.round(allUnits.filter(u => u.brand === 'Fox').length / allUnits.length * 100) : 0
  const rockshoxPct  = allUnits.length ? Math.round(allUnits.filter(u => u.brand === 'Rockshox').length / allUnits.length * 100) : 0

  // Workshop section always shows current live state (unfiltered)
  const allActiveJobs     = jobs.filter(j => !j.units?.length || j.units.some(u => u.status !== 'complete'))
  const overdueJobs       = allActiveJobs.filter(j => j.pickup_date && parseISO(j.pickup_date) < today)
  const awaitingPartJobs  = jobs.filter(j => j.units?.some(u => u.status === 'awaiting_parts'))
  const readyJobs         = jobs.filter(j => j.units?.every(u => u.status === 'complete' || u.status === 'ready') && j.units?.some(u => u.status === 'ready'))
  const oldestDays        = allActiveJobs.reduce((max, j) => {
    if (!j.drop_off_date) return max
    return Math.max(max, differenceInDays(today, parseISO(j.drop_off_date)))
  }, 0)

  function jobsForStatus(status) {
    return filteredJobs.filter(j => j.units?.some(u => u.status === status))
  }
  function open(title, jobList) { setSheet({ title, jobs: jobList }) }

  function selectMode(m) {
    setMode(m)
    if (m === 'pick-week' || m === 'pick-month') setRef(new Date())
  }

  function stepRef(dir) {
    if (mode === 'pick-week')  setRef(r => addWeeks(r, dir))
    if (mode === 'pick-month') setRef(r => addMonths(r, dir))
  }

  const navLabel = periodLabel(mode, ref)

  return (
    <div className="flex flex-col h-full">
      <div className="bg-black safe-top shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Work Flow</h1>
            <p className="text-slate-400 text-xs mt-1">Workshop overview</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="px-3 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
          {MODES.map(m => (
            <button key={m.id} onClick={() => selectMode(m.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                mode === m.id
                  ? 'bg-white text-black'
                  : 'bg-white/15 text-white/80'
              }`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Prev/next navigation for pick modes */}
        {navLabel && (
          <div className="flex items-center justify-center gap-4 pb-3">
            <button onClick={() => stepRef(-1)} className="text-white/70 px-3 py-1 text-lg leading-none">‹</button>
            <span className="text-white text-xs font-semibold">{navLabel}</span>
            <button onClick={() => stepRef(1)} className="text-white/70 px-3 py-1 text-lg leading-none">›</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-5">

        {/* Revenue */}
        <div>
          <SectionLabel>Revenue</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <RevenueCard value={`£${totalRevenue.toFixed(0)}`}      label="Total"    sub="period"    onClick={() => open('All Jobs', filteredJobs)} />
            <RevenueCard value={`£${completedRevenue.toFixed(0)}`}  label="Invoiced" sub="complete"  onClick={() => open('Completed Jobs', completedJobs)} />
            <RevenueCard value={`£${activeRevenue.toFixed(0)}`}     label="Pipeline" sub="active"    onClick={() => open('Active Jobs', activeJobs)} />
          </div>
        </div>

        {/* Jobs summary */}
        <div>
          <SectionLabel>Jobs</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <StatCard value={filteredJobs.length}  label="Total Jobs"    onClick={() => open('All Jobs', filteredJobs)} />
            <StatCard value={activeJobs.length}    label="Active Jobs"    accent="#64748b" onClick={() => open('Active Jobs', activeJobs)} />
            <StatCard value={completedJobs.length} label="Complete Jobs"  accent={STATUS_CONFIG.complete.bg} onClick={() => open('Completed Jobs', completedJobs)} />
          </div>
        </div>

        {/* Units summary */}
        <div>
          <SectionLabel>Units</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <StatCard value={allUnits.length}      label="Total Units"    onClick={() => open('All Jobs', filteredJobs)} />
            <StatCard value={activeUnits.length}   label="Active Units"   accent="#64748b" onClick={() => open('Active Jobs', activeJobs)} />
            <StatCard value={completeUnits.length} label="Complete Units" accent={STATUS_CONFIG.complete.bg} onClick={() => open('Completed Jobs', completedJobs)} />
          </div>
        </div>

        {/* Unit status breakdown */}
        <div>
          <SectionLabel>Unit Status</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {STATUS_ORDER.map(s => {
              const cfg = STATUS_CONFIG[s]
              return (
                <StatCard key={s}
                  value={unitCounts[s] || 0}
                  label={`${cfg.label} Units`}
                  accent={cfg.bg}
                  onClick={() => open(`${cfg.label} Units`, jobsForStatus(s))}
                />
              )
            })}
          </div>
        </div>

        {/* Brand split */}
        {allUnits.length > 0 && (
          <div>
            <SectionLabel>Brand Split</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              <StatCard value={`${foxPct}%`} label="Fox" sub={`${foxJobs.length} jobs`} accent="#f97316" onClick={() => open('Fox Jobs', foxJobs)} />
              <StatCard value={`${rockshoxPct}%`} label="Rockshox" sub={`${rockshoxJobs.length} jobs`} accent="#3b82f6" onClick={() => open('Rockshox Jobs', rockshoxJobs)} />
              <StatCard value={`${100 - foxPct - rockshoxPct}%`} label="Other" />
            </div>
          </div>
        )}

        {/* Workshop — always live/unfiltered */}
        <div>
          <SectionLabel>Workshop</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={overdueJobs.length}
              label="Overdue Jobs"
              sub="past pickup date"
              accent={overdueJobs.length > 0 ? '#ef4444' : '#22c55e'}
              onClick={() => open('Overdue Jobs', overdueJobs)}
            />
            <StatCard
              value={awaitingPartJobs.length}
              label="Awaiting Parts"
              sub="jobs blocked"
              accent={awaitingPartJobs.length > 0 ? '#ef4444' : '#22c55e'}
              onClick={() => open('Awaiting Parts', awaitingPartJobs)}
            />
            <StatCard
              value={readyJobs.length}
              label="Ready to Collect"
              sub="notify customers"
              accent={readyJobs.length > 0 ? STATUS_CONFIG.ready.bg : '#22c55e'}
              onClick={() => open('Ready to Collect', readyJobs)}
            />
            <StatCard
              value={oldestDays > 0 ? `${oldestDays}d` : '—'}
              label="Oldest Active Job"
              sub="days in workshop"
              accent={oldestDays > 14 ? '#ef4444' : oldestDays > 7 ? '#f97316' : '#64748b'}
              onClick={() => open('Active Jobs', allActiveJobs)}
            />
            <StatCard
              value={`£${avgActiveValue.toFixed(0)}`}
              label="Avg Active Job"
              sub="value"
              onClick={() => open('Active Jobs', activeJobs)}
            />
            <StatCard
              value={customers?.length || 0}
              label="Total Customers"
              onClick={() => {}}
            />
          </div>
        </div>

      </div>

      {sheet && (
        <JobListSheet
          title={sheet.title}
          jobs={sheet.jobs}
          customers={customers}
          saveJob={saveJob}
          deleteJob={deleteJob}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
