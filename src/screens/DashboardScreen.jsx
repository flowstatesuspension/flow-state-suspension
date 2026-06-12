import { STATUS_CONFIG, STATUS_ORDER } from '../constants'

function jobTotal(job) {
  return (job.units || []).reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0)
}

export default function DashboardScreen({ jobs, loading }) {
  const allUnits = jobs.flatMap(j => j.units || [])
  const counts = STATUS_ORDER.reduce((acc, s) => { acc[s] = allUnits.filter(u => u.status === s).length; return acc }, {})
  const activeJobs = jobs.filter(j => j.units?.some(u => u.status !== 'complete'))

  const completedJobs = jobs.filter(j => j.units?.length && j.units.every(u => u.status === 'complete'))
  const inProgressJobs = jobs.filter(j => j.units?.some(u => u.status === 'in_progress' || u.status === 'awaiting_parts' || u.status === 'ready' || u.status === 'booked_in'))

  const completedRevenue = completedJobs.reduce((s, j) => s + jobTotal(j), 0)
  const pendingRevenue = inProgressJobs.reduce((s, j) => s + jobTotal(j), 0)
  const totalRevenue = jobs.reduce((s, j) => s + jobTotal(j), 0)

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
            { label: 'Total Revenue', value: `£${totalRevenue.toFixed(0)}`, sub: 'all time' },
            { label: 'Completed', value: `£${completedRevenue.toFixed(0)}`, sub: 'invoiceable' },
            { label: 'In Progress', value: `£${pendingRevenue.toFixed(0)}`, sub: 'pending' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-lg font-bold text-slate-900">{value}</p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{label}</p>
              <p className="text-[9px] text-slate-400">{sub}</p>
            </div>
          ))}
        </div>

        {/* Status unit counts */}
        <div className="grid grid-cols-2 gap-3">
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CONFIG[s]
            return (
              <div key={s} className="bg-white rounded-xl border border-slate-200 p-3" style={{ borderLeftWidth: 4, borderLeftColor: cfg.bg }}>
                <p className="text-2xl font-bold text-slate-900">{counts[s] || 0}</p>
                <p className="text-xs text-slate-500 mt-0.5">{cfg.label}</p>
              </div>
            )
          })}
          <div className="bg-white rounded-xl border border-slate-200 p-3" style={{ borderLeftWidth: 4, borderLeftColor: '#64748b' }}>
            <p className="text-2xl font-bold text-slate-900">{activeJobs.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Active Jobs</p>
          </div>
        </div>
      </div>
    </div>
  )
}
