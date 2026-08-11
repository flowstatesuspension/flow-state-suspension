import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useData() {
  const [jobs, setJobs] = useState([])
  const [customers, setCustomers] = useState([])
  const [todos, setTodos] = useState([])
  const [bookingRequests, setBookingRequests] = useState([])
  const [bookingClosures, setClosuresState] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async (opts) => {
    // Background refreshes (realtime, reorder) skip the spinner so the UI doesn't flash
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const [
        { data: jobsData, error: jobsErr },
        { data: custsData, error: custsErr },
        { data: todosData, error: todosErr },
        { data: bookingData, error: bookingErr },
        { data: closureData, error: closureErr },
      ] = await Promise.all([
        supabase
          .from('jobs')
          .select('*, units(*), customers(id, name, email, phone)')
          .eq('archived', false)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('drop_off_date', { ascending: true }),
        supabase.from('customers').select('*').order('name'),
        supabase.from('todos').select('*').order('due_date').order('created_at'),
        supabase.from('booking_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('booking_closures').select('*').order('closed_date'),
      ])
      if (jobsErr) throw jobsErr
      if (custsErr) throw custsErr
      if (todosErr) throw todosErr
      setJobs(jobsData || [])
      setCustomers(custsData || [])
      setTodos(todosData || [])
      // Booking tables are newer — don't take the whole app down if the
      // migration hasn't been run yet
      setBookingRequests(bookingErr ? [] : (bookingData || []))
      setClosuresState(closureErr ? [] : (closureData || []))
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, silentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_closures' }, silentRefresh)
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

  // Takes their jobs and units with it. Without this the jobs survive with a
  // dangling customer_id and turn up nameless across the app.
  async function deleteCustomer(id) {
    const { data: theirJobs, error: findErr } = await supabase
      .from('jobs').select('id').eq('customer_id', id)
    if (findErr) throw findErr

    const jobIds = (theirJobs || []).map(j => j.id)
    if (jobIds.length) {
      const { error: unitErr } = await supabase.from('units').delete().in('job_id', jobIds)
      if (unitErr) throw unitErr
      const { error: jobErr } = await supabase.from('jobs').delete().in('id', jobIds)
      if (jobErr) throw jobErr
    }

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

  // --- Booking ---
  // Turn a public request into a real customer + job. Nothing reaches the jobs
  // table until this runs, so a submission alone can never create workshop data.
  async function acceptBooking(req, existingCustomerId, defaultPrice = 120) {
    const customerId = await upsertCustomer(
      { name: req.name, email: req.email || '', phone: req.phone || '' },
      existingCustomerId || null
    )

    const turnaround = 3
    const pickup = new Date(req.slot_date)
    pickup.setDate(pickup.getDate() + turnaround)

    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        customer_id: customerId,
        drop_off_date: req.slot_date,
        pickup_date: pickup.toISOString().slice(0, 10),
        notes: req.notes || null,
        sort_order: Date.now(),
      })
      .select('id')
      .single()
    if (jobErr) throw jobErr

    const items = Array.isArray(req.items) ? req.items : []
    if (items.length) {
      const { error: unitErr } = await supabase.from('units').insert(
        items.map(it => ({
          job_id: job.id,
          brand: it.brand || '',
          model: it.model || '',
          serial_number: it.serial_number || '',
          status: 'booked_in',
          parts_notes: it.notes || '',
          price: defaultPrice,
        }))
      )
      if (unitErr) throw unitErr
    }

    const { error: reqErr } = await supabase
      .from('booking_requests')
      .update({ status: 'accepted', customer_id: customerId, job_id: job.id, decided_at: new Date().toISOString() })
      .eq('id', req.id)
    if (reqErr) throw reqErr

    await fetchAll({ silent: true })
    return job.id
  }

  // Remove a request outright — for tests and mistakes. Rejecting keeps the
  // record; this erases it.
  async function deleteBookingRequest(id) {
    const { error } = await supabase.from('booking_requests').delete().eq('id', id)
    if (error) throw error
    await fetchAll({ silent: true })
  }

  async function rejectBooking(req) {
    const { error } = await supabase
      .from('booking_requests')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', req.id)
    if (error) throw error
    await fetchAll({ silent: true })
  }

  // Availability is a blocklist: a row here means that day is shut.
  async function setBookingClosures(dates, closed) {
    if (!dates?.length) return
    // Optimistic — the calendar should respond to the tap, not the round trip
    setClosuresState(prev => closed
      ? [...prev.filter(c => !dates.includes(c.closed_date)), ...dates.map(d => ({ closed_date: d }))]
      : prev.filter(c => !dates.includes(c.closed_date)))

    const { error } = closed
      ? await supabase.from('booking_closures').upsert(
          dates.map(d => ({ closed_date: d })), { onConflict: 'closed_date' })
      : await supabase.from('booking_closures').delete().in('closed_date', dates)

    if (error) { await fetchAll({ silent: true }); throw error }
    await fetchAll({ silent: true })
  }

  const setBookingClosure = (date, closed) => setBookingClosures([date], closed)

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

  return { jobs, customers, todos, bookingRequests, bookingClosures, loading, error, saveJob, deleteJob, archiveJob, restoreJob, reorderJobs, setJobArrived, setJobCollected, deleteCustomer, updateCustomer, updateUnitStatus, addTodo, updateTodo, toggleTodo, deleteTodo, acceptBooking, rejectBooking, deleteBookingRequest, setBookingClosure, setBookingClosures, refresh: fetchAll }
}
