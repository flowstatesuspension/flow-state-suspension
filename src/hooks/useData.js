import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useData() {
  const [jobs, setJobs] = useState([])
  const [customers, setCustomers] = useState([])
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: jobsData, error: jobsErr }, { data: custsData, error: custsErr }, { data: todosData, error: todosErr }] =
        await Promise.all([
          supabase
            .from('jobs')
            .select('*, units(*), customers(id, name, email, phone)')
            .eq('archived', false)
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

    const jobsSub = supabase
      .channel('jobs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, fetchAll)
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
        .insert({ customer_id: customerId, drop_off_date: jobData.drop_off_date, pickup_date: jobData.pickup_date, notes: jobData.notes })
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

  return { jobs, customers, todos, loading, error, saveJob, deleteJob, archiveJob, restoreJob, deleteCustomer, updateCustomer, updateUnitStatus, addTodo, updateTodo, toggleTodo, deleteTodo, refresh: fetchAll }
}
