import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useData() {
  const [jobs, setJobs] = useState([])
  const [customers, setCustomers] = useState([])
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async (opts) => {
    // Background refreshes (realtime, reorder) skip the spinner so the UI doesn't flash
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const [{ data: jobsData, error: jobsErr }, { data: custsData, error: custsErr }, { data: todosData, error: todosErr }] =
        await Promise.all([
          supabase
            .from('jobs')
            .select('*, units(*), customers(id, name, email, phone)')
            .eq('archived', false)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('drop_off_date', { ascending: true }),
          supabase.from('customers').select('*').order('name'),
          supabase.from('todos').select('*').order('due_date').order('created_at'),
        ])
      if (jobsErr) throw jobsErr
      if (custsErr) throw custsErr
      if (todosErr) throw todosErr
      setJobs(jobsData || [])
      setCustomers(custsData || [])
      setTodos(todosData || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()

    const silentRefresh = () => fetchAll({ silent: true })
    const jobsSub = supabase
      .channel('jobs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, silentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, silentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, silentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, silentRefresh)
      .subscribe()

    return () => supabase.removeChannel(jobsSub)
  }, [fetchAll])

  // --- Customers ---
  async function upsertCustomer(data, existingCustomerId) {
    const payload = { name: data.name.trim(), email: data.email || '', phone: data.phone || '' }

    // If we already know which customer this is, update them directly (handles name changes)
    if (existingCustomerId) {
      await supabase.from('customers').update(payload).eq('id', existingCustomerId)
      return existingCustomerId
    }

    // New job: try to find by name to avoid duplicates
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', payload.name)
      .maybeSingle()
    if (existing) {
      await supabase.from('customers').update(payload).eq('id', existing.id)
      return existing.id
    }
    const { data: created, error } = await supabase
      .from('customers')
      .insert(payload)
      .select('id')
      .single()
    if (error) throw error
    return created.id
  }

  async function updateCustomer(id, data) {
    const { error } = await supabase.from('customers').update(data).eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function deleteCustomer(id) {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  // --- Jobs ---
  async function saveJob(jobData, units) {
    const customerId = await upsertCustomer(
      { name: jobData.customer_name, email: jobData.customer_email || '', phone: jobData.customer_phone || '' },
      jobData.customer_id || null
    )

    let jobId = jobData.id
    if (jobId) {
      const { error } = await supabase
        .from('jobs')
        .update({ customer_id: customerId, drop_off_date: jobData.drop_off_date, pickup_date: jobData.pickup_date, notes: jobData.notes })
        .eq('id', jobId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('jobs')
        // Date.now() sits far above the backfilled range, so new jobs land at the
        // bottom of the manual work order until they're dragged into place
        .insert({ customer_id: customerId, drop_off_date: jobData.drop_off_date, pickup_date: jobData.pickup_date, notes: jobData.notes, sort_order: Date.now() })
        .select('id')
        .single()
      if (error) throw error
      jobId = data.id
    }

    // Upsert units — delete removed ones, insert/update rest
    const existingUnitIds = units.filter(u => u.id).map(u => u.id)
    const { data: oldUnits } = await supabase.from('units').select('id').eq('job_id', jobId)
    const toDelete = (oldUnits || []).filter(u => !existingUnitIds.includes(u.id)).map(u => u.id)
    if (toDelete.length) await supabase.from('units').delete().in('id', toDelete)

    for (const unit of units) {
      const payload = { job_id: jobId, brand: unit.brand, model: unit.model, serial_number: unit.serial_number, status: unit.status, parts_notes: unit.parts_notes, price: parseFloat(unit.price) || 0 }
      if (unit.id) {
        await supabase.from('units').update(payload).eq('id', unit.id)
      } else {
        await supabase.from('units').insert(payload)
      }
    }

    await fetchAll()
    return jobId
  }

  async function deleteJob(id) {
    await supabase.from('units').delete().eq('job_id', id)
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  // --- Todos ---
  async function addTodo(text, dueDate) {
    const { error } = await supabase.from('todos').insert({ text, due_date: dueDate })
    if (error) throw error
    await fetchAll()
  }

  async function updateTodo(id, text) {
    const { error } = await supabase.from('todos').update({ text }).eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function toggleTodo(id, completed) {
    const { error } = await supabase.from('todos').update({ completed }).eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function deleteTodo(id) {
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  // Permute a set of jobs among the sort_order slots they already occupy, so
  // jobs outside the visible list keep their position in the global order.
  async function reorderJobs(updates) {
    if (!updates?.length) return
    const byId = new Map(updates.map(u => [u.id, u.sort_order]))
    setJobs(prev => [...prev]
      .map(j => (byId.has(j.id) ? { ...j, sort_order: byId.get(j.id) } : j))
      .sort((a, b) => {
        const av = a.sort_order == null ? Infinity : Number(a.sort_order)
        const bv = b.sort_order == null ? Infinity : Number(b.sort_order)
        if (av !== bv) return av - bv
        return (a.drop_off_date || '').localeCompare(b.drop_off_date || '')
      }))
    const results = await Promise.all(
      updates.map(u => supabase.from('jobs').update({ sort_order: u.sort_order }).eq('id', u.id))
    )
    const failed = results.find(r => r.error)
    if (failed) { await fetchAll({ silent: true }); throw failed.error }
  }

  // Physical movement in and out of the workshop, tracked separately from work
  // status — a job can be finished but still on the shelf waiting to be collected.
  async function setJobTimestamp(id, field, on) {
    const value = on ? new Date().toISOString() : null
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, [field]: value } : j)))
    const { error } = await supabase.from('jobs').update({ [field]: value }).eq('id', id)
    if (error) { await fetchAll({ silent: true }); throw error }
  }

  const setJobArrived   = (id, on) => setJobTimestamp(id, 'arrived_at', on)
  const setJobCollected = (id, on) => setJobTimestamp(id, 'collected_at', on)

  async function archiveJob(id) {
    const { error } = await supabase.from('jobs').update({ archived: true }).eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function restoreJob(id) {
    const { error } = await supabase.from('jobs').update({ archived: false }).eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function updateUnitStatus(unitId, status) {
    const { error } = await supabase.from('units').update({ status }).eq('id', unitId)
    if (error) throw error
    await fetchAll()
  }

  return { jobs, customers, todos, loading, error, saveJob, deleteJob, archiveJob, restoreJob, reorderJobs, setJobArrived, setJobCollected, deleteCustomer, updateCustomer, updateUnitStatus, addTodo, updateTodo, toggleTodo, deleteTodo, refresh: fetchAll }
}
