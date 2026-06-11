import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Incorrect email or password')
      setLoading(false)
    }
    // On success, App.jsx will detect the session change and show the main app
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-900 px-6 safe-top">
      <div className="w-full max-w-sm">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 40 40" className="w-10 h-10">
              <rect width="40" height="40" rx="8" fill="#0f172a"/>
              <rect x="17" y="4" width="6" height="18" rx="3" fill="#38bdf8"/>
              <rect x="13" y="21" width="14" height="4" rx="2" fill="#7dd3fc"/>
              <circle cx="20" cy="33" r="4" fill="none" stroke="#38bdf8" strokeWidth="2"/>
            </svg>
          </div>
          <h1 className="text-white font-bold text-2xl tracking-tight">Flow State</h1>
          <p className="text-slate-400 text-sm mt-1">Suspension servicing tracker</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoComplete="email"
            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 border border-slate-700"
          />

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete="current-password"
            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 border border-slate-700"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 text-sm transition-colors mt-1"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
