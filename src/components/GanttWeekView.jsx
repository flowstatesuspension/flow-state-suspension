import { useState, useRef, useLayoutEffect } from 'react'
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  eachDayOfInterval, format, parseISO,
  differenceInDays, max, min, isToday,
} from 'date-fns'
import { STATUS_CONFIG } from '../constants'

const LABEL_W = 120
const ROW_PAD = 8
const UNIT_H = 22
const UNIT_GAP = 3
const MIN_COL_W = 52

function rowHeight(job) {
  const n = job.units?.length || 1
  return ROW_PAD * 2 + n * UNIT_H + (n - 1) * UNIT_GAP
}

export default function GanttWeekView({ jobs, onJobClick, viewMode }) {
  const [anchor, setAnchor] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const containerRef = useRef(null)
  const [colW, setColW] = useState(MIN_COL_W)

  useLayoutEffect(() => {
    function measure() {
      if (!containerRef.current) return
      const available = containerRef.current.clientWidth - LABEL_W
      setColW(Math.max(MIN_COL_W, Math.floor(available / 7)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: anchor, end: weekEnd })
  const chartW = days.length * colW

  const visible = jobs.filter(j => {
    if (!j.drop_off_date || !j.pickup_date) return false
    return parseISO(j.drop_off_date) <= weekEnd && parseISO(j.pickup_date) >= anchor
  })

  const filtered =
    viewMode === 'work'
      ? visible.filter(j => j.units?.some(u => u.status !== 'complete'))
      : visible

  function barBounds(job) {
    const s = max([parseISO(job.drop_off_date), anchor])
    const e = min([parseISO(job.pickup_date), weekEnd])
    const left = differenceInDays(s, anchor) * colW + 2
    const width = (differenceInDays(e, s) + 1) * colW - 4
    return { left, width }
  }

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Week navigator */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <button
          onClick={() => setAnchor(w => subWeeks(w, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 text-lg font-light"
        >‹</button>
        <div className="text-sm font-semibold text-slate-700">
          {format(anchor, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
        </div>
        <button
          onClick={() => setAnchor(w => addWeeks(w, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 text-lg font-light"
        >›</button>
      </div>

      {/* Chart area */}
      <div className="flex-1 overflow-auto scrollbar-none">
        <div className="flex min-h-full">
          {/* Sticky label column */}
          <div
            className="sticky left-0 z-20 bg-white border-r border-slate-200 shrink-0 flex flex-col"
            style={{ width: LABEL_W, minWidth: LABEL_W }}
          >
            <div className="h-10 border-b border-slate-200 flex items-center px-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Customer</span>
            </div>
            {filtered.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-300 text-xs px-2 text-center">
                No jobs this week
              </div>
            ) : (
              filtered.map(job => (
                <button
                  key={job.id}
                  onClick={() => onJobClick(job)}
                  style={{ height: rowHeight(job) }}
                  className="border-b border-slate-100 flex items-center px-3 text-left w-full hover:bg-sky-50 transition-colors"
                >
                  <span className="text-xs font-semibold text-slate-700 truncate leading-tight">
                    {job.customers?.name || '—'}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Chart columns — fills remaining width */}
          <div className="flex-1 overflow-x-auto scrollbar-none">
            {/* Day headers */}
            <div
              className="sticky top-0 z-10 flex bg-white border-b border-slate-200"
              style={{ height: 40, width: chartW }}
            >
              {days.map(day => (
                <div
                  key={day.toISOString()}
                  style={{ width: colW }}
                  className="border-r border-slate-100 flex flex-col items-center justify-center"
                >
                  <span className="text-[10px] text-slate-400 font-medium">{format(day, 'EEE')}</span>
                  <span
                    className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday(day) ? 'bg-sky-500 text-white' : 'text-slate-700'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
              ))}
            </div>

            {/* Job rows */}
            <div style={{ width: chartW }}>
              {filtered.map(job => {
                const { left, width } = barBounds(job)
                const h = rowHeight(job)
                return (
                  <div
                    key={job.id}
                    className="relative border-b border-slate-100"
                    style={{ height: h }}
                  >
                    {days.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-r border-slate-100"
                        style={{ left: i * colW, width: colW }}
                      />
                    ))}

                    {(job.units || []).map((unit, idx) => {
                      const cfg = STATUS_CONFIG[unit.status] || STATUS_CONFIG.booked_in
                      return (
                        <button
                          key={unit.id}
                          onClick={() => onJobClick(job)}
                          style={{
                            left,
                            width: Math.max(width, 4),
                            top: ROW_PAD + idx * (UNIT_H + UNIT_GAP),
                            height: UNIT_H,
                            backgroundColor: cfg.bg,
                          }}
                          className="absolute rounded flex items-center px-1.5 overflow-hidden hover:opacity-90 transition-opacity"
                        >
                          <span className="text-white text-[10px] font-semibold truncate leading-none">
                            {unit.brand} {unit.model}
                          </span>
                        </button>
                      )
                    })}

                    {(!job.units || job.units.length === 0) && (
                      <button
                        onClick={() => onJobClick(job)}
                        style={{ left, width: Math.max(width, 4), top: ROW_PAD, height: UNIT_H, backgroundColor: '#94a3b8' }}
                        className="absolute rounded flex items-center px-1.5 overflow-hidden hover:opacity-90"
                      >
                        <span className="text-white text-[10px] font-semibold">No units</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
