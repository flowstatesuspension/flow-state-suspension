import { useRef, useState, useEffect } from 'react'

const THRESHOLD = 60

export default function PullToRefresh({ onRefresh, children, className = '' }) {
  const containerRef = useRef(null)
  const startY = useRef(null)
  const currentPull = useRef(0)
  const [pull, setPull] = useState(0)      // 0–1+ normalised
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)

  async function doRefresh() {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setRefreshing(true)
    setPull(0)
    currentPull.current = 0
    try { await onRefresh() } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e) {
      if (el.scrollTop === 0) startY.current = e.touches[0].clientY
    }

    function onTouchMove(e) {
      if (startY.current == null || refreshingRef.current) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > 0 && el.scrollTop === 0) {
        e.preventDefault()
        const p = Math.min(delta / THRESHOLD, 1.4)
        currentPull.current = p
        setPull(p)
      } else if (el.scrollTop > 0) {
        startY.current = null
      }
    }

    function onTouchEnd() {
      if (currentPull.current >= 1) {
        doRefresh()
      } else {
        setPull(0)
        currentPull.current = 0
      }
      startY.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const show = pull > 0.15 || refreshing
  const progress = Math.min(pull, 1)
  // Indicator drops in from the top as you pull
  const indicatorTop = refreshing ? 10 : Math.max(pull * THRESHOLD * 0.6 - 20, -28)
  const rotation = refreshing ? undefined : `rotate(${progress * 360}deg)`

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Pull indicator */}
      <div className="absolute left-0 right-0 z-20 flex justify-center pointer-events-none"
        style={{ top: indicatorTop, transition: refreshing ? 'top 0.15s' : 'none' }}>
        {show && (
          <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center"
            style={{ opacity: Math.min(progress * 2, 1) }}>
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 text-sky-500 ${refreshing ? 'animate-spin' : ''}`}
              style={{ transform: refreshing ? undefined : rotation, transition: 'transform 0.05s' }}
              fill="none" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div ref={containerRef} className={`flex-1 overflow-y-auto scrollbar-none ${className}`}>
        {children}
      </div>
    </div>
  )
}
