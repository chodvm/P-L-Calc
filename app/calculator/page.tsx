import dynamic from 'next/dynamic'
const CalculatorCards = dynamic(()=>import('../components/CalculatorCards'), { ssr: false })

export default function CalculatorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <CalculatorCards />
    </div>
  )
}
