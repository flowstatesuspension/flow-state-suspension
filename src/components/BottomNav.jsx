const TABS = [
  { id: 'jobs', label: 'Jobs', icon: (active) => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      {/* Shock absorber: top mount, shaft, body, spring coils, bottom mount */}
      <line x1="12" y1="2" x2="12" y2="4" />
      <rect x="10" y="4" width="4" height="2" rx="0.5" />
      <line x1="12" y1="6" x2="12" y2="9" />
      <path d="M10 9 Q8 10 10 11 Q12 12 10 13 Q8 14 10 15 Q12 16 10 17" />
      <path d="M14 9 Q16 10 14 11 Q12 12 14 13 Q16 14 14 15 Q12 16 14 17" />
      <rect x="9.5" y="17" width="5" height="3" rx="0.5" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <rect x="10" y="22" width="4" height="1.5" rx="0.5" />
    </svg>
  )},
  { id: 'customers', label: 'Customers', icon: (active) => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )},
  { id: 'dashboard', label: 'Dashboard', icon: (active) => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  )},
  { id: 'analytics', label: 'Analytics', icon: (active) => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  )},
]

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="flex bg-white border-t border-slate-200 pb-safe">
      {TABS.map(tab => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${active ? 'text-sky-600' : 'text-slate-400'}`}
          >
            {tab.icon(active)}
            <span className={`text-[10px] font-medium ${active ? 'text-sky-600' : 'text-slate-400'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
