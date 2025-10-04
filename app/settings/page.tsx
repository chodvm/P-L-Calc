import Link from 'next/link'

export default function SettingsHub() {
  const cards = [
    { href: '/settings/fixed-costs', title: 'Fixed Costs', desc: 'Rent, insurance, loan, utilities — edit amounts & frequency' },
    { href: '/settings/labor', title: 'Labor & Staff', desc: 'Physicians and staff rates, default hours, roles, active status' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-center">Settings</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border p-5 hover:shadow-md transition-shadow"
          >
            <div className="text-lg font-semibold">{c.title}</div>
            <p className="text-sm text-slate-600 mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
