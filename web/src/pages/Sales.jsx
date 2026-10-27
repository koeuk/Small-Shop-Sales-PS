import { useState } from "react";
import { ClipboardList, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
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
import { day, money, number, today } from "../utils";

function SaleForm({ item, products, onClose, onSaved }) {
  const [form, setForm] = useState({
    product_id: item?.product_id || "",
    sale_date: item?.sale_date || today(),
    quantity: item?.quantity ?? 1,
    unit_price: item?.unit_price ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "product_id"
        ? {
            unit_price:
              products.find((product) => product.id === value)?.price ?? "",
          }
        : {}),
    }));
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/sales${item ? `/${item.id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        body: { ...form, quantity: Number(form.quantity) },
      });
      onSaved();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const choices = products.filter(
    (product) => !product.archived || product.id === item?.product_id,
  );
  return (
    <Modal
      title={item ? "Edit a sales record" : "A little sale to record"}
      description="Record the price paid at the time of the sale."
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <label>
          Product
          <select
            autoFocus
            name="product_id"
            value={form.product_id}
            required
            onChange={change}
          >
            <option value="">Choose a product</option>
            {choices.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
                {product.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sale date
          <input
            name="sale_date"
            type="date"
            required
            max={today()}
            value={form.sale_date}
            onChange={change}
          />
        </label>
        <div className="form-grid">
          <label>
            Quantity
            <input
              name="quantity"
              type="number"
              min="1"
              max="1000000"
              step="1"
              required
              value={form.quantity}
              onChange={change}
            />
          </label>
          <label>
            Sale price (USD)
            <input
              name="unit_price"
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              required
              value={form.unit_price}
              onChange={change}
            />
          </label>
        </div>
        <div className="sale-total">
          <span>Sale total</span>
          <strong>
            {money(Number(form.quantity) * Number(form.unit_price))}
          </strong>
        </div>
        <p className="form-hint">
          The server calculates the final total from quantity × sale price.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            {item ? "Save changes" : "Record sale"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Sales() {
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    product_id: "",
  });
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page, page_size: 20 });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const { data, loading, error, reload } = useResource(`/sales?${params}`);
  const catalog = useResource("/products?include_archived=true&page_size=1000");
  const [editing, setEditing] = useState(() =>
    new URLSearchParams(window.location.search).has("new") ? {} : null,
  );
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, setSearchParams] = useSearchParams();
  const notify = useToast();
  const filter = (event) => {
    setFilters({ ...filters, [event.target.name]: event.target.value });
    setPage(1);
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api(`/sales/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setPage(1);
      reload();
      notify("Sale deleted. Retrain models to reflect the updated history.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Every sale, a small story."
        description="Your sales history is the foundation of your forecast."
      >
        <Link className="button secondary" to="/imports">
          <Upload size={16} />
          Import sales
        </Link>
        <Button onClick={() => setEditing({})}>
          <Plus size={17} />
          Add a sale
        </Button>
      </PageHeading>
      <section className="card table-card">
        <div className="sales-summary">
          <span>
            <strong>{number(data?.total)}</strong> sales records
          </span>
          <span>
            Filtered revenue <strong>{money(data?.revenue)}</strong>
          </span>
        </div>
        <div className="filter-bar">
          <label>
            From
            <input
              type="date"
              name="start_date"
              aria-label="Sales from date"
              value={filters.start_date}
              onChange={filter}
            />
          </label>
          <label>
            To
            <input
              type="date"
              name="end_date"
              aria-label="Sales to date"
              value={filters.end_date}
              onChange={filter}
            />
          </label>
          <label>
            Product
            <select
              name="product_id"
              aria-label="Filter by product"
              value={filters.product_id}
              onChange={filter}
            >
              <option value="">All products</option>
              {catalog.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {Object.values(filters).some(Boolean) && (
            <button
              className="inline-button"
              onClick={() => {
                setFilters({ start_date: "", end_date: "", product_id: "" });
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
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
                    <th>SALE DATE</th>
                    <th>PRODUCT</th>
                    <th>QUANTITY</th>
                    <th>UNIT PRICE</th>
                    <th>TOTAL</th>
                    <th>SOURCE</th>
                    <th className="align-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>{day(item.sale_date, { year: "numeric" })}</td>
                      <td>
                        <strong>{item.product_name}</strong>
                      </td>
                      <td className="tabular">{number(item.quantity)}</td>
                      <td className="muted tabular">
                        {money(item.unit_price)}
                      </td>
                      <td className="tabular">
                        <strong>{money(item.total_amount)}</strong>
                      </td>
                      <td>
                        <Badge tone={item.import_id ? "neutral" : "green"}>
                          {item.import_id ? "Imported" : "Manual"}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            onClick={() => setEditing(item)}
                            aria-label={`Edit sale ${item.product_name} on ${item.sale_date}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger-text"
                            onClick={() => setDeleting(item)}
                            aria-label={`Delete sale ${item.product_name} on ${item.sale_date}`}
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
              pageSize={20}
              total={data.total}
              onChange={setPage}
            />
          </>
        ) : (
          <Empty
            title="A fresh page for your sales"
            description="Add a sale or import your sales spreadsheet to get started."
            icon={ClipboardList}
          >
            <Button onClick={() => setEditing({})}>
              <Plus size={16} />
              Record a sale
            </Button>
          </Empty>
        )}
      </section>
      {editing &&
        (catalog.loading ? (
          <Modal
            title="Loading products"
            onClose={() => {
              setEditing(null);
              setSearchParams({}, { replace: true });
            }}
          >
            <Loading />
          </Modal>
        ) : catalog.error ? (
          <Modal
            title="Products unavailable"
            onClose={() => {
              setEditing(null);
              setSearchParams({}, { replace: true });
            }}
          >
            <ErrorState message={catalog.error} retry={catalog.reload} />
          </Modal>
        ) : !catalog.data?.items.some(
            (item) => !item.archived || item.id === editing.product_id,
          ) ? (
          <Modal
            title="Add a product first"
            onClose={() => {
              setEditing(null);
              setSearchParams({}, { replace: true });
            }}
          >
            <Empty
              title="Your sale needs a product"
              description="Create a product before recording its sales."
            >
              <Link className="button primary" to="/products">
                Go to products
              </Link>
            </Empty>
          </Modal>
        ) : (
          <SaleForm
            item={editing.id ? editing : null}
            products={catalog.data.items}
            onClose={() => {
              setEditing(null);
              setSearchParams({}, { replace: true });
            }}
            onSaved={() => {
              setEditing(null);
              setSearchParams({}, { replace: true });
              reload();
              notify(
                editing.id
                  ? "Sale updated. Retrain to include your changes."
                  : "Sale recorded.",
              );
            }}
          />
        ))}
      {deleting && (
        <Modal
          title="Delete this sale?"
          description={`${deleting.product_name} · ${day(deleting.sale_date)} · ${money(deleting.total_amount)}. This changes your historical revenue. Previous forecasts will be preserved.`}
          onClose={() => setDeleting(null)}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" busy={busy} onClick={remove}>
              Delete sale
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
