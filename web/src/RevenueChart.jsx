import { useId } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Empty } from './components'
import { day, money } from './utils'

export default function RevenueChart({ history = [], forecast = [], evaluation = false, height = 290 }) {
  const id = useId().replace(/:/g, '')
  const points = new Map()
  history.forEach(item => points.set(item.date, { date: item.date, actual: Number(item.revenue ?? item.actual) }))
  forecast.forEach(item => points.set(item.date, { ...points.get(item.date), date: item.date, predicted: Number(item.revenue ?? item.predicted) }))
  const data = [...points.values()].sort((a, b) => a.date.localeCompare(b.date))
  if (!data.length) return <Empty title="A clearer picture starts with your sales" description="Add sales records or load the sample dataset to see your daily revenue." />
  return <div className="revenue-chart" style={{ height }} role="img" aria-label={evaluation ? 'Actual versus predicted revenue on unseen test dates' : 'Daily shop revenue and forecast in US dollars'}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#346d53" stopOpacity={0.15} /><stop offset="100%" stopColor="#346d53" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eceee8" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={value => day(value)} axisLine={false} tickLine={false} minTickGap={42} tick={{ fill: '#7d857a', fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tickFormatter={value => `$${value}`} tick={{ fill: '#7d857a', fontSize: 11 }} width={54} /><Tooltip formatter={(value, name) => [money(value), name]} labelFormatter={value => day(value, { year: 'numeric' })} contentStyle={{ borderRadius: 10, border: '1px solid #e4e8de', fontSize: 12 }} /><Area type="monotone" dataKey="actual" name="Actual revenue" stroke="#346d53" strokeWidth={2.3} fill={`url(#${id})`} isAnimationActive={false} /><Line type="monotone" dataKey="predicted" name="Predicted revenue" stroke="#c48c3c" strokeDasharray="5 5" strokeWidth={2.5} dot={data.length <= 14 ? { r: 3, fill: '#c48c3c' } : false} connectNulls={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div>
}
