'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'
import type { Staff } from '@/lib/types'

export default function CalculatorCards() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedPhysicians, setSelectedPhysicians] = useState<string[]>([])
  const [selectedOthers, setSelectedOthers] = useState<string[]>([])
  const [patientsSeen, setPatientsSeen] = useState<number>(0)
  const [targetType, setTargetType] = useState<'margin'|'amount'>('margin')
  const [targetMargin, setTargetMargin] = useState<number>(20)
  const [targetAmount, setTargetAmount] = useState<number>(0)
  const [orgAvgReimb, setOrgAvgReimb] = useState<number | null>(null)
  const [dailyFixedCost, setDailyFixedCost] = useState<number>(0)
  const [saving, setSaving] = useState<boolean>(false)
  const [saveMsg, setSaveMsg] = useState<string>('')

  useEffect(() => {
    const run = async () => {
      const s = supabaseBrowser()
      const staffRes = await s.from('staff').select('id, full_name, role, base_hourly_rate, default_daily_hours').eq('active', true)
      setStaff(staffRes.data ?? [])

      const reimbRes = await s.from('v_org_avg_reimbursement').select('org_avg_reimb').limit(1)
      setOrgAvgReimb(reimbRes.data?.[0]?.org_avg_reimb ?? null)

      const fixed = await s.from('v_fixed_costs_daily').select('daily_amount')
      const totalFixed = (fixed.data ?? []).reduce((acc, r: any) => acc + Number(r.daily_amount || 0), 0)
      setDailyFixedCost(totalFixed)
    }
    run()
  }, [])

  const physicians = useMemo(() => staff.filter(s=>s.role==='Physician'), [staff])
  const others = useMemo(() => staff.filter(s=>s.role!=='Physician'), [staff])

  const selectedStaff = useMemo(() => {
    const map = new Map(staff.map(s=>[s.id, s]))
    return [...selectedPhysicians, ...selectedOthers].map(id => map.get(id)!).filter(Boolean)
  }, [selectedPhysicians, selectedOthers, staff])

  const laborCost = useMemo(() => selectedStaff.reduce((sum, s) => sum + (Number(s.base_hourly_rate) * Number(s.default_daily_hours ?? 8)), 0), [selectedStaff])

  const avgReimb = orgAvgReimb ?? 0
  const materialsCost = 0
  const totalCost = laborCost + dailyFixedCost + materialsCost
  const revenueSoFar = (patientsSeen || 0) * (avgReimb || 0)
  const profitNow = revenueSoFar - totalCost

  const patientsForTarget = useMemo(() => {
    if (!avgReimb || avgReimb <= 0) return null
    if (targetType === 'margin') {
      const denom = 1 - (targetMargin/100)
      if (denom <= 0) return null
      return totalCost / (avgReimb * denom)
    } else {
      return (totalCost + targetAmount) / avgReimb
    }
  }, [targetType, targetMargin, targetAmount, totalCost, avgReimb])

  const saveToday = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const s = supabaseBrowser()
      const { data: orgs } = await s.from('orgs').select('id').limit(1)
      const orgId = orgs?.[0]?.id
      if (!orgId) throw new Error('No org found for user')
      const staffIds = [...selectedPhysicians, ...selectedOthers]
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await s.rpc('save_daily_log_and_assignments', { p_org: orgId, p_work_date: today, p_patients_seen: patientsSeen, p_staff_ids: staffIds })
      if (error) throw error
      setSaveMsg('Saved ✔')
    } catch (e:any) {
      setSaveMsg(`Save failed: ${e.message||e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Staff selection */}
      <div className="space-y-4">
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-2">Physicians</h2>
          <select multiple className="w-full border rounded-xl p-2 h-40" value={selectedPhysicians} onChange={e=>setSelectedPhysicians(Array.from(e.target.selectedOptions).map(o=>o.value))}>
            {physicians.map(p => (<option key={p.id} value={p.id}>{p.full_name} — ${p.base_hourly_rate}/hr × {p.default_daily_hours ?? 8}h</option>))}
          </select>
        </div>
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-2">All Other Staff</h2>
          <select multiple className="w-full border rounded-xl p-2 h-56" value={selectedOthers} onChange={e=>setSelectedOthers(Array.from(e.target.selectedOptions).map(o=>o.value))}>
            {others.map(p => (<option key={p.id} value={p.id}>{p.full_name} ({p.role}) — ${p.base_hourly_rate}/hr × {p.default_daily_hours ?? 8}h</option>))}
          </select>
        </div>
      </div>

      {/* Inputs & results */}
      <div className="space-y-4">
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-2">Inputs</h2>
          <div className="grid gap-3">
            <label className="flex items-center gap-3">Patients seen today
              <input type="number" min={0} className="ml-auto w-40 border rounded-xl px-3 py-2" value={patientsSeen} onChange={e=>setPatientsSeen(Number(e.target.value))} />
            </label>
            <div className="flex items-center gap-3">
              <select className="border rounded-xl px-3 py-2" value={targetType} onChange={e=>setTargetType(e.target.value as any)}>
                <option value="margin">Desired profit margin %</option>
                <option value="amount">Desired profit amount $</option>
              </select>
              {targetType === 'margin' ? (
                <input type="number" className="w-36 border rounded-xl px-3 py-2" value={targetMargin} onChange={e=>setTargetMargin(Number(e.target.value))} />
              ) : (
                <input type="number" className="w-36 border rounded-xl px-3 py-2" value={targetAmount} onChange={e=>setTargetAmount(Number(e.target.value))} />
              )}
            </div>
            <div className="text-sm text-slate-600">Daily fixed cost (auto): <span className="font-semibold">${dailyFixedCost.toFixed(2)}</span></div>
            <div className="text-sm text-slate-600">Org avg reimbursement (auto): <span className="font-semibold">${(avgReimb||0).toFixed(2)}</span></div>
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold mb-2">Results</h2>
          <div className="grid gap-2 text-sm">
            <div>Labor cost today: <span className="font-semibold">${laborCost.toFixed(2)}</span></div>
            <div>Daily fixed cost: <span className="font-semibold">${dailyFixedCost.toFixed(2)}</span></div>
            <div>Revenue so far: <span className="font-semibold">${revenueSoFar.toFixed(2)}</span></div>
            <div>Current profit: <span className={`font-semibold ${profitNow>=0?'text-emerald-700':'text-rose-700'}`}>${profitNow.toFixed(2)}</span></div>
            <div className="pt-2">Patients needed to hit desired {targetType === 'margin' ? `margin (${targetMargin}%)` : `amount ($${targetAmount})`}: <span className="font-semibold">{patientsForTarget ? patientsForTarget.toFixed(1) : '—'}</span></div>
          </div>
          <div className="pt-4 flex items-center gap-3">
            <button onClick={saveToday} disabled={saving} className="rounded-xl bg-slate-900 text-white px-4 py-2">{saving?'Saving…':'Save today'}</button>
            {saveMsg && <div className="text-sm">{saveMsg}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
