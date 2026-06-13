import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useData } from './hooks/useData'
import { useSettings } from './hooks/useSettings'
import { STATUS_CONFIG, STATUS_ORDER } from './constants'
import BottomNav from './components/BottomNav'
import JobsScreen from './screens/JobsScreen'
import CustomersScreen from './screens/CustomersScreen'
import DashboardScreen from './screens/DashboardScreen'
import AnalyticsScreen from './screens/AnalyticsScreen'
import SettingsScreen from './screens/SettingsScreen'
import LoginScreen from './screens/LoginScreen'

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const data = useData()
  const { settings, updateSettings } = useSettings()

  // Derive models from DB jobs, merge with any user-added models from settings
  const mergedModels = (() => {
    const derived = {}
    for (const job of data.jobs) {
      for (const unit of job.units || []) {
        if (!unit.brand || !unit.model) continue
        if (!derived[unit.brand]) derived[unit.brand] = new Set()
        derived[unit.brand].add(unit.model.trim())
      }
    }
    const sModels = settings.models || {}
    const result = {}
    const allBrands = new Set([
      ...Object.keys(derived),
      ...Object.keys(sModels).filter(k => !k.startsWith('_deleted_')),
    ])
    for (const brand of allBrands) {
      const deleted = new Set(sModels[`_deleted_${brand}`] || [])
      const fromDB = derived[brand] ? [...derived[brand]].filter(m => !deleted.has(m)) : []
      const fromSettings = (sModels[brand] || []).filter(m => !deleted.has(m))
      result[brand] = [...new Set([...fromDB, ...fromSettings])].sort()
    }
    return result
  })()

  // Merge label overrides into STATUS_CONFIG
  const statusConfig = Object.fromEntries(
    STATUS_ORDER.map(key => [key, {
      ...STATUS_CONFIG[key],
      label: settings.statusLabels?.[key] ?? STATUS_CONFIG[key].label,
    }])
  )

  const enrichedSettings = { ...settings, models: mergedModels, statusConfig, statusOrder: STATUS_ORDER }

  return (
    <div className="flex flex-col bg-slate-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'calc(-1 * env(safe-area-inset-bottom))' }}>
      <div className="flex-1 min-h-0" style={{ overflow: 'clip' }}>
        {activeTab === 'jobs'      && <JobsScreen      {...data} settings={enrichedSettings} />}
        {activeTab === 'customers' && <CustomersScreen {...data} onTabChange={setActiveTab} />}
        {activeTab === 'dashboard' && <DashboardScreen {...data} settings={enrichedSettings} />}
        {activeTab === 'analytics' && <AnalyticsScreen {...data} settings={enrichedSettings} />}
        {activeTab === 'settings'  && <SettingsScreen  jobs={data.jobs} customers={data.customers} settings={enrichedSettings} updateSettings={updateSettings} />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    // Get existing session immediately (from localStorage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for sign-in / sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Still checking localStorage for existing session
  if (session === undefined) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900">
        <div className="animate-spin w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!session) return <LoginScreen />

  return <MainApp />
}
