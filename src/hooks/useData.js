import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useData() {
  const [jobs, setJobs] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: jobsData, error: jobsErr }, { data: custsData, error: custsErr }] =
        await Promise.all([
          supabase
            .from('jobs')
            .select('*, units(*), customers(id, name, email, phone)')
            .eq('archived', false)
            .order('drop_off_date', { ascending: true }),
          supabase.from('customers').select('*').order('name'),
        ])
      if (jobsErr) throw jobsErr
      if (custsErr) throw custsErr
      setJobs(jobsData || [])
      setCustomers(custsData || [])
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
      .subscribe()

    return () => supabase.removeChannel(jobsSub)
  }, [fetchAll])

  // --- Customers ---
  async function upsertCustomer(data) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', data.name.trim())
      .maybeSingle()
    if (existing) {
      await supabase.from('customers').update(data).eq('id', existing.id)
      return existing.id
    }
    const { data: created, error } = await supabase
      .from('customers')
      .insert({ ...data, name: data.name.trim() })
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
    const customerId = await upsertCustomer({ name: jobData.customer_name, email: jobData.customer_email || '', phone: jobData.customer_phone || '' })

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

  return { jobs, customers, loading, error, saveJob, deleteJob, archiveJob, restoreJob, deleteCustomer, updateCustomer, updateUnitStatus, refresh: fetchAll }
}
