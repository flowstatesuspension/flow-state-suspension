import { STATUS_CONFIG } from '../constants'
import { format, parseISO, differenceInDays } from 'date-fns'

export default function AnalyticsScreen({ jobs }) {
  const allUnits = jobs.flatMap(j => j.units || [])
  const complete = jobs.filter(j => j.units?.every(u => u.status === 'complete'))

  const avgTurnaround = complete.length
    ? Math.round(
        complete.reduce((sum, j) => {
          if (!j.drop_off_date || !j.pickup_date) return sum
          return sum + differenceInDays(parseISO(j.pickup_date), parseISO(j.drop_off_date))
        }, 0) / complete.length
      )
    : null

  // Top brands
  const brandCounts = allUnits.reduce((acc, u) => {
    if (u.brand) acc[u.brand] = (acc[u.brand] || 0) + 1
    return acc
  }, {})
  const topBrands = Object.entries(brandCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return (
    <div className="flex flex-col h-full">
      <div className="safe-top shrink-0 px-4 pt-3 pb-4" style={{ backgroundColor: '#0a0a0a' }}>
        <h1 className="font-bold text-lg" style={{ color: '#b5ce3a' }}>Analytics</h1>
        <p className="text-slate-500 text-xs mt-0.5">Business insights</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Jobs', value: jobs.length },
            { label: 'Total Units', value: allUnits.length },
            { label: 'Avg Days', value: avgTurnaround ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Top brands */}
        {topBrands.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Top Brands</h3>
            <div className="space-y-2">
              {topBrands.map(([brand, count]) => {
                const pct = Math.round((count / allUnits.length) * 100)
                return (
                  <div key={brand}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{brand}</span>
                      <span className="text-slate-400">{count} unit{count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Status distribution */}
        {allUnits.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Unit Status Split</h3>
            <div className="flex h-4 rounded-full overflow-hidden mb-3">
              {Object.entries(STATUS_CONFIG).map(([s, cfg]) => {
                const n = allUnits.filter(u => u.status === s).length
                const pct = (n / allUnits.length) * 100
                return pct > 0 ? (
                  <div key={s} style={{ width: `${pct}%`, backgroundColor: cfg.bg }} title={cfg.label} />
                ) : null
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([s, cfg]) => {
                const n = allUnits.filter(u => u.status === s).length
                if (!n) return null
                return (
                  <div key={s} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.bg }} />
                    <span className="text-xs text-slate-500">{cfg.label} ({n})</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {allUnits.length === 0 && (
          <div className="bg-gradient-to-br from-sky-50 to-slate-50 rounded-xl border border-sky-100 p-6 flex flex-col items-center text-center">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-sky-300 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
            <p className="text-slate-600 font-semibold text-sm">Analytics will appear as you add jobs</p>
          </div>
        )}
      </div>
    </div>
  )
}
