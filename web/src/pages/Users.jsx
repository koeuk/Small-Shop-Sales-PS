import { useDeferredValue, useState } from "react";
import { Eye, EyeOff, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, UserRoundX, UsersRound } from "lucide-react";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import { Badge, Button, Empty, ErrorState, Loading, Modal, Notice, PageHeading, Pagination } from "../components";
import { useAuth, useResource, useToast } from "../hooks";
import { timestamp } from "../utils";

function PasswordInput({ label, value, onChange, autoComplete = "new-password" }) {
  const [visible, setVisible] = useState(false);
  return <div className="password-field"><label>{label}<div className="password-input"><input type={visible ? "text" : "password"} required minLength={12} maxLength={256} autoComplete={autoComplete} value={value} onChange={onChange} /></div></label><button type="button" className="icon-button user-password-toggle" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(current => !current)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>;
}

function UserForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ name: item?.name || "", email: item?.email || "", role: item?.role || "operator", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const body = item ? { name: form.name, email: form.email, role: form.role } : form;
      const result = await api(`/users${item ? `/${item.id}` : ""}`, { method: item ? "PATCH" : "POST", body });
      onSaved(result.reauthenticate);
    } catch (error) { setError(error.message) } finally { setBusy(false) }
  };
  return <Modal title={item ? "Edit account" : "Add a shop user"} description="Accounts share this shop's products, sales, and forecasts." onClose={onClose}><form className="form-stack" onSubmit={submit}>{error && <div className="form-error" role="alert">{error}</div>}<label>Full name<input autoFocus name="name" required maxLength={100} value={form.name} onChange={change} /></label><label>Email address<input name="email" type="email" required maxLength={255} autoComplete="off" value={form.email} onChange={change} /></label><label>Role<select name="role" value={form.role} onChange={change}><option value="operator">Operator</option><option value="administrator">Administrator</option></select></label>{!item && <PasswordInput label="Temporary password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />}<p className="form-hint">Operators manage products, sales and imports. Administrators also manage users, train models and generate forecasts. New passwords require at least 12 characters.</p>{item && <p className="form-hint">Changing email or role revokes this user's existing sessions.</p>}<div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy}>{item ? "Save account" : "Create user"}</Button></div></form></Modal>;
}

function ResetPassword({ item, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("The passwords do not match."); return }
    setBusy(true);
    try { const result = await api(`/users/${item.id}/password`, { method: "POST", body: { password } }); onSaved(result.reauthenticate) } catch (error) { setError(error.message) } finally { setBusy(false) }
  };
  return <Modal title="Reset password" description={`Set a new password for ${item.email}. Their existing sessions will be revoked.`} onClose={onClose}><form className="form-stack" onSubmit={submit}>{error && <div className="form-error" role="alert">{error}</div>}<PasswordInput label="New password" value={password} onChange={event => setPassword(event.target.value)} /><PasswordInput label="Confirm password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /><p className="form-hint">Use at least 12 characters. Resetting your own password signs you out.</p><div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy}>Update password</Button></div></form></Modal>;
}

export default function Users() {
  const { user, logout, refreshUser } = useAuth();
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const resource = useResource(`/users?search=${encodeURIComponent(deferred)}&page=${page}&page_size=15`);
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notify = useToast();
  if (user.role !== "administrator") return <Navigate to="/" replace />;
  const saved = async (reauthenticate, message) => {
    setEditing(null); setResetting(null); notify(message);
    if (reauthenticate) { logout(); return }
    resource.reload(); await refreshUser();
  };
  const confirmAction = async () => {
    setBusy(true); setError("");
    try {
      const result = await api(`/users/${confirm.item.id}`, { method: confirm.remove ? "DELETE" : "PATCH", body: confirm.remove ? undefined : { is_active: !confirm.item.is_active } });
      const message = confirm.remove ? "User removed." : confirm.item.is_active ? "Account deactivated and sessions revoked." : "Account activated.";
      setConfirm(null); setPage(1); notify(message);
      if (result?.reauthenticate) logout(); else resource.reload();
    } catch (error) { setError(error.message) } finally { setBusy(false) }
  };
  return <><PageHeading title="The people behind your shop." description="Manage sign-in accounts, roles, and access to this workspace."><Button onClick={() => setEditing({})}><Plus size={17} />Add user</Button></PageHeading><Notice tone="green"><strong>One shared shop.</strong> Passwords are stored as Argon2 hashes. Deactivating an account or resetting its password immediately revokes its sessions.</Notice><section className="card table-card"><div className="table-toolbar"><div className="search-field"><Search size={18} /><input aria-label="Search users" placeholder="Find by name or email…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></div><Badge tone="neutral">{resource.data?.total || 0} USERS</Badge></div>{resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : resource.loading && !resource.data ? <Loading /> : resource.data?.items.length ? <><div className="table-scroll"><table><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>CREATED</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{resource.data.items.map(item => <tr key={item.id}><td><div className="file-cell"><UsersRound size={19} /><div><strong>{item.name} {item.id === user.id && <Badge tone="neutral">You</Badge>}</strong><small className="user-email">{item.email}</small></div></div></td><td><Badge tone={item.role === "administrator" ? "green" : "neutral"}>{item.role === "administrator" && <ShieldCheck size={12} />}{item.role}</Badge></td><td><Badge tone={item.is_active ? "green" : "red"}>{item.is_active ? "Active" : "Inactive"}</Badge></td><td className="muted">{timestamp(item.created_at)}</td><td><div className="row-actions"><button className="icon-button" onClick={() => setEditing(item)} aria-label={`Edit ${item.email}`}><Pencil size={16} /></button><button className="icon-button" onClick={() => setResetting(item)} aria-label={`Reset password for ${item.email}`}><KeyRound size={16} /></button><button className="icon-button" onClick={() => { setError(""); setConfirm({ item, remove: false }) }} aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.email}`}>{item.is_active ? <UserRoundX size={16} /> : <UserCheck size={16} />}</button><button className="icon-button danger-text" disabled={item.shop_owner || item.id === user.id} title={item.shop_owner ? "Original owner is retained for historical records" : item.id === user.id ? "Another administrator can remove your account" : "Remove account"} aria-label={`Delete ${item.email}`} onClick={() => { setError(""); setConfirm({ item, remove: true }) }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div><Pagination page={page} pageSize={15} total={resource.data.total} onChange={setPage} /></> : <Empty title="No matching accounts" description="Try another name or email address." icon={UsersRound} />}</section>{editing && <UserForm item={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={reauthenticate => saved(reauthenticate, editing.id ? "Account updated." : "User created. They can now sign in.")} />}{resetting && <ResetPassword item={resetting} onClose={() => setResetting(null)} onSaved={reauthenticate => saved(reauthenticate, "Password updated. Previous sessions were revoked.")} />}{confirm && <Modal title={`${confirm.remove ? "Remove" : confirm.item.is_active ? "Deactivate" : "Activate"} this account?`} description={`${confirm.item.name} · ${confirm.item.email}. Shop records are preserved. At least one active administrator must remain.`} onClose={() => setConfirm(null)}>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button variant={confirm.remove || confirm.item.is_active ? "danger" : "primary"} busy={busy} onClick={confirmAction}>{confirm.remove ? "Remove user" : confirm.item.is_active ? "Deactivate account" : "Activate account"}</Button></div></Modal>}</>;
}
