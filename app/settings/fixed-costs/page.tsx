'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'
import Link from 'next/link'

type Fixed = {
  id: string
  name: string
  amount: number
  frequency: 'daily'|'weekly'|'monthly'|'quarterly'|'yearly'
  active: boolean
}

export default function FixedCostsPage() {
  const [rows, setRows] = useState<Fixed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState<number>(0)
  const [newFrequency, setNewFrequency] = useState<Fixed['frequency']>('monthly')

  const s = supabaseBrowser()

  const load = async () => {
    setLoading(true); setError(null)
    const { data, error } = await s
      .from('fixed_costs')
      .select('id,name,amount,frequency,active')
      .order('name')
    if (error) setError(error.message)
    setRows((data as Fixed[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const getOrgId = async (): Promise<string|null> => {
    const { data } = await s.from('orgs').select('id').limit(1)
    return data?.[0]?.id ?? null
  }

  const add = async () => {
    const orgId = await getOrgId()
    const { error } = await s.from('fixed_costs').insert({
      org_id: orgId, name: newName, amount: newAmount, frequency: newFrequency, active: true
    })
    if (error) setError(error.message)
    setNewName(''); setNewAmount(0); setNewFrequency('monthly')
    await load()
  }

  const saveRow = async (row: Fixed) => {
    const { error } = await s.from('fixed_costs').update({
      name: row.name, amount: row.amount, frequency: row.frequency, active: row.active
    }).eq('id', row.id)
    if (error) setError(error.message)
    await load()
  }

  const softDelete = async (id: string) => {
    const { error } = await s.from('fixed_costs').update({ active: false }).eq('id', id)
    if (error) setError(error.message)
    await load()
  }

  const updateLocal = (id: string, patch: Partial<Fixed>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fixed Costs</h1>
        <Link href="/settings" className="text-sm underline">← Back to Settings</Link>
      </div>

      <div className="rounded-2xl border p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <input className="border rounded-xl px-3 py-2" placeholder="Name" value={newName} onChange={e=>setNewName(e.target.value)} />
          <input className="border rounded-xl px-3 py-2 w-32" placeholder="Amount" type="number" value={newAmount} onChange={e=>setNewAmount(Number(e.target.value))} />
          <select className="border rounded-xl px-3 py-2" value={newFrequency} onChange={e=>setNewFrequency(e.target.value as any)}>
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
            <option value="yearly">yearly</option>
          </select>
          <button onClick={add} className="rounded-xl bg-slate-900 text-white px-4 py-2">Add</button>
        </div>
      </div>

      <div className="rounded-2xl border p-4 overflow-x-auto">
        {loading ? <div className="text-sm text-slate-600">Loading…</div> : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Active</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Frequency</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <input type="checkbox" checked={r.active} onChange={e=>updateLocal(r.id, { active: e.target.checked })} />
                  </td>
                  <td className="py-2 pr-4">
                    <input className="border rounded px-2 py-1" value={r.name} onChange={e=>updateLocal(r.id, { name: e.target.value })} />
                  </td>
                  <td className="py-2 pr-4">
                    <input className="border rounded px-2 py-1 w-28" type="number" value={Number(r.amount)} onChange={e=>updateLocal(r.id, { amount: Number(e.target.value) })} />
                  </td>
                  <td className="py-2 pr-4">
                    <select className="border rounded px-2 py-1" value={r.frequency} onChange={e=>updateLocal(r.id, { frequency: e.target.value as Fixed['frequency'] })}>
                      <option value="daily">daily</option>
                      <option value="weekly">weekly</option>
                      <option value="monthly">monthly</option>
                      <option value="quarterly">quarterly</option>
                      <option value="yearly">yearly</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4 space-x-2">
                    <button onClick={()=>saveRow(r)} className="rounded-lg bg-slate-900 text-white px-3 py-1">Save</button>
                    <button onClick={()=>softDelete(r.id)} className="rounded-lg border px-3 py-1">Disable</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {error && <div className="text-sm text-rose-700 mt-2">{error}</div>}
      </div>
    </div>
  )
}
