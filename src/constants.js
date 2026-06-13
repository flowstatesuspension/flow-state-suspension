export const STATUS_CONFIG = {
  booked_in: {
    label: 'Booked In',
    bg: '#3b82f6',
    light: '#eff6ff',
    border: '#93c5fd',
    text: '#1d4ed8',
    tailwind: 'bg-blue-500',
  },
  awaiting_parts: {
    label: 'Awaiting Parts',
    bg: '#ef4444',
    light: '#fef2f2',
    border: '#fca5a5',
    text: '#dc2626',
    tailwind: 'bg-red-500',
  },
  ready: {
    label: 'Ready',
    bg: '#a855f7',
    light: '#faf5ff',
    border: '#d8b4fe',
    text: '#9333ea',
    tailwind: 'bg-purple-500',
  },
  in_progress: {
    label: 'In Progress',
    bg: '#f97316',
    light: '#fff7ed',
    border: '#fdba74',
    text: '#ea580c',
    tailwind: 'bg-orange-500',
  },
  on_hold: {
    label: 'On Hold',
    bg: '#6b7280',
    light: '#f9fafb',
    border: '#d1d5db',
    text: '#374151',
    tailwind: 'bg-gray-500',
  },
  complete: {
    label: 'Complete',
    bg: '#22c55e',
    light: '#f0fdf4',
    border: '#86efac',
    text: '#16a34a',
    tailwind: 'bg-green-500',
  },
}

export const STATUS_ORDER = ['booked_in', 'awaiting_parts', 'ready', 'in_progress', 'on_hold', 'complete']
