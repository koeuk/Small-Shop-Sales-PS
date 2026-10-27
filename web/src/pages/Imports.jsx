import { useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, downloadBlob } from '../api'
import { Badge, Button, Empty, ErrorState, Loading, Notice, PageHeading } from '../components'
import { useToast } from '../context'
import { useResource } from '../hooks'
import { number, timestamp, today } from '../utils'

export default function Imports() {
  const history = useResource('/imports')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [synthetic, setSynthetic] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)
  const notify = useToast()
  const choose = selected => {
    setPreview(null); setError('')
    if (!selected) return
    if (!/\.(csv|xlsx)$/i.test(selected.name)) { setError('Choose a CSV or XLSX file.'); return }
    if (selected.size > 5 * 1024 * 1024) { setError('Choose a file smaller than 5 MB.'); return }
    setFile(selected)
  }
  const upload = async dryRun => {
    setBusy(dryRun ? 'preview' : 'import'); setError('')
    const form = new FormData()
    form.append('file', file); form.append('dry_run', String(dryRun)); form.append('synthetic', String(synthetic))
    try {
      const result = await api('/imports', { method: 'POST', body: form })
      if (dryRun) setPreview(result)
      else { notify(`Imported ${number(result.valid_rows)} sales rows. ${result.invalid_rows ? `${result.invalid_rows} invalid rows were skipped.` : 'Your history is up to date.'}`); setFile(null); setPreview(null); history.reload() }
    } catch (error) { setError(error.message); if (!dryRun) history.reload() } finally { setBusy('') }
  }
  const template = () => downloadBlob(new Blob([`sale_date,product_name,quantity,unit_price\n${today()},Coffee,12,2.00\n${today()},Tea,8,1.50\n`], { type: 'text/csv' }), 'sales-template.csv')
  return <><PageHeading title="A little history goes a long way." description="Bring your sales spreadsheet. We’ll help you make sense of it."><Button variant="secondary" onClick={template}><Download size={16} />CSV template</Button></PageHeading><div className="import-grid"><section className="card upload-card"><div className="card-header"><div><span className="step-label">01 · BRING YOUR DATA</span><h2>Your sales, all together.</h2></div><FileSpreadsheet size={23} className="muted" /></div><input ref={input} className="visually-hidden" type="file" id="sales-file" accept=".csv,.xlsx" aria-label="Choose sales file" onChange={event => { choose(event.target.files[0]); event.target.value = '' }} /><button type="button" className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => input.current.click()} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]) }}><span className="upload-icon"><UploadCloud size={29} strokeWidth={1.5} /></span><strong>{file ? file.name : 'Drop a little history here'}</strong><span>{file ? `${(file.size / 1024).toFixed(1)} KB · Click to choose another file` : 'or click to choose your sales file'}</span><small>CSV or XLSX · up to 5 MB · 10,000 rows</small></button><label className="checkbox-label"><input type="checkbox" checked={synthetic} onChange={event => setSynthetic(event.target.checked)} />This file contains synthetic / sample data</label>{error && <div className="form-error" role="alert">{error}</div>}<Button onClick={() => upload(true)} busy={busy === 'preview'} disabled={!file || !!busy}>Preview & validate<ArrowRight size={17} /></Button></section><aside className="card import-guide"><span className="step-label">A SMALL CHECK BEFORE YOU START</span><h2>Keep it simple.</h2><p>One row per product sold, with these four columns:</p><dl><div><dt>sale_date</dt><dd>YYYY-MM-DD</dd></div><div><dt>product_name or product_id</dt><dd>An existing, active product</dd></div><div><dt>quantity</dt><dd>A positive whole number</dd></div><div><dt>unit_price</dt><dd>Historical price in USD</dd></div></dl><p>New product names need to be added to your catalog first.</p><Link className="text-link" to="/products">Manage products<ArrowRight size={15} /></Link><div className="guide-note"><CheckCircle2 size={17} /><span>Previewing makes no changes. Identical files can only be imported once.</span></div></aside></div>
    {preview && <section className="card preview-card"><div className="card-header"><div><span className="step-label">02 · A QUICK LOOK</span><h2>Your import preview</h2><p>{number(preview.total_rows)} rows · <span className="green-text">{number(preview.valid_rows)} valid</span> · {number(preview.invalid_rows)} invalid</p></div><Button busy={busy === 'import'} disabled={!preview.valid_rows || !!busy} onClick={() => upload(false)}>Import {number(preview.valid_rows)} valid rows<ArrowRight size={16} /></Button></div>{preview.invalid_rows > 0 && <Notice>Invalid rows will be skipped. Importing saves only the valid rows, in one transaction.</Notice>}{preview.preview.length > 0 && <div className="table-scroll"><table><thead><tr><th>ROW</th><th>DATE</th><th>PRODUCT</th><th>QTY</th><th>PRICE</th><th>VALIDATION</th></tr></thead><tbody>{preview.preview.map(row => <tr key={row.row}><td className="muted">{row.row}</td><td>{row.sale_date.slice(0, 10)}</td><td>{row.product}</td><td>{row.quantity}</td><td>{row.unit_price}</td><td>{row.error ? <span className="danger-text">{row.error}</span> : <Badge>Ready</Badge>}</td></tr>)}</tbody></table></div>}{preview.total_rows > 15 && <p className="table-caption">Showing the first 15 rows. All {number(preview.total_rows)} rows were validated.</p>}{preview.errors.length > 0 && <details className="import-errors" open={preview.fatal}><summary>{preview.fatal ? 'File needs attention' : `Review validation errors (${preview.invalid_rows}; up to 100 shown)`}</summary><ul>{preview.errors.map((item, index) => <li key={index}>{item.row > 0 ? `Row ${item.row}: ` : ''}{item.message}</li>)}</ul></details>}</section>}
    <section className="card table-card"><div className="card-header"><div><h2>How your history arrived</h2><p>Your latest 100 imports and their results.</p></div><Badge tone="neutral">IMPORT HISTORY</Badge></div>{history.error ? <ErrorState message={history.error} retry={history.reload} /> : history.loading && !history.data ? <Loading /> : history.data?.length ? <div className="table-scroll"><table><thead><tr><th>FILE</th><th>IMPORTED</th><th>ROWS SAVED</th><th>INVALID</th><th>STATUS</th></tr></thead><tbody>{history.data.map(item => <tr key={item.id}><td><div className="file-cell"><FileSpreadsheet size={20} /><div><strong>{item.file_name}</strong>{item.synthetic && <small>Synthetic demonstration data</small>}{item.error_summary && <details><summary>View errors</summary><pre>{item.error_summary}</pre></details>}</div></div></td><td className="muted">{timestamp(item.created_at)}</td><td>{number(item.row_count)} / {number(item.total_rows)}</td><td>{number(item.invalid_rows)}</td><td><Badge tone={item.status === 'completed' ? 'green' : 'red'}>{item.status}</Badge></td></tr>)}</tbody></table></div> : <Empty title="No imports just yet" description="Your uploaded files and validation results will appear here." icon={FileSpreadsheet} />}</section>
  </>
}
