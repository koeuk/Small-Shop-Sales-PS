import { useEffect, useId, useRef } from 'react'
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, LoaderCircle, Sprout, X } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { day, money } from './utils'

export function Button({ children, variant = 'primary', busy = false, className = '', ...props }) {
  return <button {...props} className={`button ${variant} ${className}`} disabled={props.disabled || busy}>{busy && <LoaderCircle className="spin" size={17} />}{children}</button>
}

export function PageHeading({ eyebrow = 'YOUR WORKSPACE', title, description, children }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>
}

export function Badge({ children, tone = 'green' }) { return <span className={`badge ${tone}`}>{children}</span> }
export function Notice({ children, tone = 'amber' }) { return <div className={`notice ${tone}`}><AlertCircle size={18} /><div>{children}</div></div> }
export function Loading() { return <div className="loading-state" role="status"><LoaderCircle size={24} className="spin" /><p>Gathering your shop data…</p></div> }
export function ErrorState({ message, retry }) { return <div className="error-state" role="alert"><AlertCircle size={25} /><h3>Something needs attention</h3><p>{message}</p>{retry && <Button variant="secondary" onClick={retry}>Try again</Button>}</div> }
export function Empty({ title, description, children, icon: Icon = Sprout }) { return <div className="empty-state"><div className="empty-icon"><Icon size={28} strokeWidth={1.5} /></div><h3>{title}</h3><p>{description}</p>{children}</div> }
export function CardLink({ to, children }) { return <Link className="text-link" to={to}>{children}<ArrowRight size={16} /></Link> }

export function Modal({ title, description, onClose, children }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === ref.current) onClose() }}><div className="modal-head"><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}</dialog>
}

export function Pagination({ page, pageSize, total, onChange }) {
  if (!total) return null
  const pages = Math.ceil(total / pageSize)
  return <div className="pagination"><span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span><div><button className="icon-button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button><span>{page} / {pages}</span><button className="icon-button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={18} /></button></div></div>
}

export function RevenueChart({ history = [], forecast = [], evaluation = false, height = 290 }) {
  const id = useId().replace(/:/g, '')
  const points = new Map()
  history.forEach(item => points.set(item.date, { date: item.date, actual: Number(item.revenue ?? item.actual) }))
  forecast.forEach(item => points.set(item.date, { ...points.get(item.date), date: item.date, predicted: Number(item.revenue ?? item.predicted) }))
  const data = [...points.values()].sort((a, b) => a.date.localeCompare(b.date))
  if (!data.length) return <Empty title="A clearer picture starts with your sales" description="Add sales records or load the sample dataset to see your daily revenue." />
  return <div className="revenue-chart" style={{ height }} role="img" aria-label={evaluation ? 'Actual versus predicted revenue on unseen test dates' : 'Daily shop revenue and forecast in US dollars'}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#346d53" stopOpacity={0.15} /><stop offset="100%" stopColor="#346d53" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eceee8" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={value => day(value)} axisLine={false} tickLine={false} minTickGap={42} tick={{ fill: '#7d857a', fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tickFormatter={value => `$${value}`} tick={{ fill: '#7d857a', fontSize: 11 }} width={54} /><Tooltip formatter={(value, name) => [money(value), name]} labelFormatter={value => day(value, { year: 'numeric' })} contentStyle={{ borderRadius: 10, border: '1px solid #e4e8de', fontSize: 12 }} /><Area type="monotone" dataKey="actual" name="Actual revenue" stroke="#346d53" strokeWidth={2.3} fill={`url(#${id})`} isAnimationActive={false} /><Line type="monotone" dataKey="predicted" name="Predicted revenue" stroke="#c48c3c" strokeDasharray="5 5" strokeWidth={2.5} dot={data.length <= 14 ? { r: 3, fill: '#c48c3c' } : false} connectNulls={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div>
}
