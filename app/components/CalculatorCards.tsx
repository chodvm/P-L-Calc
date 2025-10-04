'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'

type StaffRole = 'Physician'|'PA'|'RN'|'LVN'|'MA'|'Xray Tech'|'Front Desk'|'Admin'
type Staff = {
  id: string
  full_name: string
  role: StaffRole
  base_hourly_rate: number
  default_daily_hours: number | null
  active?: boolean
}
type Picked = { id: string; hours: string } // hours as string so input can be blank

function isoToday() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export default function CalculatorCards() {
  // clinic config
  const [defaultAvgReimb, setDefaultAvgReimb] = useState<number>(0)

  // core data
  const [staff, setStaff] = useState<Staff[]>([])
  const [dailyFixedCost, setDailyFixedCost] = useState<number>(0)

  // date & targets
  const [workDate, setWorkDate] = useState<string>(isoToday())
  const [patientsSeenStr, setPatientsSeenStr] = useState<string>('') // blankable
  const [targetType, setTargetType] = useState<'margin'|'amount'>('margin')
  const [targetMargin, setTargetMargin] = useState<number>(20)        // can keep numeric default
  const [targetAmountStr, setTargetAmountStr] = useState<string>('')  // blankable

  // per-day reimbursement override (optional)
  const [avgOverrideStr, setAvgOverrideStr] = useState<string>('')    // blankable

  // picked staff with custom hours (strings)
  const [pickedPhysicians, setPickedPhysicians] = useState<Picked[]>([])
  const [pickedOthers, setPickedOthers] = useState<Picked[]>([])

  // add controls (default to 10 hours)
  const [physicianToAdd, setPhysicianToAdd] = useState<string>('')
  const [physicianHoursStr, setPhysicianHoursStr] = useState<string>('10')
  const [staffToAdd, setStaffToAdd] = useState<string>('')
  const [staffHoursStr, setStaffHoursStr] = useState<string>('10')

  // saving state
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string>('')

  // load data
  useEffect(() => {
    const run = async () => {
      const s = supabaseBrowser()

      const st = await s
        .from('staff')
        .select('id,full_name,role,base_hourly_rate,default_daily_hours,active')
        .order('role')
        .order('full_name')
      setStaff(st.data ?? [])

      const org = await s.from('orgs').select('default_avg_reimb').limit(1)
      setDefaultAvgReimb(Number(org.data?.[0]?.default_avg_reimb ?? 0))

      const fx = await s.from('v_fixed_costs_daily').select('daily_amount')
      const totalF = (fx.data ?? []).reduce((acc: number, r: any) => acc + Number(r.daily_amount || 0), 0)
      setDailyFixedCost(totalF)
    }
    run()
  }, [])

  const physicians = useMemo(()=> staff.filter(s => s.role === 'Physician' && s.active !== false), [staff])
  const others = useMemo(()=> staff.filter(s => s.role !== 'Physician' && s.active !== false), [staff])
  const staffById = useMemo(()=> new Map(staff.map(s=>[s.id, s])), [staff])

  const selectedIds = useMemo(()=> new Set([...pickedPhysicians, ...pickedOthers].map(p=>p.id)), [pickedPhysicians, pickedOthers])
  const availablePhysicians = useMemo(()=> physicians.filter(p=>!selectedIds.has(p.id)), [physicians, selectedIds])
  const availableOthers = useMemo(()=> others.filter(p=>!selectedIds.has(p.id)), [others, selectedIds])

  // add flows (force default 10 hours shown when selecting)
  const addPhysician = () => {
    if (!physicianToAdd) return
    const hours = physicianHoursStr === '' ? '10' : physicianHoursStr
    setPickedPhysicians(prev => prev.some(p=>p.id===physicianToAdd) ? prev : [...prev, { id: physicianToAdd, hours }])
    setPhysicianToAdd(''); setPhysicianHoursStr('10')
  }
  const addStaff = () => {
    if (!staffToAdd) return
    const hours = staffHoursStr === '' ? '10' : staffHoursStr
    setPickedOthers(prev => prev.some(p=>p.id===staffToAdd) ? prev : [...prev, { id: staffToAdd, hours }])
    setStaffToAdd(''); setStaffHoursStr('10')
  }

  const updateHours = (group:'phys'|'other', id:string, hours:string) => {
    if (group==='phys') setPickedPhysicians(prev => prev.map(p=>p.id===id?{...p, hours}:p))
    else setPickedOthers(prev => prev.map(p=>p.id===id?{...p, hours}:p))
  }
  const removePicked = (group:'phys'|'other', id:string) => {
    if (group==='phys') setPickedPhysicians(prev => prev.filter(p=>p.id!==id))
    else setPickedOthers(prev => prev.filter(p=>p.id!==id))
  }

  // numbers derived from string inputs
  const patientsSeen = Number(patientsSeenStr || 0)
  const targetAmount = Number(targetAmountStr || 0)
  const avgReimbUsed = Number((avgOverrideStr !== '' ? avgOverrideStr : String(defaultAvgReimb)) || 0)

  const laborCost = useMemo(() => {
    const calc = (list: Picked[]) => list.reduce((sum, p) => {
      const s = staffById.get(p.id); if (!s) return sum
      return sum + Number(s.base_hourly_rate) * Number(p.hours || 0)
    }, 0)
    return calc(pickedPhysicians) + calc(pickedOthers)
  }, [pickedPhysicians, pickedOthers, staffById])

  const revenueSoFar = patientsSeen * avgReimbUsed
  const totalCost = laborCost + dailyFixedCost
  const profitNow = revenueSoFar - totalCost

  const patientsForTarget = useMemo(()=> {
    if (!avgReimbUsed) return null
    if (targetType === 'margin') {
      const denom = 1 - targetMargin/100
      if (denom <= 0) return null
      return totalCost / (avgReimbUsed * denom)
    } else {
      return (totalCost + targetAmount) / avgReimbUsed
    }
  }, [avgReimbUsed, targetType, targetMargin, targetAmount, totalCost])

  // save day (RPC + override + custom hours)
  const saveDay = async () => {
    setSaving(true); setSaveMsg('')
    try {
      const s = supabaseBrowser()
      const { data: orgs } = await s.from('orgs').select('id').limit(1)
      const orgId = orgs?.[0]?.id
      if (!orgId) throw new Error('No org found')

      const allPicked = [...pickedPhysicians, ...pickedOthers]
      const staffIds = allPicked.map(p=>p.id)

      const { data: dl, error: rpcErr } = await s.rpc('save_daily_log_and_assignments', {
        p_org: orgId,
        p_work_date: workDate,
        p_patients_seen: patientsSeen,
        p_staff_ids: staffIds
      })
      if (rpcErr) throw rpcErr
      const dailyLogId: string = Array.isArray(dl) ? dl[0] : dl

      // set or clear daily override
      if (avgOverrideStr !== '') {
        const { error: ovErr } = await s
          .from('daily_log')
          .update({ avg_reimbursement_override: Number(avgOverrideStr) })
          .eq('id', dailyLogId)
          .eq('org_id', orgId)
        if (ovErr) throw ovErr
      } else {
        await s.from('daily_log').update({ avg_reimbursement_override: null }).eq('id', dailyLogId).eq('org_id', orgId)
      }

      // update custom hours
      for (const p of allPicked) {
        const { error: upErr } = await s
          .from('daily_staff_assignments')
          .update({ hours_worked: Number(p.hours || 0) })
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

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* LEFT — Physicians card + Staff card */}
      <div className="space-y-4">
        {/* Physicians */}
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-3">Physicians</h2>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              className="border rounded-xl px-3 py-2 min-w-[220px]"
              value={physicianToAdd}
              onChange={e => {
                const id = e.target.value
                setPhysicianToAdd(id)
                setPhysicianHoursStr('10') // force 10 shown on select
              }}
            >
              <option value="">Select physician…</option>
              {availablePhysicians.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — ${p.base_hourly_rate}/hr
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min={0}
              className="border rounded-xl px-3 py-2 w-24"
              value={physicianHoursStr}
              onChange={e=>setPhysicianHoursStr(e.target.value)}
              placeholder="hrs"
            />
            <button onClick={addPhysician} className="rounded-xl bg-slate-900 text-white px-4 py-2">
              Add physician
            </button>
          </div>

          {pickedPhysicians.length === 0 ? (
            <div className="text-sm text-slate-500">No physicians selected.</div>
          ) : (
            <div className="space-y-2">
              {pickedPhysicians.map(p => {
                const s = staffById.get(p.id)!
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-xl p-2">
                    <div className="text-sm">
                      <div className="font-medium">{s.full_name}</div>
                      <div className="text-slate-500">${s.base_hourly_rate}/hr</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600">Hours</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.25"
                        min={0}
                        className="border rounded-xl px-2 py-1 w-24"
                        value={p.hours}
                        onChange={e=>updateHours('phys', p.id, e.target.value)}
                        placeholder="hrs"
                      />
                      <button onClick={()=>removePicked('phys', p.id)} className="rounded-lg border px-3 py-1">Remove</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* All Other Staff */}
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-3">All Other Staff</h2>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              className="border rounded-xl px-3 py-2 min-w-[260px]"
              value={staffToAdd}
              onChange={e => {
                const id = e.target.value
                setStaffToAdd(id)
                setStaffHoursStr('10') // force 10 shown on select
              }}
            >
              <option value="">Select staff…</option>
              {availableOthers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role}) — ${p.base_hourly_rate}/hr
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min={0}
              className="border rounded-xl px-3 py-2 w-24"
              value={staffHoursStr}
              onChange={e=>setStaffHoursStr(e.target.value)}
              placeholder="hrs"
            />
            <button onClick={addStaff} className="rounded-xl bg-slate-900 text-white px-4 py-2">
              Add staff
            </button>
          </div>

          {pickedOthers.length === 0 ? (
            <div className="text-sm text-slate-500">No staff selected.</div>
          ) : (
            <div className="space-y-2">
              {pickedOthers.map(p => {
                const s = staffById.get(p.id)!
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-xl p-2">
                    <div className="text-sm">
                      <div className="font-medium">
                        {s.full_name} <span className="text-slate-500">({s.role})</span>
                      </div>
                      <div className="text-slate-500">${s.base_hourly_rate}/hr</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600">Hours</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.25"
                        min={0}
                        className="border rounded-xl px-2 py-1 w-24"
                        value={p.hours}
                        onChange={e=>updateHours('other', p.id, e.target.value)}
                        placeholder="hrs"
                      />
                      <button onClick={()=>removePicked('other', p.id)} className="rounded-lg border px-3 py-1">Remove</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Inputs + Results */}
      <div className="space-y-4">
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-3">Inputs</h2>
          <div className="grid gap-3">
            <label className="flex items-center gap-3">
              Work date
              <input type="date" className="ml-auto w-44 border rounded-xl px-3 py-2"
                value={workDate} onChange={e=>setWorkDate(e.target.value)} />
            </label>

            <label className="flex items-center gap-3">
              Patients seen today
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="ml-auto w-40 border rounded-xl px-3 py-2"
                value={patientsSeenStr}
                onChange={(e)=>setPatientsSeenStr(e.target.value)}
                placeholder=""
              />
            </label>

            <div className="flex items-center gap-3">
              <select className="border rounded-xl px-3 py-2"
                value={targetType} onChange={e=>setTargetType(e.target.value as any)}>
                <option value="margin">Desired profit margin %</option>
                <option value="amount">Desired profit amount $</option>
              </select>
              {targetType === 'margin' ? (
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-36 border rounded-xl px-3 py-2"
                  value={String(targetMargin)}
                  onChange={e=>setTargetMargin(Number(e.target.value || 0))}
                />
              ) : (
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-36 border rounded-xl px-3 py-2"
                  value={targetAmountStr}
                  onChange={e=>setTargetAmountStr(e.target.value)}
                />
              )}
            </div>

            <div className="text-sm text-slate-600">
              Default avg reimbursement (org): <span className="font-semibold">${defaultAvgReimb.toFixed(2)}</span>
            </div>

            <label className="flex items-center gap-3">
              Override for today (optional)
              <input
                type="number"
                inputMode="decimal"
                min={0}
                className="ml-auto w-40 border rounded-xl px-3 py-2"
                value={avgOverrideStr}
                onChange={e=>setAvgOverrideStr(e.target.value)}
              />
            </label>

            <div className="text-sm text-slate-600">
              Daily fixed cost (auto): <span className="font-semibold">${dailyFixedCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-2">Results</h2>
          <div className="grid gap-2 text-sm">
            <div>Labor cost today: <span className="font-semibold">${laborCost.toFixed(2)}</span></div>
            <div>Daily fixed cost: <span className="font-semibold">${dailyFixedCost.toFixed(2)}</span></div>
            <div>Revenue so far: <span className="font-semibold">${(patientsSeen * avgReimbUsed).toFixed(2)}</span></div>
            <div>Current profit: <span className={`font-semibold ${ (patientsSeen * avgReimbUsed - (laborCost + dailyFixedCost)) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              ${(patientsSeen * avgReimbUsed - (laborCost + dailyFixedCost)).toFixed(2)}
            </span></div>
            <div className="pt-2">
              Patients needed to hit desired {targetType === 'margin' ? `margin (${targetMargin}%)` : `amount ($${targetAmount})`}:
              {' '}<span className="font-semibold">{patientsForTarget ? patientsForTarget.toFixed(1) : '—'}</span>
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
