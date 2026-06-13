import { useState, useCallback } from 'react'

const STORAGE_KEY = 'flowstate_settings'

const DEFAULTS = {
  workshopName: 'Flow State Suspension',
  revenueTarget: 3000,
  turnaroundDays: 3,
  brands: ['Fox', 'Rockshox', 'Postage', 'Other'],
  servicePrices: [
    { id: '1', brand: 'Fox', service: '36 Lower Leg Service', price: 80 },
    { id: '2', brand: 'Fox', service: '36 Full Service', price: 120 },
    { id: '3', brand: 'Fox', service: '38 Lower Leg Service', price: 80 },
    { id: '4', brand: 'Fox', service: '38 Full Service', price: 135 },
    { id: '5', brand: 'Fox', service: '40 Full Service', price: 150 },
    { id: '6', brand: 'Fox', service: 'Float X Service', price: 120 },
    { id: '7', brand: 'Fox', service: 'Float X2 Service', price: 120 },
    { id: '8', brand: 'Fox', service: 'DHX2 Service', price: 120 },
    { id: '9', brand: 'Fox', service: 'DPX2 Service', price: 120 },
    { id: '10', brand: 'Fox', service: 'Transfer Dropper Service', price: 80 },
    { id: '11', brand: 'Rockshox', service: 'Pike Lower Service', price: 80 },
    { id: '12', brand: 'Rockshox', service: 'Lyrik Lower Service', price: 80 },
    { id: '13', brand: 'Rockshox', service: 'ZEB Lower Service', price: 80 },
    { id: '14', brand: 'Rockshox', service: 'Super Deluxe Service', price: 120 },
    { id: '15', brand: 'Rockshox', service: 'Vivid Service', price: 120 },
  ],
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
