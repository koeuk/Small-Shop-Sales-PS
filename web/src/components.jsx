import { lazy, Suspense, useEffect, useId, useRef } from 'react'
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, LoaderCircle, Sprout, X } from 'lucide-react'
import { Link } from 'react-router-dom'

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

const Chart = lazy(() => import('./RevenueChart'))
export function RevenueChart(props) { return <Suspense fallback={<Loading />}><Chart {...props} /></Suspense> }
