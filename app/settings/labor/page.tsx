'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'
import Link from 'next/link'

type StaffRole = 'Physician'|'PA'|'RN'|'LVN'|'MA'|'Xray Tech'|'Front Desk'|'Admin'
type Staff = {
  id: string
  full_name: string
  role: StaffRole
  base_hourly_rate: number
  default_daily_hours: number | null
  active: boolean
}

const roles: StaffRole[] = ['Physician','PA','RN','LVN','MA','Xray Tech','Front Desk','Admin']

export default function LaborSettingsPage() {
  const [rows, setRows] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<StaffRole>('Physician')
  const [newRate, setNewRate] = useState<number>(0)
  const [newHours, setNewHours] = useState<number>(8)

  const s = supabaseBrowser()

  const load = async () => {
    setLoading(true); setError(null)
    const { data, error } = await s
      .from('staff')
      .select('id,full_name,role,base_hourly_rate,default_daily_hours,active')
      .order('role')
      .order('full_name')
    if (error) setError(error.message)
    setRows((data as Staff[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const getOrgId = async (): Promise<string|null> => {
    const { data } = await s.from('orgs').select('id').limit(1)
    return data?.[0]?.id ?? null
  }

  const add = async () => {
    const orgId = await getOrgId()
    const { error } = await s.from('staff').insert({
      org_id: orgId,
      full_name: newName,
      role: newRole,
      base_hourly_rate: newRate,
      default_daily_hours: newHours,
      active: true
    })
    if (error) setError(error.message)
    setNewName(''); setNewRole('Physician'); setNewRate(0); setNewHours(8)
    await load()
  }

  const saveRow = async (row: Staff) => {
    const { error } = await s.from('staff').update({
      full_name: row.full_name,
      role: row.role,
      base_hourly_rate: row.base_hourly_rate,
      default_daily_hours: row.default_daily_hours,
      active: row.active
    }).eq('id', row.id)
    if (error) setError(error.message)
    await load()
  }

  const updateLocal = (id: string, patch: Partial<Staff>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const physicians = useMemo(()=> rows.filter(r=>r.role==='Physician'), [rows])
  const others = useMemo(()=> rows.filter(r=>r.role!=='Physician'), [rows])

  const Section = ({title, data}:{title:string, data: Staff[]}) => (
    <div className="rounded-2xl border p-4 overflow-x-auto">
      <h2 className="font-semibold mb-3">{title}</h2>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Active</th>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Role</th>
            <th className="py-2 pr-4">Rate ($/hr)</th>
            <th className="py-2 pr-4">Default hours</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-2 pr-4">
                <input type="checkbox" checked={r.active} onChange={e=>updateLocal(r.id, { active: e.target.checked })} />
              </td>
              <td className="py-2 pr-4">
                <input className="border rounded px-2 py-1" value={r.full_name} onChange={e=>updateLocal(r.id, { full_name: e.target.value })} />
              </td>
              <td className="py-2 pr-4">
                <select className="border rounded px-2 py-1" value={r.role} onChange={e=>updateLocal(r.id, { role: e.target.value as StaffRole })}>
                  {roles.map(ro=> <option key={ro} value={ro}>{ro}</option>)}
                </select>
              </td>
              <td className="py-2 pr-4">
                <input className="border rounded px-2 py-1 w-24" type="number" value={Number(r.base_hourly_rate)} onChange={e=>updateLocal(r.id, { base_hourly_rate: Number(e.target.value) })} />
              </td>
              <td className="py-2 pr-4">
                <input className="border rounded px-2 py-1 w-20" type="number" value={Number(r.default_daily_hours ?? 0)} onChange={e=>updateLocal(r.id, { default_daily_hours: Number(e.target.value) })} />
              </td>
              <td className="py-2 pr-4">
                <button onClick={()=>saveRow(r)} className="rounded-lg bg-slate-900 text-white px-3 py-1">Save</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Labor & Staff</h1>
        <Link href="/settings" className="text-sm underline">← Back to Settings</Link>
      </div>

      <div className="rounded-2xl border p-4 mb-2">
        <div className="font-semibold mb-3">Add Staff</div>
        <div className="flex flex-wrap gap-2 items-center">
          <input className="border rounded-xl px-3 py-2" placeholder="Full name" value={newName} onChange={e=>setNewName(e.target.value)} />
          <select className="border rounded-xl px-3 py-2" value={newRole} onChange={e=>setNewRole(e.target.value as StaffRole)}>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="border rounded-xl px-3 py-2 w-32" placeholder="Rate ($/hr)" type="number" value={newRate} onChange={e=>setNewRate(Number(e.target.value))} />
          <input className="border rounded-xl px-3 py-2 w-28" placeholder="Default hours" type="number" value={newHours} onChange={e=>setNewHours(Number(e.target.value))} />
          <button onClick={add} className="rounded-xl bg-slate-900 text-white px-4 py-2">Add</button>
        </div>
      </div>

      {loading ? <div className="text-sm text-slate-600">Loading…</div> : (
        <>
          <Section title="Physicians" data={physicians} />
          <Section title="All Other Staff" data={others} />
        </>
      )}

      {error && <div className="text-sm text-rose-700 mt-2">{error}</div>}
    </div>
  )
}
