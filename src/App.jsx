import { useState } from 'react'
import { useData } from './hooks/useData'
import BottomNav from './components/BottomNav'
import JobsScreen from './screens/JobsScreen'
import CustomersScreen from './screens/CustomersScreen'
import DashboardScreen from './screens/DashboardScreen'
import AnalyticsScreen from './screens/AnalyticsScreen'

export default function App() {
  const [activeTab, setActiveTab] = useState('jobs')
  const data = useData()

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 overflow-hidden">
        {activeTab === 'jobs'      && <JobsScreen      {...data} />}
        {activeTab === 'customers' && <CustomersScreen {...data} />}
        {activeTab === 'dashboard' && <DashboardScreen {...data} />}
        {activeTab === 'analytics' && <AnalyticsScreen {...data} />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
