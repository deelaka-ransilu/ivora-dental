// scripts/seed.ts
// Resets ALL demo data and recreates it. Run with: npm run seed
// Wipes every table, so only ever point it at this demo project.

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
const demoPassword = process.env.DEMO_PASSWORD

if (!url || !secret || !demoPassword) {
  console.error('Missing SUPABASE_URL, SUPABASE_SECRET_KEY or DEMO_PASSWORD in .env.local')
  process.exit(1)
}

const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const DEMO_DOMAIN = '@ivora-demo.test'
const ANY_UUID = '00000000-0000-0000-0000-000000000000'

// ---------- helpers ----------

function must<T = any>(
  label: string,
  res: { data: any; error: { message: string } | null }
): T {
  if (res.error) {
    console.error(`FAILED at "${label}": ${res.error.message}`)
    process.exit(1)
  }
  return res.data as T
}

async function wipe(table: string, col = 'id') {
  must(`wipe ${table}`, await db.from(table).delete().neq(col, ANY_UUID))
}

// Sri Lanka is UTC+5:30 all year (no daylight saving).
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000

function colomboDate(daysFromToday: number): { iso: string; dow: number } {
  const d = new Date(Date.now() + COLOMBO_OFFSET_MS + daysFromToday * 86400000)
  return { iso: d.toISOString().slice(0, 10), dow: d.getUTCDay() } // dow: 0 = Sunday
}

function at(iso: string, hhmm: string): Date {
  return new Date(`${iso}T${hhmm}:00+05:30`)
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function whenText(d: Date): string {
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ---------- demo data definitions ----------

const BRANCHES = [
  { name: 'Colombo 7', address: 'Fictional address, Colombo 7', phone: '0110000001' },
  { name: 'Nugegoda', address: 'Fictional address, Nugegoda', phone: '0110000002' },
  { name: 'Negombo', address: 'Fictional address, Negombo', phone: '0310000003' },
]

const D = {
  fernando: 'Dr. Anura Fernando',
  silva: 'Dr. Shanika Silva',
  jayawardena: 'Dr. Kasun Jayawardena',
  wick: 'Dr. Ishara Wickramasinghe',
  rajapaksa: 'Dr. Malini Rajapaksa',
}

const SERVICES = [
  { name: 'Consultation', duration_minutes: 30 },
  { name: 'Check-up', duration_minutes: 30 },
  { name: 'Cleaning', duration_minutes: 45 },
  { name: 'Treatment', duration_minutes: 60 },
  { name: 'Follow-up visit', duration_minutes: 30 },
]

// day numbers: 0 = Sunday ... 6 = Saturday
type HoursSpec = { dentist: string; branch: string; days: number[]; start: string; end: string }

const HOURS: HoursSpec[] = [
  // Dr. Fernando works at two branches (Negombo and Colombo 7)
  { dentist: D.fernando, branch: 'Negombo', days: [1, 3, 5], start: '09:00', end: '17:00' },
  { dentist: D.fernando, branch: 'Colombo 7', days: [2, 4], start: '09:00', end: '17:00' },
  { dentist: D.fernando, branch: 'Negombo', days: [6], start: '09:00', end: '13:00' },
  { dentist: D.silva, branch: 'Colombo 7', days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
  { dentist: D.jayawardena, branch: 'Nugegoda', days: [1, 2, 3, 4, 5], start: '10:00', end: '18:00' },
  { dentist: D.jayawardena, branch: 'Nugegoda', days: [6], start: '10:00', end: '14:00' },
  { dentist: D.wick, branch: 'Nugegoda', days: [1, 2, 4], start: '09:00', end: '17:00' },
  { dentist: D.wick, branch: 'Colombo 7', days: [3, 5], start: '09:00', end: '17:00' },
  { dentist: D.rajapaksa, branch: 'Negombo', days: [2, 4], start: '09:00', end: '17:00' },
  { dentist: D.rajapaksa, branch: 'Negombo', days: [6], start: '09:00', end: '13:00' },
]

const PATIENT_NAMES = [
  'Amal Silva', 'Kamala Fernando', 'Sunil Jayasinghe', 'Dilini Weerasinghe',
  'Ruwan Gunasekara', 'Sanduni Herath', 'Chaminda Bandara', 'Tharushi Abeysekara',
  'Prasad Liyanage', 'Nadeesha Karunaratne', 'Isuru Senanayake', 'Hiruni Dissanayake',
]

type DemoUser = {
  email: string
  full_name: string
  role: 'owner' | 'receptionist' | 'dentist'
  branch?: string
  dentist?: string
}

const DEMO_USERS: DemoUser[] = [
  { email: `owner${DEMO_DOMAIN}`, full_name: 'Dr. Nirmala Perera', role: 'owner' },
  { email: `reception.colombo${DEMO_DOMAIN}`, full_name: 'Receptionist Colombo 7', role: 'receptionist', branch: 'Colombo 7' },
  { email: `reception.nugegoda${DEMO_DOMAIN}`, full_name: 'Receptionist Nugegoda', role: 'receptionist', branch: 'Nugegoda' },
  { email: `reception.negombo${DEMO_DOMAIN}`, full_name: 'Receptionist Negombo', role: 'receptionist', branch: 'Negombo' },
  { email: `fernando${DEMO_DOMAIN}`, full_name: D.fernando, role: 'dentist', dentist: D.fernando },
]

// ---------- main ----------

async function main() {
  console.log('Wiping old demo data...')
  await wipe('sms_log')
  await wipe('appointments')
  await wipe('blocked_times')
  await wipe('patients')
  await wipe('dentist_branch_hours')
  await wipe('dentist_services', 'dentist_id')
  await wipe('profiles')

  const list = must<{ users: { id: string; email?: string }[] }>(
    'list auth users',
    await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  )
  for (const u of list.users.filter((u) => u.email?.endsWith(DEMO_DOMAIN))) {
    must(`delete auth user ${u.email}`, await db.auth.admin.deleteUser(u.id))
  }

  await wipe('dentists')
  await wipe('services')
  await wipe('branches')

  console.log('Creating branches, dentists, services...')
  const branchRows = must<any[]>('branches', await db.from('branches').insert(BRANCHES).select())
  const branchId: Record<string, string> = Object.fromEntries(branchRows.map((b) => [b.name, b.id]))
  const branchName: Record<string, string> = Object.fromEntries(branchRows.map((b) => [b.id, b.name]))

  const dentistRows = must<any[]>(
    'dentists',
    await db.from('dentists').insert(Object.values(D).map((full_name) => ({ full_name }))).select()
  )
  const dentistId: Record<string, string> = Object.fromEntries(dentistRows.map((d) => [d.full_name, d.id]))

  const serviceRows = must<any[]>('services', await db.from('services').insert(SERVICES).select())
  const service: Record<string, { id: string; duration: number }> = Object.fromEntries(
    serviceRows.map((s) => [s.name, { id: s.id, duration: s.duration_minutes }])
  )

  // Every dentist offers every service, except Dr. Rajapaksa (no Treatment).
  const offered: Record<string, string[]> = {}
  for (const name of Object.values(D)) {
    offered[name] = SERVICES.map((s) => s.name).filter((s) => !(name === D.rajapaksa && s === 'Treatment'))
  }
  must(
    'dentist_services',
    await db.from('dentist_services').insert(
      Object.entries(offered).flatMap(([dName, svcs]) =>
        svcs.map((s) => ({ dentist_id: dentistId[dName], service_id: service[s].id }))
      )
    )
  )

  must(
    'dentist_branch_hours',
    await db.from('dentist_branch_hours').insert(
      HOURS.flatMap((h) =>
        h.days.map((day) => ({
          dentist_id: dentistId[h.dentist],
          branch_id: branchId[h.branch],
          day_of_week: day,
          start_time: h.start,
          end_time: h.end,
        }))
      )
    )
  )

  console.log('Creating demo logins...')
  const receptionistByBranch: Record<string, string> = {}
  for (const u of DEMO_USERS) {
    const created = must<{ user: { id: string } }>(
      `create auth user ${u.email}`,
      await db.auth.admin.createUser({ email: u.email, password: demoPassword, email_confirm: true })
    )
    const id = created.user.id
    must(
      `profile ${u.email}`,
      await db.from('profiles').insert({
        id,
        full_name: u.full_name,
        role: u.role,
        branch_id: u.branch ? branchId[u.branch] : null,
        dentist_id: u.dentist ? dentistId[u.dentist] : null,
      })
    )
    if (u.role === 'receptionist' && u.branch) receptionistByBranch[u.branch] = id
  }

  console.log('Creating patients...')
  const patientRows = must<any[]>(
    'patients',
    await db
      .from('patients')
      .insert(
        PATIENT_NAMES.map((full_name, i) => ({
          full_name,
          phone: `0770000${String(i + 1).padStart(3, '0')}`, // obviously fake numbers
          consent_given_at: new Date().toISOString(),
        }))
      )
      .select()
  )
  const patientById: Record<string, any> = Object.fromEntries(patientRows.map((p) => [p.id, p]))

  console.log('Creating closure and appointments...')
  const closure = colomboDate(3)
  must(
    'blocked_times',
    await db.from('blocked_times').insert({
      branch_id: branchId['Nugegoda'],
      start_at: at(closure.iso, '00:00').toISOString(),
      end_at: at(colomboDate(4).iso, '00:00').toISOString(),
      reason: 'Branch closed (demo)',
    })
  )

  const SOURCES = ['online', 'online', 'phone', 'walk_in']
  const apptRows: any[] = []
  let n = 0

  for (let day = -1; day <= 5; day++) {
    const { iso, dow } = colomboDate(day)
    for (const h of HOURS) {
      if (!h.days.includes(dow)) continue
      if (h.branch === 'Nugegoda' && iso === closure.iso) continue // closed that day

      const svcNames = offered[h.dentist]
      for (const offset of [30, 150, 270]) {
        n++
        if (n % 4 === 0) continue // leave some free slots
        const svc = service[svcNames[n % svcNames.length]]
        const startMin = toMin(h.start) + offset
        const endMin = startMin + svc.duration
        if (endMin > toMin(h.end)) continue

        const source = SOURCES[n % SOURCES.length]
        apptRows.push({
          patient_id: patientRows[n % patientRows.length].id,
          branch_id: branchId[h.branch],
          dentist_id: dentistId[h.dentist],
          service_id: svc.id,
          start_at: at(iso, toHHMM(startMin)).toISOString(),
          end_at: at(iso, toHHMM(endMin)).toISOString(),
          status: apptRows.length === 4 ? 'cancelled' : 'booked',
          source,
          created_by: source === 'online' ? null : receptionistByBranch[h.branch],
        })
      }
    }
  }

  const apptInserted = must<any[]>('appointments', await db.from('appointments').insert(apptRows).select())

  console.log('Creating simulated SMS log...')
  const smsRows = apptInserted
    .filter((a) => a.source === 'online' && a.status === 'booked')
    .map((a) => {
      const p = patientById[a.patient_id]
      const first = p.full_name.split(' ')[0]
      return {
        appointment_id: a.id,
        to_phone: p.phone,
        message: `Ivora Dental: Hi ${first}, your appointment at ${branchName[a.branch_id]} is booked for ${whenText(new Date(a.start_at))}. Please call the branch if you need to change it.`,
      }
    })
  if (smsRows.length > 0) must('sms_log', await db.from('sms_log').insert(smsRows))

  console.log('')
  console.log('Seed finished.')
  console.log(`  branches: ${branchRows.length}`)
  console.log(`  dentists: ${dentistRows.length}`)
  console.log(`  services: ${serviceRows.length}`)
  console.log(`  logins: ${DEMO_USERS.length}`)
  console.log(`  patients: ${patientRows.length}`)
  console.log(`  appointments: ${apptInserted.length}`)
  console.log(`  simulated SMS: ${smsRows.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})