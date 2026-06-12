import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { STATUS_CONFIG, STATUS_ORDER } from '../constants'
import JobModal from '../components/JobModal'

function jobTotal(job) {
  return (job.units || []).reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0)
}

function JobListSheet({ title, jobs, customers, saveJob, deleteJob, onClose }) {
  const [editJob, setEditJob] = useState(null)
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-black/50" onClick={e => e.target === e.currentTarget && onClose()}>
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
                  <span key={u.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[u.status]?.light, color: STATUS_CONFIG[u.status]?.text, border: `1px solid ${STATUS_CONFIG[u.status]?.border}` }}>
                    {u.brand} {u.model}
                  </span>
                ))}
              </div>
              {job.drop_off_date && (
                <p className="text-[10px] text-slate-400 mt-1">{format(parseISO(job.drop_off_date), 'd MMM yyyy')}{job.pickup_date ? ` → ${format(parseISO(job.pickup_date), 'd MMM')}` : ''}</p>
              )}
            </button>
          ))}
        </div>
      </div>
      {editJob && <JobModal job={editJob} customers={customers} onSave={saveJob} onDelete={deleteJob} onClose={() => setEditJob(null)} />}
    </div>
  )
}

export default function DashboardScreen({ jobs, customers, loading, saveJob, deleteJob }) {
  const [sheet, setSheet] = useState(null) // { title, jobs }

  const allUnits = jobs.flatMap(j => j.units || [])
  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = allUnits.filter(u => u.status === s).length
    return acc
  }, {})

  const completedJobs = jobs.filter(j => j.units?.length && j.units.every(u => u.status === 'complete'))
  const activeJobs = jobs.filter(j => !j.units?.length || j.units.some(u => u.status !== 'complete'))

  const completedRevenue = completedJobs.reduce((s, j) => s + jobTotal(j), 0)
  const pendingRevenue = activeJobs.reduce((s, j) => s + jobTotal(j), 0)
  const totalRevenue = jobs.reduce((s, j) => s + jobTotal(j), 0)

  function jobsForStatus(status) {
    return jobs.filter(j => j.units?.some(u => u.status === status))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-900 safe-top shrink-0 px-4 pt-3 pb-4">
        <h1 className="text-white font-bold text-lg">Flow State Suspension : Workflow</h1>
        <p className="text-slate-400 text-xs mt-0.5">Workshop overview</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-4">

        {/* Revenue cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Revenue', value: `£${totalRevenue.toFixed(0)}`, sub: 'all time', jobList: jobs },
            { label: 'Completed', value: `£${completedRevenue.toFixed(0)}`, sub: 'invoiceable', jobList: completedJobs },
            { label: 'In Progress', value: `£${pendingRevenue.toFixed(0)}`, sub: 'active', jobList: activeJobs },
          ].map(({ label, value, sub, jobList }) => (
            <button key={label} onClick={() => setSheet({ title: label, jobs: jobList })}
              className="bg-white rounded-xl border border-slate-200 p-3 text-center active:bg-slate-50 transition-colors">
              <p className="text-lg font-bold text-slate-900">{value}</p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{label}</p>
              <p className="text-[9px] text-slate-400">{sub}</p>
            </button>
          ))}
        </div>

        {/* Status unit counts — tappable */}
        <div className="grid grid-cols-2 gap-3">
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CONFIG[s]
            const jobList = jobsForStatus(s)
            return (
              <button key={s} onClick={() => setSheet({ title: cfg.label, jobs: jobList })}
                className="bg-white rounded-xl border border-slate-200 p-3 text-left active:bg-slate-50 transition-colors"
                style={{ borderLeftWidth: 4, borderLeftColor: cfg.bg }}>
                <p className="text-2xl font-bold text-slate-900">{counts[s] || 0}</p>
                <p className="text-xs text-slate-500 mt-0.5">{cfg.label}</p>
              </button>
            )
          })}
          <button onClick={() => setSheet({ title: 'Active Jobs', jobs: activeJobs })}
            className="bg-white rounded-xl border border-slate-200 p-3 text-left active:bg-slate-50 transition-colors"
            style={{ borderLeftWidth: 4, borderLeftColor: '#64748b' }}>
            <p className="text-2xl font-bold text-slate-900">{activeJobs.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Active Jobs</p>
          </button>
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
