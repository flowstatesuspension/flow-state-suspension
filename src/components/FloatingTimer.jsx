import { useState, useEffect, useRef } from 'react'
import { formatHMS } from '../lib/timeEntries'

export default function FloatingTimer({ timer, onStop, onClose }) {
  const [elapsed, setElapsed] = useState(0)
  const [pos, setPos] = useState(null) // null until we know window size
  const dragRef = useRef(null)
  const elRef = useRef(null)

  // Init position centred near top
  useEffect(() => {
    const w = window.innerWidth
    setPos({ x: Math.max(8, w / 2 - 144), y: 80 })
  }, [])

  // Tick
  useEffect(() => {
    function tick() {
      setElapsed(Math.max(0, Math.round((Date.now() - new Date(timer.startedAt).getTime()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timer.startedAt])

  function onPointerDown(e) {
    if (e.target.closest('button')) return
    e.preventDefault()
    elRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y }
  }

  function onPointerMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const maxX = window.innerWidth - 288
    const maxY = window.innerHeight - 160
    setPos({
      x: Math.max(0, Math.min(dragRef.current.startPosX + dx, maxX)),
      y: Math.max(0, Math.min(dragRef.current.startPosY + dy, maxY)),
    })
  }

  function onPointerUp() {
    dragRef.current = null
  }

  if (!pos) return null

  const job = timer.job
  const unitLabel = (job.units || []).map(u => [u.brand, u.model].filter(Boolean).join(' ')).join(', ')

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 200, width: 288, touchAction: 'none', userSelect: 'none' }}
      className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header / drag zone */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse block" />
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Timer Running</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 active:text-white p-0.5"
          aria-label="Close timer"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 pt-3 pb-4">
        <p className="text-sm font-bold text-white truncate">{job.customers?.name || '—'}</p>
        {unitLabel && <p className="text-xs text-slate-400 truncate mt-0.5">{unitLabel}</p>}

        <p className="text-3xl font-mono font-bold text-sky-400 tracking-tight text-center mt-3">
          {formatHMS(elapsed)}
        </p>

        <button
          onClick={onStop}
          className="mt-3 w-full py-2.5 bg-red-500 active:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors"
        >
          Stop
        </button>
      </div>
    </div>
  )
}
