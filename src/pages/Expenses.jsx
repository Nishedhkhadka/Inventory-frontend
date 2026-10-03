import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Trash2, Pencil, X, FileDown } from "lucide-react";
import {
  fetchPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase,
  purchasesExportUrl,
  fetchPurchaseTags,
  fetchPurchaseCategories,
  deletePurchaseCategory,
} from "../api/purchases";
import { fetchProducts } from "../api/products";
import { fetchContacts } from "../api/contacts";
import DataTable, { Badge } from "../components/DataTable";
import { focusNextOnEnter } from "../utils/formNav";
import { formatDate, todayStr } from "../utils/dateFmt";
import { formatMoney } from "../utils/currency";
import { downloadFile } from "../utils/download";

// Just two states now: still on order, or actually landed. Delivered is
// what triggers the automatic stock credit for inventory procurements.
const STATUSES = ["Ordered", "Delivered"];
// Starting point only — the real list comes from the backend (baseline +
// whatever custom categories are already in use) and can grow from the
// form itself via "+ Add new category".
const DEFAULT_CATEGORIES = [
  "Inventory",
  "Meta Ads",
  "Packaging",
  "Shipping",
  "Miscellaneous",
];
const ADD_CATEGORY_OPTION = "__add_new__";

const makeEmptyForm = () => ({
  productName: "",
  product: "",
  color: "",
  quantity: "",
  cost: "",
  category: "Inventory",
  status: "Ordered",
  supplier: "",
  orderDate: todayStr(),
  arriveBy: "",
  weightCbm: "",
  tags: "",
  notes: "",
});

export default function Expenses({ initialSearch }) {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [search, setSearch] = useState(initialSearch || "");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(makeEmptyForm);
  // Extra colour+quantity+cost lines for a single procurement that covers
  // several colours of the same product in one purchase order.
  const [extraColorLines, setExtraColorLines] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchPurchases({ search, status, category, tag, page, limit: 10 }).then(
      (res) => {
        setPurchases(res.data);
        setPages(res.pages || 1);
      },
    );
  }, [search, status, category, tag, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchProducts().then(setProducts);
    fetchPurchaseTags().then(setAllTags);
    fetchPurchaseCategories().then(setCategories);
    fetchContacts().then((rows) =>
      setSupplierOptions(rows.map((contact) => contact.name).filter(Boolean)),
    );
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p._id === form.product),
    [products, form.product],
  );

  const isInventory = form.category === "Inventory";
  const hasColorVariants = isInventory && selectedProduct?.colors?.length > 0;

  const handleProductChange = (productId) => {
    const product = products.find((p) => p._id === productId);
    setForm((f) => ({
      ...f,
      product: productId,
      productName: product ? product.name : f.productName,
      color: product?.colors?.length ? product.colors[0].name : "",
    }));
    setExtraColorLines([]);
  };

  const handleCategoryChange = (cat) => {
    if (cat === ADD_CATEGORY_OPTION) {
      setAddingCategory(true);
      setNewCategoryName("");
      return;
    }
    setForm((f) => ({
      ...f,
      category: cat,
      // Non-inventory expenses aren't tied to a catalog product.
      product: cat === "Inventory" ? f.product : "",
      color: cat === "Inventory" ? f.color : "",
    }));
    setExtraColorLines([]);
  };

  const handleCategoryDelete = async () => {
    const active = form.category;
    if (!active || DEFAULT_CATEGORIES.includes(active)) return;

    const confirmed = window.confirm(
      `Delete category "${active}"? Any expenses in it will be moved to "Miscellaneous".`,
    );
    if (!confirmed) return;

    try {
      const result = await deletePurchaseCategory(active);
      setCategories(result.categories || []);
      setForm((prev) => ({ ...prev, category: "Miscellaneous" }));
      if (category === active) setCategory("Miscellaneous");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const confirmNewCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      setAddingCategory(false);
      return;
    }
    setCategories((prev) =>
      prev.includes(name) ? prev : [...prev, name].sort(),
    );
    handleCategoryChange(name);
    setAddingCategory(false);
    setNewCategoryName("");
  };

  const addColorLine = () => {
    const used = new Set([form.color, ...extraColorLines.map((l) => l.color)]);
    const nextColor =
      selectedProduct?.colors?.find((c) => !used.has(c.name))?.name || "";
    setExtraColorLines((lines) => [
      ...lines,
      { color: nextColor, quantity: "", cost: "" },
    ]);
  };
  const updateColorLine = (i, key, value) =>
    setExtraColorLines((lines) =>
      lines.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)),
    );
  const removeColorLine = (i) =>
    setExtraColorLines((lines) => lines.filter((_, idx) => idx !== i));

  const handleStatusChange = async (purchase, newStatus) => {
    await updatePurchase(purchase._id, { status: newStatus });
    load();
  };

  const handleDelete = async (id) => {
    if (
      !confirm(
        "Delete this expense record? This will reverse any stock it added.",
      )
    )
      return;
    await deletePurchase(id);
    load();
  };

  const startEdit = (purchase) => {
    setEditingId(purchase._id);
    setExtraColorLines([]);
    setForm({
      productName: purchase.productName,
      product: purchase.product?._id || "",
      color: purchase.color || "",
      quantity: purchase.quantity ?? "",
      cost: purchase.cost,
      category: purchase.category,
      status: purchase.status,
      supplier: purchase.supplier || "",
      orderDate: purchase.orderDate ? purchase.orderDate.slice(0, 10) : "",
      arriveBy: purchase.arriveBy ? purchase.arriveBy.slice(0, 10) : "",
      weightCbm: purchase.weightCbm || "",
      tags: (purchase.tags || []).join(", "),
      notes: purchase.notes || "",
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(makeEmptyForm());
    setExtraColorLines([]);
    setAddingCategory(false);
    setNewCategoryName("");
  };

  const parseTags = (raw) =>
    raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const shared = {
        productName: form.productName,
        category: form.category,
        status: form.status,
        supplier: form.supplier,
        orderDate: form.orderDate || undefined,
        arriveBy: form.arriveBy || undefined,
        weightCbm: form.weightCbm,
        tags: parseTags(form.tags),
        notes: form.notes,
      };

      if (editingId || !hasColorVariants || extraColorLines.length === 0) {
        // Single line: either editing (always one document), or a
        // non-colour / single-colour purchase.
        await (editingId
          ? updatePurchase(editingId, {
              ...shared,
              product: isInventory && form.product ? form.product : undefined,
              color: isInventory && form.color ? form.color : undefined,
              quantity: form.quantity ? Number(form.quantity) : undefined,
              cost: Number(form.cost),
            })
          : createPurchase({
              ...shared,
              product: isInventory && form.product ? form.product : undefined,
              color: isInventory && form.color ? form.color : undefined,
              quantity: form.quantity ? Number(form.quantity) : undefined,
              cost: Number(form.cost),
            }));
      } else {
        // Multi-colour procurement: one Purchase document per colour line,
        // each with its own quantity and cost, sharing everything else.
        const lines = [
          {
            color: form.color,
            quantity: form.quantity ? Number(form.quantity) : undefined,
            cost: Number(form.cost),
          },
          ...extraColorLines
            .filter((l) => l.color && l.quantity && l.cost)
            .map((l) => ({
              color: l.color,
              quantity: Number(l.quantity),
              cost: Number(l.cost),
            })),
        ];
        for (const line of lines) {
          await createPurchase({ ...shared, product: form.product, ...line });
        }
      }
      cancelForm();
      setPage(1);
      load();
      fetchPurchaseTags().then(setAllTags);
      fetchPurchaseCategories().then(setCategories);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "orderDate",
      header: "Ordered",
      render: (r) => formatDate(r.orderDate),
    },
    {
      key: "productName",
      header: "Item",
      render: (r) => (
        <span>
          {r.productName}
          {r.color && <span className="text-muted"> · {r.color}</span>}
        </span>
      ),
    },
    { key: "supplier", header: "Supplier" },
    { key: "quantity", header: "Qty" },
    {
      key: "cost",
      header: "Cost",
      render: (r) => (
        <span className="font-mono tabular">{formatMoney(r.cost)}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (r) => <Badge tone="muted">{r.category}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <select
          value={r.status}
          onChange={(e) => handleStatusChange(r, e.target.value)}
          className={`text-xs rounded px-2 py-1 border-0 font-medium cursor-pointer ${
            r.status === "Delivered"
              ? "bg-moss-light text-moss-dark"
              : "bg-sky-light text-sky"
          }`}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (r) =>
        r.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {r.tags.map((t) => (
              <Badge key={t} tone="muted">
                {t}
              </Badge>
            ))}
          </div>
        ) : (
          "—"
        ),
    },
    {
      key: "weightCbm",
      header: "Weight / CBM",
      render: (r) => r.weightCbm || "—",
    },
    {
      key: "notes",
      header: "Notes",
      render: (r) => (
        <span className="max-w-[220px] block truncate">{r.notes || "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => startEdit(r)}
            className="text-muted hover:text-moss-dark"
          >
            <Pencil size={14} />
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-ink">
            Expenses
          </h1>
          <p className="text-sm text-muted mt-1">
            Procurement, ad spend, and other costs. An inventory item marked
            "Delivered" restocks automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              downloadFile(
                purchasesExportUrl({ status, category, tag }),
                "zeno-expenses.xlsx",
              )
            }
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md border border-line text-muted hover:text-ink hover:border-moss transition-colors"
          >
            <FileDown size={15} />{" "}
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => (showForm ? cancelForm() : setShowForm(true))}
            className="flex items-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors"
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? "Cancel" : "New expense"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          onKeyDown={focusNextOnEnter}
          className="bg-card border border-line rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3"
        >
          {addingCategory ? (
            <div className="flex gap-2">
              <input
                autoFocus
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmNewCategory();
                  }
                }}
                className="flex-1 px-3 py-2 text-sm bg-paper rounded-md border border-line"
              />
              <button
                type="button"
                onClick={confirmNewCategory}
                className="px-3 py-2 text-sm rounded-md border border-line text-ink hover:border-moss transition-colors shrink-0"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAddingCategory(false)}
                className="px-2 text-sm text-muted hover:text-ink shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <select
                value={form.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-paper rounded-md border border-line"
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option value={ADD_CATEGORY_OPTION}>+ Add new category…</option>
              </select>
              {!DEFAULT_CATEGORIES.includes(form.category) && (
                <button
                  type="button"
                  onClick={handleCategoryDelete}
                  className="text-muted hover:text-clay shrink-0"
                  title="Delete this category"
                  aria-label="Delete this category"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}

          {isInventory ? (
            <select
              required
              value={form.product}
              onChange={(e) => handleProductChange(e.target.value)}
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — {p.currentStock} in stock
                </option>
              ))}
            </select>
          ) : (
            <input
              required
              placeholder="Expense description"
              value={form.productName}
              onChange={(e) =>
                setForm({ ...form, productName: e.target.value })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
          )}

          {isInventory && selectedProduct?.colors?.length > 0 && (
            <select
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            >
              {selectedProduct.colors.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} — {c.stock} in stock
                </option>
              ))}
            </select>
          )}

          <>
            <input
              list="supplier-options"
              placeholder="Supplier"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <datalist id="supplier-options">
              {supplierOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </>
          <input
            type="number"
            min="0"
            placeholder="Quantity"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="Total landed cost"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />

          {hasColorVariants &&
            !editingId &&
            extraColorLines.map((line, i) => (
              <div
                key={i}
                className="flex items-center gap-2 col-span-1 sm:col-span-2 md:col-span-4"
              >
                <span className="text-xs text-muted w-16 shrink-0">Also…</span>
                <select
                  value={line.color}
                  onChange={(e) => updateColorLine(i, "color", e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-paper rounded-md border border-line"
                >
                  {selectedProduct.colors.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} — {c.stock} in stock
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) =>
                    updateColorLine(i, "quantity", e.target.value)
                  }
                  className="w-24 px-3 py-2 text-sm bg-paper rounded-md border border-line"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cost"
                  value={line.cost}
                  onChange={(e) => updateColorLine(i, "cost", e.target.value)}
                  className="w-28 px-3 py-2 text-sm bg-paper rounded-md border border-line"
                />
                <button
                  type="button"
                  onClick={() => removeColorLine(i)}
                  className="text-muted hover:text-clay shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

          {hasColorVariants &&
            !editingId &&
            extraColorLines.length < selectedProduct.colors.length - 1 && (
              <button
                type="button"
                onClick={addColorLine}
                className="text-xs text-moss-dark hover:underline text-left col-span-1 sm:col-span-2 md:col-span-4 -mt-1"
              >
                + Add another colour to this purchase
              </button>
            )}

          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="text-xs text-muted flex flex-col gap-1">
            Order date
            <input
              type="date"
              value={form.orderDate}
              onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
          </label>
          <label className="text-xs text-muted flex flex-col gap-1">
            Expected date
            <input
              type="date"
              value={form.arriveBy}
              onChange={(e) => setForm({ ...form, arriveBy: e.target.value })}
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
          </label>
          <input
            placeholder="Weight / CBM"
            value={form.weightCbm}
            onChange={(e) => setForm({ ...form, weightCbm: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
          />
          <input
            list="expense-tag-options"
            placeholder="Tags (comma separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-2"
          />
          <datalist id="expense-tag-options">
            {allTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-2"
          />

          {isInventory && form.status === "Delivered" && (
            <p className="col-span-1 sm:col-span-2 md:col-span-4 text-xs text-moss-dark -mt-1">
              Saving this will add {form.quantity || 0} unit(s) to{" "}
              {selectedProduct?.name || "the selected product"}'s stock
              {form.color ? ` (${form.color})` : ""}
              {extraColorLines.length > 0
                ? ", plus the additional colour lines above"
                : ""}
              .
            </p>
          )}

          <button
            disabled={saving}
            className="bg-moss text-white text-sm rounded-md py-2 hover:bg-moss-dark disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId ? "Update expense" : "Save expense"}
          </button>
        </form>
      )}

      <DataTable
        columns={columns}
        rows={purchases}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onRowDoubleClick={startEdit}
        searchPlaceholder="Search item, supplier, or tag…"
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                setPage(1);
              }}
              className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        }
        onRowDoubleClick={startEdit}
        page={page}
        pages={pages}
        onPageChange={setPage}
        emptyLabel="No expenses match your filters."
      />
    </div>
  );
}
