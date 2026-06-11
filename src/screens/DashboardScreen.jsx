import { STATUS_CONFIG, STATUS_ORDER } from '../constants'

export default function DashboardScreen({ jobs, loading }) {
  const allUnits = jobs.flatMap(j => j.units || [])

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = allUnits.filter(u => u.status === s).length
    return acc
  }, {})

  const activeJobs = jobs.filter(j => j.units?.some(u => u.status !== 'complete'))

  return (
    <div className="flex flex-col h-full">
      <div className="safe-top shrink-0 px-4 pt-3 pb-4" style={{ backgroundColor: '#0a0a0a' }}>
        <h1 className="font-bold text-lg" style={{ color: '#b5ce3a' }}>Dashboard</h1>
        <p className="text-slate-500 text-xs mt-0.5">Workshop overview</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-4">
        {/* Status counts */}
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

        {/* Coming soon */}
        <div className="bg-gradient-to-br from-sky-50 to-slate-50 rounded-xl border border-sky-100 p-6 flex flex-col items-center text-center">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-sky-300 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
          <p className="text-slate-600 font-semibold text-sm">More dashboard widgets coming soon</p>
          <p className="text-slate-400 text-xs mt-1">Revenue, turnaround times, busiest days…</p>
        </div>
      </div>
    </div>
  )
}
