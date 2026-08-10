import { useState, useRef, useCallback } from 'react'

// Works out which index the dragged row should land on, given how far it has
// moved and the pitch (height + gap) of every row in the list.
function resolveIndex(fromIndex, offset, pitches) {
  let to = fromIndex
  if (offset > 0) {
    let acc = 0
    for (let i = fromIndex + 1; i < pitches.length; i++) {
      acc += pitches[i]
      if (offset > acc - pitches[i] / 2) to = i
      else break
    }
  } else if (offset < 0) {
    let acc = 0
    for (let i = fromIndex - 1; i >= 0; i--) {
      acc += pitches[i]
      if (-offset > acc - pitches[i] / 2) to = i
      else break
    }
  }
  return to
}

/**
 * Pointer-driven vertical reordering for a list of rows.
 *
 * Rows must carry `data-reorder-row` and live inside `containerRef`, in the
 * same order as the array you pass to onReorder. Spread `handleProps(index)`
 * onto the grab handle and `rowStyle(index)` onto the row itself.
 *
 * onReorder(fromIndex, toIndex) fires once, on drop, only if the index changed.
 */
export function useDragReorder({ containerRef, onReorder, enabled = true }) {
  const [drag, setDrag] = useState(null) // { fromIndex, toIndex, offset, pitch }
  const st = useRef(null)

  const onDown = useCallback((e, index) => {
    if (!enabled) return
    e.preventDefault()
    e.stopPropagation()
    const rows = containerRef.current
      ? [...containerRef.current.querySelectorAll('[data-reorder-row]')]
      : []
    if (!rows.length) return
    const rects = rows.map(r => r.getBoundingClientRect())
    // Pitch = distance to the next row's top, so any gap between rows is included
    const pitches = rects.map((r, i) =>
      i < rects.length - 1 ? rects[i + 1].top - r.top : r.height
    )
    st.current = { fromIndex: index, toIndex: index, offset: 0, pitches, startY: e.clientY, pitch: pitches[index] || 0 }
    setDrag({ fromIndex: index, toIndex: index, offset: 0, pitch: st.current.pitch })
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not supported */ }
  }, [containerRef, enabled])

  const onMove = useCallback(e => {
    const s = st.current
    if (!s) return
    e.preventDefault()
    const offset = e.clientY - s.startY
    const toIndex = resolveIndex(s.fromIndex, offset, s.pitches)
    s.offset = offset
    s.toIndex = toIndex
    setDrag({ fromIndex: s.fromIndex, toIndex, offset, pitch: s.pitch })
  }, [])

  const onUp = useCallback(() => {
    const s = st.current
    st.current = null
    setDrag(null)
    if (s && s.toIndex !== s.fromIndex) onReorder(s.fromIndex, s.toIndex)
  }, [onReorder])

  const handleProps = index => ({
    onPointerDown: e => onDown(e, index),
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: onUp,
    style: { touchAction: 'none' },
  })

  const rowStyle = index => {
    if (!drag) return {}
    if (index === drag.fromIndex) {
      return {
        transform: `translateY(${drag.offset}px)`,
        position: 'relative',
        zIndex: 30,
        boxShadow: '0 8px 22px rgba(15,23,42,0.18)',
      }
    }
    let shift = 0
    if (drag.toIndex > drag.fromIndex && index > drag.fromIndex && index <= drag.toIndex) shift = -drag.pitch
    if (drag.toIndex < drag.fromIndex && index >= drag.toIndex && index < drag.fromIndex) shift = drag.pitch
    return { transform: `translateY(${shift}px)`, transition: 'transform 160ms ease' }
  }

  return { drag, handleProps, rowStyle, isDragging: !!drag }
}
