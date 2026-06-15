import { useState, useCallback } from 'react'

const STORAGE_KEY = 'flowstate_settings'

const DEFAULTS = {
  workshopName: 'Flow State Suspension',
  revenueTarget: 3000,
  weeklyCapacity: 8,
  turnaroundDays: 3,
  defaultUnitPrice: 120,
  brands: ['Fox', 'Rockshox', 'Postage', 'Other'],
  models: {},
  // statusLabels: overrides for display labels only. Keys are the DB values.
  statusLabels: {
    booked_in: 'Booked In',
    awaiting_parts: 'Awaiting Parts',
    ready: 'Ready',
    in_progress: 'In Progress',
    on_hold: 'On Hold',
    complete: 'Complete',
  },
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const stored = JSON.parse(raw)
    // Fix: incorrect default that shipped briefly
    if (stored.statusLabels?.ready === 'Ready for Collection') {
      stored.statusLabels.ready = 'Ready'
    }
    return { ...DEFAULTS, ...stored }
  } catch {
    return DEFAULTS
  }
}

function save(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function useSettings() {
  const [settings, setSettings] = useState(load)

  const updateSettings = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      save(next)
      return next
    })
  }, [])

  return { settings, updateSettings }
}
