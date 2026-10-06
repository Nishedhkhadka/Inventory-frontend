import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  AlertTriangle,
  X,
  History,
  Loader2,
} from "lucide-react";
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchProductTypes,
  createProductType,
  updateProductType,
  deleteProductType,
  fetchStockLog,
} from "../api/products";
import DataTable, { Badge } from "../components/DataTable";
import { focusNextOnEnter } from "../utils/formNav";
import { formatMoney } from "../utils/currency";

const DEFAULT_TYPES = [
  "Lamp",
  "Wallet",
  "Pouch",
  "Decor",
  "Packaging",
  "Miscellaneous",
];
const ADD_TYPE_OPTION = "__add_new__";

const emptyForm = {
  name: "",
  sku: "",
  type: "Lamp",
  retailPrice: "",
  costPrice: "",
  currentStock: 0,
  lowStockAlert: 5,
  colors: [],
  stockChangeComment: "",
};

export default function Inventory({ initialSearch }) {
  const [products, setProducts] = useState([]);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [search, setSearch] = useState(initialSearch || "");
  const [type, setType] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [originalStock, setOriginalStock] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [stockError, setStockError] = useState(null);

  // Stock-change history modal
  const [historyFor, setHistoryFor] = useState(null); // product being viewed, or null
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(() => {
    fetchProducts({
      search,
      type,
      lowStockOnly: lowStockOnly || undefined,
    }).then(setProducts);
  }, [search, type, lowStockOnly]);

  const loadTypes = useCallback(async () => {
    const next = await fetchProductTypes();
    setTypes(next);
  }, []);

  useEffect(() => {
    load();
    loadTypes();
  }, [load, loadTypes]);

  const handleDelete = async (id) => {
    if (
      !confirm(
        "Delete this product? Existing sales referencing it will be orphaned.",
      )
    )
      return;
    await deleteProduct(id);
    load();
  };

  const handleTypeChange = (nextType) => {
    if (nextType === ADD_TYPE_OPTION) {
      setAddingType(true);
      setNewTypeName("");
      return;
    }
    setForm((f) => ({ ...f, type: nextType }));
  };

  const confirmNewType = async () => {
    const name = newTypeName.trim();
    if (!name) {
      setAddingType(false);
      return;
    }

    try {
      const saved = await createProductType({ name });
      const merged = [...new Set([...types, saved.name || name])].sort();
      setTypes(merged);
      setForm((f) => ({ ...f, type: saved.name || name }));
      setAddingType(false);
      setNewTypeName("");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleTypeEdit = async () => {
    const current = form.type;
    if (!current || current === "Miscellaneous") return;

    const nextName = window.prompt("Edit type name", current);
    const cleaned = nextName?.trim();
    if (!cleaned || cleaned === current) return;

    try {
      const result = await updateProductType(current, { name: cleaned });
      const merged = [
        ...new Set([
          ...types.filter((value) => value !== current),
          result.newName || cleaned,
        ]),
      ].sort();
      setTypes(merged);
      setForm((f) => ({ ...f, type: result.newName || cleaned }));
      if (type === current) setType(result.newName || cleaned);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleTypeDelete = async () => {
    const current = form.type;
    if (!current || current === "Miscellaneous") return;

    const confirmed = window.confirm(
      `Delete type "${current}"? Products using it will be moved to "Miscellaneous".`,
    );
    if (!confirmed) return;

    try {
      const result = await deleteProductType(current);
      const merged = [
        ...new Set(types.filter((value) => value !== current)),
      ].sort();
      setTypes(merged);
      setForm((f) => ({ ...f, type: "Miscellaneous" }));
      if (type === current) setType("Miscellaneous");
      if (result.message) {
        alert(result.message);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const startEdit = (p) => {
    setEditingId(p._id);
    setOriginalStock(p.currentStock);
    setForm({
      name: p.name,
      sku: p.sku || "",
      type: p.type,
      retailPrice: p.retailPrice,
      costPrice: p.costPrice || "",
      currentStock: p.currentStock,
      lowStockAlert: p.lowStockAlert,
      colors: p.colors?.length ? p.colors.map((c) => ({ ...c })) : [],
      stockChangeComment: "",
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setStockError(null);
  };

  const addColorRow = () =>
    setForm((f) => ({ ...f, colors: [...f.colors, { name: "", stock: 0 }] }));
  const updateColorRow = (i, key, value) =>
    setForm((f) => ({
      ...f,
      colors: f.colors.map((c, idx) =>
        idx === i ? { ...c, [key]: value } : c,
      ),
    }));
  const removeColorRow = (i) =>
    setForm((f) => ({ ...f, colors: f.colors.filter((_, idx) => idx !== i) }));

  const hasColors = form.colors.length > 0;
  const colorStockTotal = form.colors.reduce(
    (s, c) => s + (Number(c.stock) || 0),
    0,
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStockError(null);
    const newStock = hasColors ? colorStockTotal : Number(form.currentStock);

    if (
      editingId &&
      newStock !== originalStock &&
      !form.stockChangeComment.trim()
    ) {
      setStockError("Please explain why you're changing the stock quantity.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        sku: form.sku || undefined,
        retailPrice: Number(form.retailPrice),
        costPrice: form.costPrice === "" ? 0 : Number(form.costPrice),
        currentStock: newStock,
        lowStockAlert: Number(form.lowStockAlert),
        colors: form.colors
          .filter((c) => c.name.trim())
          .map((c) => ({ name: c.name.trim(), stock: Number(c.stock) || 0 })),
        stockChangeComment: form.stockChangeComment.trim() || undefined,
      };
      if (editingId) {
        await updateProduct(editingId, payload);
      } else {
        await createProduct(payload);
      }
      cancelForm();
      load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (product) => {
    setHistoryFor(product);
    setHistoryLoading(true);
    try {
      const logs = await fetchStockLog(product._id);
      setHistoryLogs(logs);
    } catch {
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const columns = [
    { key: "name", header: "Product" },
    { key: "sku", header: "SKU", render: (r) => r.sku || "—" },
    {
      key: "type",
      header: "Type",
      render: (r) => <Badge tone="muted">{r.type}</Badge>,
    },
    {
      key: "retailPrice",
      header: "Retail price",
      render: (r) => (
        <span className="font-mono tabular">{formatMoney(r.retailPrice)}</span>
      ),
    },
    {
      key: "costPrice",
      header: "Cost price",
      render: (r) => (
        <span className="font-mono tabular text-muted">
          {r.costPrice ? formatMoney(r.costPrice) : "—"}
        </span>
      ),
    },
    {
      key: "currentStock",
      header: "Stock on hand",
      render: (r) => (
        <span
          className={`font-mono tabular ${r.isLowStock ? "text-clay font-medium" : ""}`}
        >
          {r.currentStock}
          {r.isLowStock && (
            <AlertTriangle size={12} className="inline ml-1.5 -mt-0.5" />
          )}
        </span>
      ),
    },
    {
      key: "colors",
      header: "Colours",
      render: (r) =>
        r.colors?.length ? (
          <span className="text-xs text-muted">
            {r.colors.map((c) => `${c.name} (${c.stock})`).join(", ")}
          </span>
        ) : (
          "—"
        ),
    },
    { key: "lowStockAlert", header: "Reorder at" },
    {
      key: "value",
      header: "Asset value",
      render: (r) => (
        <span className="font-mono tabular text-muted">
          {formatMoney(r.currentStock * r.retailPrice)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => startEdit(r)}
            className="text-xs text-muted hover:text-moss-dark"
          >
            Edit
          </button>
          <button
            onClick={() => openHistory(r)}
            className="text-muted hover:text-ink"
            title="Stock change history"
          >
            <History size={14} />
          </button>
          <button
            onClick={() => handleDelete(r._id)}
            className="text-muted hover:text-clay"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 px-2 sm:px-4 lg:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-ink">
            Inventory
          </h1>
          <p className="text-sm text-muted mt-1">
            Stock is deducted as soon as a sales order is placed (through
            Packed, Delivered, and Damaged — restored on Returned) and added
            once an inventory expense is marked Delivered.
          </p>
        </div>
        <button
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          className="flex items-center justify-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors shrink-0"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? "Cancel" : "New product"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          onKeyDown={focusNextOnEnter}
          className="bg-card border border-line rounded-lg p-4 sm:p-5 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <input
              required
              placeholder="Product name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <input
              placeholder="SKU (optional)"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            {addingType ? (
              <div className="flex gap-2 items-center">
                <input
                  autoFocus
                  placeholder="New type name"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmNewType();
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-paper rounded-md border border-line"
                />
                <button
                  type="button"
                  onClick={confirmNewType}
                  className="px-3 py-2 text-sm rounded-md border border-line text-ink hover:border-moss transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setAddingType(false)}
                  className="px-2 text-sm text-muted hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <select
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-paper rounded-md border border-line"
                >
                  {types.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                  <option value={ADD_TYPE_OPTION}>+ Add new type…</option>
                </select>
                {form.type !== "Miscellaneous" && (
                  <>
                    <button
                      type="button"
                      onClick={handleTypeEdit}
                      className="text-muted hover:text-moss-dark shrink-0"
                      title="Edit type"
                      aria-label="Edit type"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleTypeDelete}
                      className="text-muted hover:text-clay shrink-0"
                      title="Delete type"
                      aria-label="Delete type"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="Retail price"
              value={form.retailPrice}
              onChange={(e) =>
                setForm({ ...form, retailPrice: e.target.value })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Cost price (for P&L)"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <input
              type="number"
              min="0"
              placeholder="Low stock alert threshold"
              value={form.lowStockAlert}
              onChange={(e) =>
                setForm({ ...form, lowStockAlert: e.target.value })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <input
              type="number"
              min="0"
              placeholder="Starting stock"
              disabled={hasColors}
              value={hasColors ? colorStockTotal : form.currentStock}
              onChange={(e) =>
                setForm({ ...form, currentStock: e.target.value })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line disabled:opacity-50"
            />
          </div>

          {editingId && (
            <div>
              <input
                placeholder="Reason for stock change (required if you adjust the quantity)"
                value={form.stockChangeComment}
                onChange={(e) => {
                  setForm({ ...form, stockChangeComment: e.target.value });
                  if (stockError) setStockError(null);
                }}
                className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
              />
              {stockError && (
                <p className="text-xs text-clay mt-1">{stockError}</p>
              )}
            </div>
          )}

          <div className="border-t border-line pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wide text-muted">
                Colour variants (optional — stock is tracked per colour when
                set)
              </p>
              <button
                type="button"
                onClick={addColorRow}
                className="text-xs text-moss-dark hover:underline"
              >
                + Add colour
              </button>
            </div>
            {form.colors.length === 0 ? (
              <p className="text-xs text-muted">
                No colour variants — this product uses a single stock count.
              </p>
            ) : (
              <div className="space-y-2">
                {form.colors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      placeholder="Colour name (e.g. Black)"
                      value={c.name}
                      onChange={(e) =>
                        updateColorRow(i, "name", e.target.value)
                      }
                      className="flex-1 px-3 py-1.5 text-sm bg-paper rounded-md border border-line"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Stock"
                      value={c.stock}
                      onChange={(e) =>
                        updateColorRow(i, "stock", e.target.value)
                      }
                      className="w-28 px-3 py-1.5 text-sm bg-paper rounded-md border border-line"
                    />
                    <button
                      type="button"
                      onClick={() => removeColorRow(i)}
                      className="text-muted hover:text-clay"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            disabled={saving}
            className="w-full sm:w-auto bg-moss text-white text-sm rounded-md py-2 px-6 hover:bg-moss-dark disabled:opacity-50 font-medium transition-colors"
          >
            {saving ? "Saving…" : editingId ? "Update product" : "Save product"}
          </button>
        </form>
      )}

      {/* ULTRA-COMPACT MOBILE LIST VIEW */}
      <div className="md:hidden space-y-2.5">
        {/* Filters & Search */}
        <div className="space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU..."
            className="w-full px-3 py-1.5 text-xs bg-paper rounded-md border border-line"
          />

          <div className="flex items-center gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex-1 px-2 py-1 text-xs bg-paper rounded-md border border-line"
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs text-muted shrink-0 bg-paper px-2 py-1 rounded-md border border-line cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="accent-clay h-3.5 w-3.5"
              />
              Low stock
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted px-0.5">
          <span>{products.length} products</span>
        </div>

        {/* High-Density Row Cards with Always-Visible Color Variants */}
        <div className="max-h-[calc(100vh-210px)] overflow-y-auto space-y-1.5 pr-0.5">
          {products.map((r) => (
            <div
              key={r._id}
              className={`bg-card border rounded-md px-2.5 py-2 shadow-2xs space-y-1 ${
                r.isLowStock
                  ? "border-clay/50 bg-clay-light/10"
                  : "border-line"
              }`}
            >
              {/* Primary Row: Name, SKU, Total Stock & Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-xs text-ink truncate">
                      {r.name}
                    </span>
                    {r.sku && (
                      <span className="text-[10px] font-mono text-muted shrink-0">
                        ({r.sku})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted">{r.type}</span>
                    <span className="text-[10px] font-mono text-muted">
                      • {formatMoney(r.retailPrice)}
                    </span>
                  </div>
                </div>

                {/* Stock Badge & Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                      r.isLowStock
                        ? "bg-clay text-white"
                        : "bg-moss-light text-moss-dark"
                    }`}
                  >
                    {r.currentStock}
                  </span>

                  <div className="flex items-center gap-1 pl-1 border-l border-line/60 text-muted">
                    <button
                      onClick={() => openHistory(r)}
                      className="p-1 hover:text-ink"
                      title="History"
                    >
                      <History size={13} />
                    </button>
                    <button
                      onClick={() => startEdit(r)}
                      className="p-1 hover:text-moss-dark"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(r._id)}
                      className="p-1 hover:text-clay"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Colors & Quantities Breakdown (Always Visible) */}
              {r.colors?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-line/40">
                  {r.colors.map((c) => (
                    <span
                      key={c.name}
                      className="text-[9px] bg-paper border border-line px-1.5 py-0.5 rounded text-ink font-medium"
                    >
                      {c.name}: <span className="font-mono text-muted">{c.stock}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {products.length === 0 && (
            <div className="py-10 text-center text-xs text-muted">
              No products match your filters.
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block w-full overflow-x-auto min-w-full">
        <DataTable
          columns={columns}
          rows={products}
          searchValue={search}
          onSearchChange={setSearch}
          onRowDoubleClick={startEdit}
          searchPlaceholder="Search name or SKU…"
          filters={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
              >
                <option value="">All types</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="accent-clay"
                />
                Low stock only
              </label>
            </div>
          }
          page={1}
          pages={1}
          onPageChange={() => {}}
          emptyLabel="No products match your filters."
        />
      </div>

      {historyFor && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 px-0 sm:px-4"
          onClick={() => setHistoryFor(null)}
        >
          <div
            className="bg-card w-full sm:max-w-lg sm:rounded-lg rounded-t-lg border border-line max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <p className="font-display text-lg text-ink">
                  Stock change history
                </p>
                <p className="text-xs text-muted mt-0.5">{historyFor.name}</p>
              </div>
              <button
                onClick={() => setHistoryFor(null)}
                className="text-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4">
              {historyLoading ? (
                <p className="text-sm text-muted flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </p>
              ) : historyLogs.length === 0 ? (
                <p className="text-sm text-muted">
                  No manual stock changes logged yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {historyLogs.map((log) => (
                    <div
                      key={log._id}
                      className="border-b border-line pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono tabular text-ink">
                          {log.previousStock} → {log.newStock}
                        </span>
                        <span
                          className={`font-mono text-xs font-medium ${
                            log.delta >= 0 ? "text-moss-dark" : "text-clay"
                          }`}
                        >
                          {log.delta >= 0 ? `+${log.delta}` : log.delta}
                        </span>
                      </div>
                      <p className="text-sm text-ink mt-1">{log.comment}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}