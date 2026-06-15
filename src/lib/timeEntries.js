import { supabase } from './supabase'

export async function startEntry(jobId, unitId) {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({ job_id: jobId, unit_id: unitId, started_at: new Date().toISOString() })
    .select('id, started_at')
    .single()
  if (error) throw error
  return data
}

export async function stopEntry(id, startedAt) {
  const stoppedAt = new Date()
  const durationSeconds = Math.max(1, Math.round((stoppedAt - new Date(startedAt)) / 1000))
  const { error } = await supabase
    .from('time_entries')
    .update({ stopped_at: stoppedAt.toISOString(), duration_seconds: durationSeconds })
    .eq('id', id)
  if (error) throw error
  return durationSeconds
}

export async function getEntriesForUnit(unitId) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('unit_id', unitId)
    .order('started_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function updateEntryDuration(id, durationSeconds) {
  const { error } = await supabase
    .from('time_entries')
    .update({ duration_seconds: durationSeconds })
    .eq('id', id)
  if (error) throw error
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('time_entries').delete().eq('id', id)
  if (error) throw error
}

export function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}
