import { useState, useEffect } from 'react'
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
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white">
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
