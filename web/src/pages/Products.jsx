import { useDeferredValue, useState } from "react";
import {
  Archive,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { api } from "../api";
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
  Pagination,
} from "../components";
import { useToast } from "../hooks";
import { useResource } from "../hooks";
import { day, money } from "../utils";

function ProductForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: item?.name || "",
    category: item?.category || "",
    price: item?.price ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/products${item ? `/${item.id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        body: { ...form, category: form.category || null },
      });
      onSaved();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={item ? "Edit your product" : "A new little addition"}
      description="Keep your catalog simple and up to date."
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <label>
          Product name
          <input
            autoFocus
            name="name"
            required
            maxLength={100}
            value={form.name}
            onChange={change}
            placeholder="e.g. Iced latte"
          />
        </label>
        <div className="form-grid">
          <label>
            Category <span className="optional">optional</span>
            <input
              name="category"
              maxLength={50}
              value={form.category}
              onChange={change}
              placeholder="e.g. Drinks"
            />
          </label>
          <label>
            Price (USD)
            <input
              name="price"
              type="number"
              required
              min="0"
              max="99999999.99"
              step="0.01"
              value={form.price}
              onChange={change}
              placeholder="0.00"
            />
          </label>
        </div>
        <p className="form-hint">
          Changing the catalog price preserves the prices on past sales.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            {item ? "Save changes" : "Create product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useResource(
    `/products?search=${encodeURIComponent(deferred)}&include_archived=${archived}&page=${page}&page_size=15`,
  );
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  const archive = async (item) => {
    setBusy(true);
    try {
      await api(`/products/${item.id}`, {
        method: "PATCH",
        body: { archived: !item.archived },
      });
      notify(
        item.archived
          ? "Product restored."
          : "Product archived. Its sales history is preserved.",
      );
      reload();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      const result = await api(`/products/${deleting.id}`, {
        method: "DELETE",
      });
      notify(result.message);
      setDeleting(null);
      setPage(1);
      reload();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        title="The things you sell."
        description="A tidy home for every product in your shop."
      >
        <Button onClick={() => setEditing({})}>
          <Plus size={17} />
          Add product
        </Button>
      </PageHeading>
      <section className="card table-card">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Search products"
              placeholder="Find a product…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => {
                setArchived(event.target.checked);
                setPage(1);
              }}
            />
            Include archived
          </label>
        </div>
        {error ? (
          <ErrorState message={error} retry={reload} />
        ) : loading && !data ? (
          <Loading />
        ) : data?.items.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>CATEGORY</th>
                    <th>UNIT PRICE</th>
                    <th>STATUS</th>
                    <th>UPDATED</th>
                    <th className="align-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="product-cell">
                          <span className="catalog-icon">
                            <Package size={19} strokeWidth={1.5} />
                          </span>
                          <strong>{item.name}</strong>
                        </div>
                      </td>
                      <td className="muted">
                        {item.category || "Uncategorized"}
                      </td>
                      <td className="tabular">{money(item.price)}</td>
                      <td>
                        <Badge tone={item.archived ? "neutral" : "green"}>
                          {item.archived ? "Archived" : "Active"}
                        </Badge>
                      </td>
                      <td className="muted">{day(item.updated_at)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            onClick={() => setEditing(item)}
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button"
                            disabled={busy}
                            onClick={() => archive(item)}
                            aria-label={`${item.archived ? "Restore" : "Archive"} ${item.name}`}
                          >
                            {item.archived ? (
                              <RotateCcw size={16} />
                            ) : (
                              <Archive size={16} />
                            )}
                          </button>
                          <button
                            className="icon-button danger-text"
                            onClick={() => setDeleting(item)}
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={15}
              total={data.total}
              onChange={setPage}
            />
          </>
        ) : (
          <Empty
            title={search ? "No matching products" : "Your catalog starts here"}
            description={
              search
                ? "Try a different product name or include archived products."
                : "Add your first product, then start recording sales."
            }
            icon={Package}
          >
            {!search && (
              <Button onClick={() => setEditing({})}>
                <Plus size={16} />
                Add your first product
              </Button>
            )}
          </Empty>
        )}
      </section>
      {editing && (
        <ProductForm
          item={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            notify(editing.id ? "Product updated." : "Product created.");
            setEditing(null);
            reload();
          }}
        />
      )}
      {deleting && (
        <Modal
          title={`Remove ${deleting.name}?`}
          description="Products with sales are archived instead of deleted, keeping your historical records intact."
          onClose={() => setDeleting(null)}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" busy={busy} onClick={remove}>
              Remove product
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
