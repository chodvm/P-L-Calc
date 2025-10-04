'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'

type Fixed = { id: string; name: string; amount: number; frequency: 'daily'|'weekly'|'monthly'|'quarterly'|'yearly' }

export default function SettingsPage() {
  return <SettingsInner />
}

function SettingsInner() {
  const [rows, setRows] = useState<Fixed[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [frequency, setFrequency] = useState<Fixed['frequency']>('monthly')

  useEffect(()=>{ (async()=>{
    const s = supabaseBrowser()
    const { data } = await s.from('fixed_costs').select('id,name,amount,frequency').eq('active', true).order('name')
    setRows(data as Fixed[] ?? [])
  })() }, [])

  const currentOrgId = async (): Promise<string | null> => {
    const s = supabaseBrowser()
    const { data } = await s.from('orgs').select('id').limit(1)
    return data?.[0]?.id ?? null
  }

  const add = async () => {
    const s = supabaseBrowser()
    const orgId = await currentOrgId()
    await s.from('fixed_costs').insert({ name, amount, frequency, active: true, org_id: orgId })
    location.reload()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="rounded-2xl border p-4">
        <h2 className="font-semibold mb-3">Fixed Costs</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input className="border rounded-xl px-3 py-2" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
          <input className="border rounded-xl px-3 py-2 w-32" placeholder="Amount" type="number" value={amount} onChange={e=>setAmount(Number(e.target.value))} />
          <select className="border rounded-xl px-3 py-2" value={frequency} onChange={e=>setFrequency(e.target.value as any)}>
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
            <option value="yearly">yearly</option>
          </select>
          <button onClick={add} className="rounded-xl bg-slate-900 text-white px-4 py-2">Add</button>
        </div>
      </div>

      <div className="rounded-2xl border p-4">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left border-b"><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Frequency</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{r.name}</td>
                <td className="py-2 pr-4">${Number(r.amount).toFixed(2)}</td>
                <td className="py-2 pr-4">{r.frequency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
