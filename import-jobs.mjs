const SUPABASE_URL = 'https://qjuufpvfqfmuvlggepjt.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const headers = {
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

async function get(table, params) {
  const qs = new URLSearchParams(params).toString()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers })
  if (!r.ok) throw new Error(`GET ${table}: ${await r.text()}`)
  return r.json()
}

async function post(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`POST ${table}: ${await r.text()}`)
  return r.json()
}

// ── Raw CSV rows ───────────────────────────────────────────────────────────────
const rows = [
  { drop_off: '21/12/2025', name: 'Ben Kelly',           brand: 'Fox',      model: 'Transfer',     note: 'Seat Post Service',                            price: 100.00,  phone: '+44 7702 158559' },
  { drop_off: '09/01/2026', name: 'Cesar Abruc',         brand: 'Fox',      model: 'Float X',      note: 'Float X Service',                             price: 120.00,  phone: '+44 7453 294436' },
  { drop_off: '29/01/2026', name: 'Danny Hopwood',       brand: 'Fox',      model: '40',           note: 'Fox 40 & DHX2 Service',                       price: 240.00,  phone: '+44 7930 430265' },
  { drop_off: '29/01/2026', name: 'Danny Hopwood',       brand: 'Fox',      model: 'DHX2',         note: 'Fox 40 & DHX2 Service',                       price: 240.00,  phone: '+44 7930 430265' },
  { drop_off: '09/01/2026', name: 'Daryn Peters',        brand: 'Fox',      model: '38',           note: 'Fox 38 Service & Stanchion',                  price: 330.00,  phone: '+44 7725 984350' },
  { drop_off: '22/01/2026', name: 'Keith Buchan',        brand: 'Fox',      model: '34',           note: 'Fox 34 Service + Remote & Specialized Brain', price: 600.90,  phone: '+44 7909 962970' },
  { drop_off: '17/01/2026', name: 'Andrew Knox',         brand: 'Fox',      model: '36',           note: 'Fox 36 Service + DPX2 Service',               price: 240.00,  phone: '+44 7900 215112' },
  { drop_off: '17/01/2026', name: 'Andrew Knox',         brand: 'Fox',      model: 'DPX2',         note: 'Fox 36 Service + DPX2 Service',               price: 240.00,  phone: '+44 7900 215112' },
  { drop_off: '25/01/2026', name: 'Dru Del Rosario',     brand: 'Fox',      model: 'Grip',         note: 'Fox 38 Damper Service',                       price: 60.00,   phone: '+44 7879 590479' },
  { drop_off: '25/01/2026', name: 'Dru Del Rosario',     brand: 'Fox',      model: 'Grip',         note: 'Fox 40 Damper Service',                       price: 60.00,   phone: '+44 7879 590479' },
  { drop_off: '25/01/2026', name: 'Dru Del Rosario',     brand: 'Fox',      model: 'Grip',         note: 'Fox 38 Damper Service',                       price: 60.00,   phone: '+44 7879 590479' },
  { drop_off: '21/01/2026', name: 'Simon CCCC',          brand: 'Fox',      model: 'DHX2',         note: 'DHX Service (trade)',                          price: 108.00,  phone: '' },
  { drop_off: '29/01/2026', name: 'Colin Bull',          brand: 'Rockshox', model: 'Lyrik',        note: 'Lyrik Select & Super Deluxe Service',         price: 240.00,  phone: '+44 7736 644192' },
  { drop_off: '29/01/2026', name: 'Colin Bull',          brand: 'Rockshox', model: 'Super Deluxe', note: 'Lyrik Select & Super Deluxe Service',         price: 240.00,  phone: '+44 7736 644192' },
  { drop_off: '11/02/2026', name: 'Ben Townsend',        brand: 'Fox',      model: '36',           note: 'Airspring Upgrade + 50hr Service',            price: 135.00,  phone: '+44 7856 924941' },
  { drop_off: '12/02/2026', name: 'Chris Orr',           brand: 'Fox',      model: '34',           note: 'DPS & Fox 34 Service',                        price: 240.00,  phone: '+44 7540 705117' },
  { drop_off: '12/02/2026', name: 'Chris Orr',           brand: 'Fox',      model: 'DOS',          note: 'DPS & Fox 34 Service',                        price: 240.00,  phone: '+44 7540 705117' },
  { drop_off: '09/02/2026', name: 'John Duncan',         brand: 'Fox',      model: '36',           note: 'Float X & Fox 36 Full service',               price: 240.00,  phone: '+44 7896 600398' },
  { drop_off: '09/02/2026', name: 'John Duncan',         brand: 'Fox',      model: 'Float X',      note: 'Float X & Fox 36 Full service',               price: 240.00,  phone: '+44 7896 600398' },
  { drop_off: '25/02/2026', name: 'Blazej Boguszewski',  brand: 'Rockshox', model: 'Super Deluxe', note: 'RS Super Deluxe Service',                     price: 120.00,  phone: '' },
  { drop_off: '27/02/2026', name: 'Nick Mackie',         brand: 'Fox',      model: '38',           note: 'Fox 38 Service & Damper Piston Replace',      price: 176.00,  phone: '+44 7595 484104' },
  { drop_off: '27/02/2026', name: 'Nigel Slinn',         brand: 'Other',    model: 'MRP Raven',    note: 'MRP Raven Full Service',                      price: 120.00,  phone: '' },
  { drop_off: '01/03/2026', name: 'Andrew Readle',       brand: 'Fox',      model: 'X2',           note: 'Fox X2 Service + Bearing Assembly',           price: 152.50,  phone: '+44 7960 681418' },
  { drop_off: '01/03/2026', name: 'Andrew Readle',       brand: 'Fox',      model: '36',           note: 'Fox 36 CSU Repair',                           price: 160.00,  phone: '+44 7960 681418' },
  { drop_off: '03/03/2026', name: 'Duncan Goad',         brand: 'Rockshox', model: 'SID SL',       note: 'SID SL Service',                              price: 120.00,  phone: '+44 7950 711140' },
  { drop_off: '04/03/2026', name: 'Sean Guild',          brand: 'Rockshox', model: 'Super Deluxe', note: 'Super DLX Ult Coil Service',                  price: 120.00,  phone: '' },
  { drop_off: '05/03/2026', name: 'Nagore Elu',          brand: 'Fox',      model: '36',           note: 'Fox 36 Service',                              price: 120.00,  phone: '' },
  { drop_off: '10/03/2026', name: 'Dougie Philip',       brand: 'Fox',      model: 'Genie',        note: 'Float Genie Air Service, Fox 38 Air',         price: 130.00,  phone: '+44 7748 306531' },
  { drop_off: '14/03/2026', name: 'Manuel Bermudez',     brand: 'Other',    model: 'DVO Onyx',     note: 'DVO Onyx Service',                            price: 120.00,  phone: '+44 7513 762590' },
  { drop_off: '17/03/2026', name: 'Chris Buchan',        brand: 'Rockshox', model: 'SID SL',       note: 'SID SL Ultimate (Race Day)',                  price: 120.00,  phone: '+44 7876 861267' },
  { drop_off: '14/04/2026', name: 'Rob Troaker',         brand: 'Fox',      model: '38',           note: 'Fox 38 & Float X Full Service',               price: 240.00,  phone: '+44 7503 594073' },
  { drop_off: '14/04/2026', name: 'Rob Troaker',         brand: 'Fox',      model: 'Float X',      note: 'Fox 38 & Float X Full Service',               price: 240.00,  phone: '+44 7503 594073' },
  { drop_off: '15/04/2026', name: 'Josh Allan',          brand: 'Fox',      model: 'DHX2',         note: 'DHX2 Service',                                price: 150.00,  phone: '+44 7858 088766' },
  { drop_off: '15/04/2026', name: 'Ashley Holland',      brand: 'Fox',      model: '36',           note: 'Fox 36 & X2 Service',                         price: 285.00,  phone: '+44 7505 570282' },
  { drop_off: '15/04/2026', name: 'Ashley Holland',      brand: 'Fox',      model: 'X2',           note: 'Fox 36 & X2 Service',                         price: 285.00,  phone: '+44 7505 570282' },
  { drop_off: '16/04/2026', name: 'Martin Folley',       brand: 'Fox',      model: '36',           note: 'Fox 36 & DHX',                                price: 255.00,  phone: '+44 7854 086930' },
  { drop_off: '16/04/2026', name: 'Martin Folley',       brand: 'Fox',      model: 'DHX2',         note: 'Fox 36 & DHX',                                price: 255.00,  phone: '+44 7854 086930' },
  { drop_off: '16/04/2026', name: 'Rory Purdie',         brand: 'Fox',      model: '40',           note: 'Fox 40 & X2 Full Service',                   price: 285.00,  phone: '+44 7951 824207' },
  { drop_off: '16/04/2026', name: 'Rory Purdie',         brand: 'Fox',      model: 'X2',           note: 'Fox 40 & X2 Full Service',                   price: 285.00,  phone: '+44 7951 824207' },
  { drop_off: '27/04/2026', name: 'Beth Urquhart',       brand: 'Postage',  model: 'Royal Mail',   note: 'Warranty Return Lyrik',                       price: 15.00,   phone: '+44 7810 832693' },
]

function parseDate(str) {
  const [d, m, y] = str.split('/')
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Group into jobs
const jobMap = {}
for (const row of rows) {
  const key = `${row.name}||${row.drop_off}`
  if (!jobMap[key]) jobMap[key] = { name: row.name, phone: row.phone, drop_off: row.drop_off, note: row.note, units: [] }
  jobMap[key].units.push({ brand: row.brand, model: row.model, rawPrice: row.price })
}

const jobs = Object.values(jobMap).map(job => {
  const count = job.units.length
  return {
    ...job,
    drop_off_date: parseDate(job.drop_off),
    pickup_date:   addDays(parseDate(job.drop_off), 2),
    units: job.units.map(u => ({
      brand: u.brand, model: u.model,
      price: parseFloat((u.rawPrice / count).toFixed(2)),
      status: 'complete',
    })),
  }
})

console.log(`\nImporting ${jobs.length} jobs (${rows.length} units)...\n`)

for (const job of jobs) {
  // Find or create customer
  const existing = await get('customers', { name: `ilike.${job.name.trim()}`, select: 'id', limit: 1 })
  let customerId
  if (existing.length) {
    customerId = existing[0].id
    console.log(`  Customer exists: ${job.name}`)
  } else {
    const [created] = await post('customers', { name: job.name.trim(), phone: job.phone || '', email: '' })
    customerId = created.id
    console.log(`  Created customer: ${job.name}`)
  }

  // Insert job
  const [newJob] = await post('jobs', {
    customer_id:   customerId,
    drop_off_date: job.drop_off_date,
    pickup_date:   job.pickup_date,
    notes:         job.note || '',
  })

  // Insert units
  for (const unit of job.units) {
    await post('units', {
      job_id: newJob.id,
      brand:  unit.brand,
      model:  unit.model,
      price:  unit.price,
      status: unit.status,
      serial_number: '',
      parts_notes:   '',
    })
    console.log(`    ${unit.brand} ${unit.model} — £${unit.price}`)
  }

  console.log(`  ✓ Job: ${job.name} ${job.drop_off_date}`)
}

console.log('\n✓ Import complete.\n')
