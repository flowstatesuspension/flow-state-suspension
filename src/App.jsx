import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from './lib/supabase'
import { useData } from './hooks/useData'
import { useSettings } from './hooks/useSettings'
import { STATUS_CONFIG, STATUS_ORDER } from './constants'
import { startEntry, stopEntry } from './lib/timeEntries'
import BottomNav from './components/BottomNav'
import JobsScreen from './screens/JobsScreen'
import CustomersScreen from './screens/CustomersScreen'
import DashboardScreen from './screens/DashboardScreen'
import AnalyticsScreen from './screens/AnalyticsScreen'
import SettingsScreen from './screens/SettingsScreen'
import LoginScreen from './screens/LoginScreen'
import FloatingTimer from './components/FloatingTimer'

function TodoAlertModal({ todos, onToggle, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="bg-amber-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-bold text-white">Today's To-Dos</p>
          </div>
          <button onClick={onClose} className="text-white/80 active:text-white">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {todos.map(t => (
            <div key={t.id} className="flex items-start gap-3 py-1">
              <button onClick={() => onToggle(t.id, !t.completed)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  t.completed ? 'bg-green-500 border-green-500' : 'border-slate-300'
                }`}>
                {t.completed && (
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <p className={`text-sm flex-1 ${t.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.text}</p>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <button onClick={onClose} className="w-full py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl">Done</button>
        </div>
      </div>
    </div>
  )
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const data = useData()
  const { settings, updateSettings } = useSettings()
  const [activeTimer, setActiveTimer] = useState(null) // { job, unit, entryId, startedAt }
  const [timerStopKey, setTimerStopKey] = useState(0)
  const [showTodoAlert, setShowTodoAlert] = useState(false)
  const [todoAlertShown, setTodoAlertShown] = useState(false)

  // On load: check for any open time entry and resume the floating timer
  useEffect(() => {
    if (!data.jobs.length) return
    async function resumeOpenTimer() {
      const { data: openEntries } = await supabase
        .from('time_entries')
        .select('*')
        .is('stopped_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
      if (!openEntries?.length) return
      const entry = openEntries[0]
      // Find the job and unit from loaded data
      const job = data.jobs.find(j => j.id === entry.job_id)
      if (!job) return
      const unit = job.units?.find(u => u.id === entry.unit_id)
      if (!unit) return
      const { data: prior } = await supabase
        .from('time_entries')
        .select('duration_seconds')
        .eq('unit_id', unit.id)
        .not('duration_seconds', 'is', null)
      const priorSeconds = (prior || []).reduce((s, e) => s + (e.duration_seconds || 0), 0)
      setActiveTimer({ job, unit, entryId: entry.id, startedAt: entry.started_at, priorSeconds })
    }
    resumeOpenTimer()
  }, [data.jobs])

  // Show alert for today's incomplete todos once on load
  useEffect(() => {
    if (todoAlertShown || !data.todos.length) return
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const todayPending = data.todos.filter(t => t.due_date === todayStr && !t.completed)
    if (todayPending.length) {
      setShowTodoAlert(true)
      setTodoAlertShown(true)
    }
  }, [data.todos, todoAlertShown])

  async function handleStartTimer(job, unit) {
    // Stop any existing timer first
    if (activeTimer) {
      await stopEntry(activeTimer.entryId, activeTimer.startedAt)
      setTimerStopKey(k => k + 1)
    }
    // Fetch prior completed seconds for this unit
    const { data: prior } = await supabase
      .from('time_entries')
      .select('duration_seconds')
      .eq('unit_id', unit.id)
      .not('duration_seconds', 'is', null)
    const priorSeconds = (prior || []).reduce((s, e) => s + (e.duration_seconds || 0), 0)
    const entry = await startEntry(job.id, unit.id)
    setActiveTimer({ job, unit, entryId: entry.id, startedAt: entry.started_at, priorSeconds })
  }

  async function handleStopTimer() {
    if (!activeTimer) return
    await stopEntry(activeTimer.entryId, activeTimer.startedAt)
    setActiveTimer(null)
    setTimerStopKey(k => k + 1)
  }

  function handleCloseTimer() {
    handleStopTimer()
  }

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

  const timerProps = { activeTimer, onStartTimer: handleStartTimer, timerStopKey }
  const todoProps = { todos: data.todos, addTodo: data.addTodo, updateTodo: data.updateTodo, toggleTodo: data.toggleTodo, deleteTodo: data.deleteTodo }
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayPendingTodos = data.todos.filter(t => t.due_date === todayStr && !t.completed)

  return (
    <div className="flex flex-col bg-slate-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'calc(-1 * env(safe-area-inset-bottom))' }}>
      <div className="flex-1 min-h-0" style={{ overflow: 'clip' }}>
        {activeTab === 'jobs'      && <JobsScreen      {...data} settings={enrichedSettings} {...timerProps} {...todoProps} />}
        {activeTab === 'customers' && <CustomersScreen {...data} onTabChange={setActiveTab} />}
        {activeTab === 'dashboard' && <DashboardScreen {...data} settings={enrichedSettings} refresh={data.refresh} {...timerProps} {...todoProps} />}
        {activeTab === 'analytics' && <AnalyticsScreen {...data} settings={enrichedSettings} />}
        {activeTab === 'settings'  && <SettingsScreen  jobs={data.jobs} customers={data.customers} settings={enrichedSettings} updateSettings={updateSettings} />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTimer && (
        <FloatingTimer timer={activeTimer} onStop={handleStopTimer} onClose={handleCloseTimer} />
      )}
      {showTodoAlert && (
        <TodoAlertModal
          todos={todayPendingTodos}
          onToggle={data.toggleTodo}
          onClose={() => setShowTodoAlert(false)}
        />
      )}
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
