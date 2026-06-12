import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useData } from './hooks/useData'
import BottomNav from './components/BottomNav'
import JobsScreen from './screens/JobsScreen'
import CustomersScreen from './screens/CustomersScreen'
import DashboardScreen from './screens/DashboardScreen'
import AnalyticsScreen from './screens/AnalyticsScreen'
import LoginScreen from './screens/LoginScreen'

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const data = useData()
  const navRef = useRef(null)

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    // iOS PWA bug: on screens without page-level scroll, position:fixed bottom:0
    // anchors to the layout viewport (excludes safe area) not the visual viewport.
    // Fix: measure the gap between nav bottom and physical screen bottom, then
    // nudge the nav down by that amount. Skip if gap is large (keyboard open).
    el.style.bottom = '0px'
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const diff = window.screen.height - rect.bottom
      if (diff > 0.5 && diff < 80) el.style.bottom = `-${diff}px`
    })
  }, [activeTab])

  return (
    <div className="flex flex-col bg-slate-50" style={{ height: '100%' }}>
      {/* Content scrolls above the fixed nav */}
      <div className="flex-1 overflow-hidden" style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}>
        {activeTab === 'jobs'      && <JobsScreen      {...data} />}
        {activeTab === 'customers' && <CustomersScreen {...data} onTabChange={setActiveTab} />}
        {activeTab === 'dashboard' && <DashboardScreen {...data} />}
        {activeTab === 'analytics' && <AnalyticsScreen {...data} />}
      </div>
      {/* Fixed nav pinned to physical bottom */}
      <div ref={navRef} className="fixed bottom-0 left-0 right-0 z-40">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
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
