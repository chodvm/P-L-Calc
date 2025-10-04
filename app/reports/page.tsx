'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'

type Row = { work_date: string; patients_seen: number | null; total_revenue: number | null; total_cost: number | null; profit: number | null }

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const run = async () => {
      const s = supabaseBrowser()
      const { data } = await s.from('v_daily_pnl').select('work_date, patients_seen, total_revenue, total_cost, profit').order('work_date', { ascending: false }).limit(30)
      setRows(data ?? [])
    }
    run()
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Reports</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Patients</th>
              <th className="py-2 pr-4">Revenue</th>
              <th className="py-2 pr-4">Cost</th>
              <th className="py-2 pr-4">Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=> (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2 pr-4">{new Date(r.work_date).toLocaleDateString()}</td>
                <td className="py-2 pr-4">{r.patients_seen ?? '—'}</td>
                <td className="py-2 pr-4">${Number(r.total_revenue ?? 0).toFixed(2)}</td>
                <td className="py-2 pr-4">${Number(r.total_cost ?? 0).toFixed(2)}</td>
                <td className={`py-2 pr-4 ${Number(r.profit ?? 0) >= 0 ? 'text-emerald-700':'text-rose-700'}`}>${Number(r.profit ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
