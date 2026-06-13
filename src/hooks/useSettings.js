import { useState, useCallback } from 'react'

const STORAGE_KEY = 'flowstate_settings'

const DEFAULTS = {
  workshopName: 'Flow State Suspension',
  revenueTarget: 3000,
  turnaroundDays: 3,
  defaultUnitPrice: 120,
  brands: ['Fox', 'Rockshox', 'Postage', 'Other'],
  // models: { Fox: ['36', '38', ...], Rockshox: [...] }
  // populated dynamically from DB + user additions; not stored in DEFAULTS
  models: {},
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
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
