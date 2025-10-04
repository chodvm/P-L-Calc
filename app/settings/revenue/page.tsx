'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function RevenueSettingsPage() {
  const [value, setValue] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string>('')

  const s = supabaseBrowser()

  const load = async () => {
    setLoading(true); setMsg('')
    const { data, error } = await s.from('orgs').select('id, default_avg_reimb').limit(1)
    if (!error && data && data[0]) setValue(Number(data[0].default_avg_reimb || 0))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setMsg('')
    const { data } = await s.from('orgs').select('id').limit(1)
    const orgId = data?.[0]?.id
    if (!orgId) { setMsg('No org found'); return }
    const { error } = await s.from('orgs').update({ default_avg_reimb: value }).eq('id', orgId)
    if (error) setMsg(error.message); else setMsg('Saved ✔')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Revenue Defaults</h1>
        <Link href="/settings" className="text-sm underline">← Back to Settings</Link>
      </div>

      <div className="rounded-2xl border p-4">
        <div className="grid gap-3">
          <label className="flex items-center gap-3">
            Average reimbursement per visit (clinic-wide)
            <input
              type="number"
              min={0}
              className="ml-auto w-48 border rounded-xl px-3 py-2"
              value={value}
              onChange={e=>setValue(Number(e.target.value))}
              disabled={loading}
            />
          </label>
          <div className="text-xs text-slate-500">
            Used by the calculator and daily P&amp;L unless a per-day override is set.
          </div>
          <div>
            <button onClick={save} disabled={loading} className="rounded-xl bg-slate-900 text-white px-4 py-2">
              Save
            </button>
            {msg && <span className="ml-3 text-sm">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
