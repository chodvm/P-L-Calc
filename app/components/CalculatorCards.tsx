'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'

type StaffRole =
  | 'Physician'
  | 'PA'
  | 'RN'
  | 'LVN'
  | 'MA'
  | 'Xray Tech'
  | 'Front Desk'
  | 'Admin'

type Staff = {
  id: string
  full_name: string
  role: StaffRole
  base_hourly_rate: number
  default_daily_hours: number | null
  active?: boolean
}

type Picked = { id: string; hours: number }

function isoToday() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export default function CalculatorCards() {
  // core data
  const [staff, setStaff] = useState<Staff[]>([])
  const [orgAvgReimb, setOrgAvgReimb] = useState<number>(0)
  const [dailyFixedCost, setDailyFixedCost] = useState<number>(0)

  // date & targets
  const [workDate, setWorkDate] = useState<string>(isoToday())
  const [patientsSeen, setPatientsSeen] = useState<number>(0)
  const [targetType, setTargetType] = useState<'margin' | 'amount'>('margin')
  const [targetMargin, setTargetMargin] = useState<number>(20)
  const [targetAmount, setTargetAmount] = useState<number>(0)

  // selected lists (with per-person hours)
  const [pickedPhysicians, setPickedPhysicians] = useState<Picked[]>([])
  const [pickedOthers, setPickedOthers] = useState<Picked[]>([])

  // add controls
  const [physicianToAdd, setPhysicianToAdd] = useState<string>('')
  const [physicianHours, setPhysicianHours] = useState<number>(8)
  const [staffToAdd, setStaffToAdd] = useState<string>('')
  const [staffHours, setStaffHours] = useState<number>(8)

  // save state
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string>('')

  // derived groups
  const physicians = useMemo(
    () => staff.filter((s) => s.role === 'Physician' && s.active !== false),
    [staff]
  )
  const others = useMemo(
    () => staff.filter((s) => s.role !== 'Physician' && s.active !== false),
    [staff]
  )

  const selectedIds = useMemo(
    () => new Set([...pickedPhysicians, ...pickedOthers].map((p) => p.id)),
    [pickedPhysicians, pickedOthers]
  )

  const availablePhysicians = useMemo(
    () => physicians.filter((p) => !selectedIds.has(p.id)),
    [physicians, selectedIds]
  )
  const availableOthers = useMemo(
    () => others.filter((p) => !selectedIds.has(p.id)),
    [others, selectedIds]
  )

  // load initial data
  useEffect(() => {
    const run = async () => {
      const s = supabaseBrowser()

      // staff
      const st = await s
        .from('staff')
        .select('id,full_name,role,base_hourly_rate,default_daily_hours,active')
        .order('role')
        .order('full_name')
      setStaff(st.data ?? [])

      // avg reimbursement
      const r = await s.from('v_org_avg_reimbursement').select('org_avg_reimb').limit(1)
      setOrgAvgReimb(Number(r.data?.[0]?.org_avg_reimb ?? 0))

      // fixed cost (sum of daily amounts)
      const f = await s.from('v_fixed_costs_daily').select('daily_amount')
      const totalF = (f.data ?? []).reduce((acc: number, row: any) => acc + Number(row.daily_amount || 0), 0)
      setDailyFixedCost(totalF)
    }
    run()
  }, [])

  // helpers
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff])

  const addPhysician = () => {
    if (!physicianToAdd) return
    const s = staffById.get(physicianToAdd)
    const hours = Number(physicianHours || s?.default_daily_hours || 8)
    setPickedPhysicians((prev) =>
      prev.some((p) => p.id === physicianToAdd) ? prev : [...prev, { id: physicianToAdd, hours }]
    )
    setPhysicianToAdd('')
    setPhysicianHours(8)
  }

  const addStaff = () => {
    if (!staffToAdd) return
    const s = staffById.get(staffToAdd)
    const hours = Number(staffHours || s?.default_daily_hours || 8)
    setPickedOthers((prev) =>
      prev.some((p) => p.id === staffToAdd) ? prev : [...prev, { id: staffToAdd, hours }]
    )
    setStaffToAdd('')
    setStaffHours(8)
  }

  const updateHours = (list: 'phys' | 'other', id: string, hours: number) => {
    if (list === 'phys') {
      setPickedPhysicians((prev) => prev.map((p) => (p.id === id ? { ...p, hours } : p)))
    } else {
      setPickedOthers((prev) => prev.map((p) => (p.id === id ? { ...p, hours } : p)))
    }
  }

  const removePicked = (list: 'phys' | 'other', id: string) => {
    if (list === 'phys') {
      setPickedPhysicians((prev) => prev.filter((p) => p.id !== id))
    } else {
      setPickedOthers((prev) => prev.filter((p) => p.id !== id))
    }
  }

  // calculations
  const laborCost = useMemo(() => {
    const calc = (picks: Picked[]) =>
      picks.reduce((sum, p) => {
        const s = staffById.get(p.id)
        if (!s) return sum
        return sum + Number(s.base_hourly_rate) * Number(p.hours || 0)
      }, 0)
    return calc(pickedPhysicians) + calc(pickedOthers)
  }, [pickedPhysicians, pickedOthers, staffById])

  const avgReimb = orgAvgReimb || 0
  const revenueSoFar = Number(patientsSeen || 0) * avgReimb
  const profitNow = revenueSoFar - (laborCost + dailyFixedCost) // materials cost currently 0

  const patientsForTarget = useMemo(() => {
    if (!avgReimb || avgReimb <= 0) return null
    const totalCost = laborCost + dailyFixedCost
    if (targetType === 'margin') {
      const denom = 1 - targetMargin / 100
      if (denom <= 0) return null
      return totalCost / (avgReimb * denom)
    } else {
      return (totalCost + targetAmount) / avgReimb
    }
  }, [avgReimb, laborCost, dailyFixedCost, targetType, targetMargin, targetAmount])

  // save day (RPC, then adjust hours)
  const saveDay = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const s = supabaseBrowser()

      const { data: orgs, error: orgErr } = await s.from('orgs').select('id').limit(1)
      if (orgErr) throw orgErr
      const orgId = orgs?.[0]?.id
      if (!orgId) throw new Error('No org found')

      const allPicked = [...pickedPhysicians, ...pickedOthers]
      const staffIds = allPicked.map((p) => p.id)

      // 1) upsert daily_log + insert assignments (with default hours)
      const { data: dlId, error: rpcErr } = await s.rpc('save_daily_log_and_assignments', {
        p_org: orgId,
        p_work_date: workDate,
        p_patients_seen: patientsSeen,
        p_staff_ids: staffIds,
      })
      if (rpcErr) throw rpcErr
      const dailyLogId: string = Array.isArray(dlId) ? dlId[0] : dlId

      // 2) update hours_worked to custom hours
      for (const p of allPicked) {
        const { error: upErr } = await s
          .from('daily_staff_assignments')
          .update({ hours_worked: p.hours })
          .eq('org_id', orgId)
          .eq('daily_log_id', dailyLogId)
          .eq('staff_id', p.id)
        if (upErr) throw upErr
      }

      setSaveMsg('Saved ✔')
    } catch (e: any) {
      setSaveMsg(`Save failed: ${e?.message ?? e}`)
    } finally {
      setSaving(false)
    }
  }

  // UI — keep the two big card shells and add “Add Physician / Add Staff” flows
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* LEFT COLUMN — two card shells */}
      <div className="space-y-4">
        {/* Physicians card */}
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-3">Physicians</h2>

          {/* Add flow */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              className="border rounded-xl px-3 py-2 min-w-[220px]"
              value={physicianToAdd}
              onChange={(e) => {
                const id = e.target.value
                setPhysicianToAdd(id)
                const s = staffById.get(id)
                setPhysicianHours(Number(s?.default_daily_hours ?? 8))
              }}
            >
              <option value="">Select physician…</option>
              {availablePhysicians.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — ${p.base_hourly_rate}/hr (default {p.default_daily_hours ?? 8}h)
                </option>
              ))}
            </select>
            <input
              type="number"
              className="border rounded-xl px-3 py-2 w-24"
              value={physicianHours}
              onChange={(e) => setPhysicianHours(Number(e.target.value))}
              min={0}
              step="0.25"
              placeholder="hrs"
            />
            <button onClick={addPhysician} className="rounded-xl bg-slate-900 text-white px-4 py-2">
              Add physician
            </button>
          </div>

          {/* Picked list */}
          {pickedPhysicians.length === 0 ? (
            <div className="text-sm text-slate-500">No physicians selected.</div>
          ) : (
            <div className="space-y-2">
              {pickedPhysicians.map((p) => {
                const s = staffById.get(p.id)!
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border rounded-xl p-2"
                  >
                    <div className="text-sm">
                      <div className="font-medium">{s.full_name}</div>
                      <div className="text-slate-500">
                        ${s.base_hourly_rate}/hr
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600">Hours</label>
                      <input
                        type="number"
                        className="border rounded-xl px-2 py-1 w-24"
                        value={p.hours}
                        min={0}
                        step="0.25"
                        onChange={(e) => updateHours('phys', p.id, Number(e.target.value))}
                      />
                      <button
                        onClick={() => removePicked('phys', p.id)}
                        className="rounded-lg border px-3 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* All Other Staff card */}
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-3">All Other Staff</h2>

          {/* Add flow */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              className="border rounded-xl px-3 py-2 min-w-[260px]"
              value={staffToAdd}
              onChange={(e) => {
                const id = e.target.value
                setStaffToAdd(id)
                const s = staffById.get(id)
                setStaffHours(Number(s?.default_daily_hours ?? 8))
              }}
            >
              <option value="">Select staff…</option>
              {availableOthers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role}) — ${p.base_hourly_rate}/hr (default {p.default_daily_hours ?? 8}h)
                </option>
              ))}
            </select>
            <input
              type="number"
              className="border rounded-xl px-3 py-2 w-24"
              value={staffHours}
              onChange={(e) => setStaffHours(Number(e.target.value))}
              min={0}
              step="0.25"
              placeholder="hrs"
            />
            <button onClick={addStaff} className="rounded-xl bg-slate-900 text-white px-4 py-2">
              Add staff
            </button>
          </div>

          {/* Picked list */}
          {pickedOthers.length === 0 ? (
            <div className="text-sm text-slate-500">No staff selected.</div>
          ) : (
            <div className="space-y-2">
              {pickedOthers.map((p) => {
                const s = staffById.get(p.id)!
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border rounded-xl p-2"
                  >
                    <div className="text-sm">
                      <div className="font-medium">
                        {s.full_name} <span className="text-slate-500">({s.role})</span>
                      </div>
                      <div className="text-slate-500">
                        ${s.base_hourly_rate}/hr
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600">Hours</label>
                      <input
                        type="number"
                        className="border rounded-xl px-2 py-1 w-24"
                        value={p.hours}
                        min={0}
                        step="0.25"
                        onChange={(e) => updateHours('other', p.id, Number(e.target.value))}
                      />
                      <button
                        onClick={() => removePicked('other', p.id)}
                        className="rounded-lg border px-3 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN — inputs + results (unchanged shell) */}
      <div className="space-y-4">
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-3">Inputs</h2>
          <div className="grid gap-3">
            <label className="flex items-center gap-3">
              Work date
              <input
                type="date"
                className="ml-auto w-44 border rounded-xl px-3 py-2"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-3">
              Patients seen today
              <input
                type="number"
                className="ml-auto w-40 border rounded-xl px-3 py-2"
                min={0}
                value={patientsSeen}
                onChange={(e) => setPatientsSeen(Number(e.target.value))}
              />
            </label>

            <div className="flex items-center gap-3">
              <select
                className="border rounded-xl px-3 py-2"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
              >
                <option value="margin">Desired profit margin %</option>
                <option value="amount">Desired profit amount $</option>
              </select>
              {targetType === 'margin' ? (
                <input
                  type="number"
                  className="w-36 border rounded-xl px-3 py-2"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(Number(e.target.value))}
                />
              ) : (
                <input
                  type="number"
                  className="w-36 border rounded-xl px-3 py-2"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(Number(e.target.value))}
                />
              )}
            </div>

            <div className="text-sm text-slate-600">
              Daily fixed cost (auto): <span className="font-semibold">${dailyFixedCost.toFixed(2)}</span>
            </div>
            <div className="text-sm text-slate-600">
              Org avg reimbursement (auto): <span className="font-semibold">${avgReimb.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-2">Results</h2>
          <div className="grid gap-2 text-sm">
            <div>Labor cost today: <span className="font-semibold">${laborCost.toFixed(2)}</span></div>
            <div>Daily fixed cost: <span className="font-semibold">${dailyFixedCost.toFixed(2)}</span></div>
            <div>Revenue so far: <span className="font-semibold">${revenueSoFar.toFixed(2)}</span></div>
            <div>
              Current profit:{' '}
              <span className={`font-semibold ${profitNow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ${profitNow.toFixed(2)}
              </span>
            </div>
            <div className="pt-2">
              Patients needed to hit desired{' '}
              {targetType === 'margin' ? `margin (${targetMargin}%)` : `amount ($${targetAmount})`}:{' '}
              <span className="font-semibold">{patientsForTarget ? patientsForTarget.toFixed(1) : '—'}</span>
            </div>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button onClick={saveDay} disabled={saving} className="rounded-xl bg-slate-900 text-white px-4 py-2">
              {saving ? 'Saving…' : 'Save today'}
            </button>
            {saveMsg && <div className="text-sm">{saveMsg}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
