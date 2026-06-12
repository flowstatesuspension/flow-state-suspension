import { useState } from 'react'
import GanttWeekView from '../components/GanttWeekView'
import MonthCalendar from '../components/MonthCalendar'
import DayView from '../components/DayView'
import JobModal from '../components/JobModal'

export default function JobsScreen({ jobs, customers, loading, saveJob, deleteJob }) {
  const [calView, setCalView] = useState('week')
  const [viewMode, setViewMode] = useState('work')
  const [selectedJob, setSelectedJob] = useState(null)
  const [showModal, setShowModal] = useState(false)

  function openNew() { setSelectedJob(null); setShowModal(true) }
  function openJob(job) { setSelectedJob(job); setShowModal(true) }
  function closeModal() { setShowModal(false); setSelectedJob(null) }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-black safe-top shrink-0">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.png" alt="logo" className="h-10 w-auto shrink-0" />
            <div className="flex-1">
              <h1 className="text-white font-bold text-lg leading-none tracking-tight">Work Flow</h1>
              <p className="text-slate-400 text-xs mt-1">Job Schedule</p>
            </div>
            <span className="text-slate-400 text-xs shrink-0">{jobs.length} jobs</span>
          </div>

          <div className="flex gap-2">
            <div className="flex bg-white/10 rounded-lg p-0.5">
              {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setCalView(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    calView === id ? 'bg-white text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex bg-white/10 rounded-lg p-0.5">
              {[['work', 'Work'], ['booking', 'Booking']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === id ? 'bg-sky-500 text-white' : 'text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 overflow-hidden bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full" />
          </div>
        ) : calView === 'day' ? (
          <DayView jobs={jobs} onJobClick={openJob} viewMode={viewMode} />
        ) : calView === 'week' ? (
          <GanttWeekView jobs={jobs} onJobClick={openJob} viewMode={viewMode} />
        ) : (
          <MonthCalendar jobs={jobs} onJobClick={openJob} viewMode={viewMode} />
        )}
      </div>

      {/* FAB */}
      <button
        onClick={openNew}
        className="fixed right-5 bottom-24 flex items-center justify-center rounded-full shadow-lg z-30 bg-sky-500 hover:bg-sky-600 transition-colors"
        style={{ width: 52, height: 52 }}
        aria-label="Add job"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="white" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {showModal && (
        <JobModal
          job={selectedJob}
          customers={customers}
          onSave={saveJob}
          onDelete={deleteJob}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
