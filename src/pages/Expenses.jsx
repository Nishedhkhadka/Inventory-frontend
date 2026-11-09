import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Trash2, Pencil, X, FileDown, Calendar, Tag } from "lucide-react";
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

const STATUSES = ["Ordered", "Delivered"];
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
  const [editingGroupIds, setEditingGroupIds] = useState(null);
  const [form, setForm] = useState(makeEmptyForm);
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

  // Group purchases that share the exact same orderDate, supplier, productName, category, and status into single display rows
  const groupedPurchases = useMemo(() => {
    const map = new Map();
    for (const p of purchases) {
      const dateKey = p.orderDate ? p.orderDate.slice(0, 10) : "";
      const key = `${dateKey}_${p.supplier || ""}_${p.productName}_${p.category}_${p.status}`;
      
      if (!map.has(key)) {
        map.set(key, {
          ...p,
          ids: [p._id],
          colorsList: p.color ? [{ color: p.color, qty: p.quantity || 0, cost: p.cost || 0 }] : [],
          totalQty: p.quantity || 0,
          totalCost: p.cost || 0,
          isGrouped: false,
        });
      } else {
        const existing = map.get(key);
        existing.ids.push(p._id);
        if (p.color) {
          existing.colorsList.push({ color: p.color, qty: p.quantity || 0, cost: p.cost || 0 });
        }
        existing.totalQty += (p.quantity || 0);
        existing.totalCost += (p.cost || 0);
        existing.isGrouped = true;
      }
    }
    return Array.from(map.values());
  }, [purchases]);

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

  const handleStatusChange = async (group, newStatus) => {
    try {
      for (const id of group.ids) {
        await updatePurchase(id, { status: newStatus });
      }
      load();
    } catch (err) {
      alert("Failed to update status on server.");
      load();
    }
  };

  const handleDeleteGroup = async (group) => {
    if (
      !confirm(
        "Delete this expense record? This will reverse any stock it added.",
      )
    )
      return;
    try {
      for (const id of group.ids) {
        await deletePurchase(id);
      }
      load();
    } catch (err) {
      alert("Failed to delete purchase records.");
    }
  };

  const startEditGroup = (group) => {
    const matchingPurchases = purchases.filter((p) => group.ids.includes(p._id));
    if (matchingPurchases.length === 0) return;

    const first = matchingPurchases[0];
    setEditingGroupIds(group.ids);

    const extras = matchingPurchases.slice(1).map((p) => ({
      color: p.color || "",
      quantity: p.quantity ?? "",
      cost: p.cost ?? "",
    }));

    setExtraColorLines(extras);
    setForm({
      productName: first.productName,
      product: first.product?._id || "",
      color: first.color || "",
      quantity: first.quantity ?? "",
      cost: first.cost,
      category: first.category,
      status: first.status,
      supplier: first.supplier || "",
      orderDate: first.orderDate ? first.orderDate.slice(0, 10) : "",
      arriveBy: first.arriveBy ? first.arriveBy.slice(0, 10) : "",
      weightCbm: first.weightCbm || "",
      tags: (first.tags || []).join(", "),
      notes: first.notes || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingGroupIds(null);
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

      const allLines = [
        {
          color: form.color,
          quantity: Number(form.quantity) || 0,
          cost: Number(form.cost) || 0,
        },
        ...(hasColorVariants
          ? extraColorLines
              .filter((l) => l.color && l.quantity !== "")
              .map((l) => ({
                color: l.color,
                quantity: Number(l.quantity) || 0,
                cost: Number(l.cost) || 0,
              }))
          : []),
      ];

      const totalCostInput = Number(form.cost) || 0;
      const totalQty = allLines.reduce((sum, l) => sum + l.quantity, 0);
      const hasCustomCosts = allLines.some((l) => l.cost > 0 && l !== allLines[0]);

      const finalizedItems = allLines.map((l) => {
        let itemCost = l.cost;
        if (!hasCustomCosts && totalCostInput > 0 && totalQty > 0) {
          itemCost = Math.round((totalCostInput * (l.quantity / totalQty)) * 100) / 100;
        }
        return {
          color: l.color,
          quantity: l.quantity,
          cost: itemCost,
        };
      });

      if (editingGroupIds && editingGroupIds.length > 0) {
        // Update existing records in editingGroupIds, create new ones if added, delete extras if removed
        for (let i = 0; i < finalizedItems.length; i++) {
          const item = finalizedItems[i];
          const payload = {
            ...shared,
            product: isInventory && form.product ? form.product : undefined,
            color: isInventory && item.color ? item.color : undefined,
            quantity: item.quantity,
            cost: item.cost,
          };

          if (i < editingGroupIds.length) {
            await updatePurchase(editingGroupIds[i], payload);
          } else {
            await createPurchase(payload);
          }
        }

        // If user removed color lines, delete the excess old documents
        if (finalizedItems.length < editingGroupIds.length) {
          const idsToDelete = editingGroupIds.slice(finalizedItems.length);
          for (const idToDelete of idsToDelete) {
            await deletePurchase(idToDelete);
          }
        }
      } else {
        if (!hasColorVariants || finalizedItems.length <= 1) {
          await createPurchase({
            ...shared,
            product: isInventory && form.product ? form.product : undefined,
            color: isInventory && form.color ? form.color : undefined,
            quantity: form.quantity ? Number(form.quantity) : undefined,
            cost: Number(form.cost),
          });
        } else {
          await createPurchase({
            ...shared,
            product: form.product,
            items: finalizedItems,
          });
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
          {r.colorsList.length > 0 ? (
            <span className="text-muted block text-xs">
              {r.colorsList.map((c) => `${c.color}: ${c.qty}`).join(" · ")}
            </span>
          ) : (
            r.color && <span className="text-muted"> · {r.color}</span>
          )}
        </span>
      ),
    },
    { key: "supplier", header: "Supplier" },
    {
      key: "quantity",
      header: "Qty",
      render: (r) => <span className="font-mono tabular">{r.totalQty}</span>,
    },
    {
      key: "cost",
      header: "Cost",
      render: (r) => (
        <span className="font-mono tabular">{formatMoney(r.totalCost)}</span>
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
              ? "bg-success-light text-success-dark"
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
            onClick={() => startEditGroup(r)}
            className="text-muted hover:text-moss-dark"
            title="Edit expense"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => handleDeleteGroup(r)}
            className="text-muted hover:text-clay"
            title="Delete expense"
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
            Expenses
          </h1>
          <p className="text-sm text-muted mt-1">
            Procurement, ad spend, and other costs. An inventory item marked
            "Delivered" restocks automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() =>
              downloadFile(
                purchasesExportUrl({ status, category, tag }),
                "zeno-expenses.xlsx",
              )
            }
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-sm px-4 py-2 rounded-md border border-line text-muted hover:text-ink hover:border-moss transition-colors"
          >
            <FileDown size={15} />{" "}
            <span className="inline sm:inline">Export</span>
          </button>
          <button
            onClick={() => (showForm ? cancelForm() : setShowForm(true))}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors"
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
          className="bg-card border border-line rounded-lg p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full"
        >
          {addingCategory ? (
            <div className="flex gap-2 col-span-1 sm:col-span-2 md:col-span-1">
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
                className="flex-1 px-3 py-2 text-sm bg-paper rounded-md border border-line w-full"
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
            <div className="flex gap-2 items-center col-span-1 sm:col-span-2 md:col-span-1">
              <select
                value={form.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
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
                  className="text-muted hover:text-clay shrink-0 p-1"
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
              className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-2 md:col-span-1"
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
              className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-2 md:col-span-1"
            />
          )}

          {isInventory && selectedProduct?.colors?.length > 0 && (
            <select
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-2 md:col-span-1"
            >
              {selectedProduct.colors.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} — {c.stock} in stock
                </option>
              ))}
            </select>
          )}

          <div className="col-span-1 sm:col-span-2 md:col-span-1">
            <input
              list="supplier-options"
              placeholder="Supplier"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <datalist id="supplier-options">
              {supplierOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <input
            type="number"
            min="0"
            placeholder="Quantity"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-1"
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="Total landed cost"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-1"
          />

          {hasColorVariants &&
            extraColorLines.map((line, i) => (
              <div
                key={i}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 col-span-1 sm:col-span-2 md:col-span-4 bg-paper/50 p-2 sm:p-0 rounded-md border sm:border-0 border-line"
              >
                <span className="text-xs text-muted w-full sm:w-16 shrink-0 font-medium">Also…</span>
                <select
                  value={line.color}
                  onChange={(e) => updateColorLine(i, "color", e.target.value)}
                  className="flex-1 min-w-[140px] px-3 py-2 text-sm bg-paper rounded-md border border-line"
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
                  className="w-20 sm:w-24 px-3 py-2 text-sm bg-paper rounded-md border border-line"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cost (optional override)"
                  value={line.cost}
                  onChange={(e) => updateColorLine(i, "cost", e.target.value)}
                  className="w-36 sm:w-44 px-3 py-2 text-sm bg-paper rounded-md border border-line"
                />
                <button
                  type="button"
                  onClick={() => removeColorLine(i)}
                  className="text-muted hover:text-clay shrink-0 p-1 ml-auto sm:ml-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

          {hasColorVariants &&
            extraColorLines.length < selectedProduct.colors.length - 1 && (
              <button
                type="button"
                onClick={addColorLine}
                className="text-xs text-moss-dark hover:underline text-left col-span-1 sm:col-span-2 md:col-span-4 -mt-1 py-1"
              >
                + Add another colour to this purchase
              </button>
            )}

          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-1"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="text-xs text-muted flex flex-col gap-1 col-span-1 sm:col-span-1">
            Order date
            <input
              type="date"
              value={form.orderDate}
              onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
          </label>
          <label className="text-xs text-muted flex flex-col gap-1 col-span-1 sm:col-span-1">
            Expected date
            <input
              type="date"
              value={form.arriveBy}
              onChange={(e) => setForm({ ...form, arriveBy: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
          </label>
          <input
            placeholder="Weight / CBM"
            value={form.weightCbm}
            onChange={(e) => setForm({ ...form, weightCbm: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-1"
          />
          <div className="col-span-1 sm:col-span-2">
            <input
              list="expense-tag-options"
              placeholder="Tags (comma separated)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <datalist id="expense-tag-options">
              {allTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-2"
          />

          {isInventory && form.status === "Delivered" && (
            <p className="col-span-1 sm:col-span-2 md:col-span-4 text-xs text-moss-dark -mt-1">
              Saving this will add units to {selectedProduct?.name || "the selected product"}'s stock across all specified colors.
            </p>
          )}

          <button
            disabled={saving}
            className="w-full bg-moss text-white text-sm rounded-md py-2.5 sm:py-2 hover:bg-moss-dark disabled:opacity-50 col-span-1 sm:col-span-2 md:col-span-4 mt-1 font-medium transition-colors"
          >
            {saving ? "Saving…" : editingGroupIds ? "Update expense" : "Save expense"}
          </button>
        </form>
      )}

      {/* ULTRA-COMPACT MOBILE LIST VIEW */}
      <div className="md:hidden space-y-2.5">
        <div className="space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search item, supplier, or tag..."
            className="w-full px-3 py-1.5 text-xs bg-paper rounded-md border border-line"
          />

          <div className="grid grid-cols-3 gap-2">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-2 py-1 text-xs bg-paper rounded-md border border-line"
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
              className="w-full px-2 py-1 text-xs bg-paper rounded-md border border-line"
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
              className="w-full px-2 py-1 text-xs bg-paper rounded-md border border-line"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted px-0.5">
          <span>{groupedPurchases.length} records</span>
        </div>

        <div className="max-h-[calc(100vh-210px)] overflow-y-auto space-y-1.5 pr-0.5">
          {groupedPurchases.map((r, idx) => (
            <div
              key={r._id || idx}
              className="bg-card border border-line rounded-md px-2.5 py-2 shadow-2xs space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-xs text-ink truncate">
                      {r.productName}
                    </span>
                    {r.colorsList.length > 0 ? (
                      <span className="text-[10px] text-muted truncate">
                        · {r.colorsList.map((c) => `${c.color}: ${c.qty}`).join(" · ")}
                      </span>
                    ) : (
                      r.color && <span className="text-[10px] text-muted shrink-0">· {r.color}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Badge tone="muted">{r.category}</Badge>
                    {r.supplier && (
                      <span className="text-[10px] text-muted truncate">
                        • {r.supplier}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-semibold text-xs font-mono text-ink">
                    {formatMoney(r.totalCost)}
                  </div>
                  <div className="text-[10px] text-muted font-mono">
                    Qty: {r.totalQty}
                  </div>
                </div>
              </div>

              {r.tags?.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  <Tag className="w-3 h-3 text-muted shrink-0" />
                  {r.tags.map((t) => (
                    <Badge key={t} tone="muted">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              {r.notes && (
                <div className="pt-0.5">
                  <span className="text-[10px] text-muted truncate block">
                    Note: {r.notes}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-line/40">
                <div className="flex items-center gap-2">
                  <select
                    value={r.status}
                    onChange={(e) => handleStatusChange(r, e.target.value)}
                    className={`text-[10px] rounded px-1.5 py-0.5 border-0 font-medium cursor-pointer ${
                      r.status === "Delivered"
                        ? "bg-success-light text-success-dark"
                        : "bg-sky-light text-sky"
                    }`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 text-[10px] text-muted">
                    <Calendar className="w-3 h-3 text-muted shrink-0" />
                    <span>{formatDate(r.orderDate)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-muted">
                  <button
                    onClick={() => startEditGroup(r)}
                    className="p-1 hover:text-moss-dark"
                    title="Edit expense"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(r)}
                    className="p-1 hover:text-clay"
                    title="Delete expense"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {groupedPurchases.length === 0 && (
            <div className="py-10 text-center text-xs text-muted">
              No expenses match your filters.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-xs rounded-md border border-line bg-paper disabled:opacity-40"
          >
            Previous
          </button>

          <span className="text-[10px] text-muted">
            Page {page} of {pages || 1}
          </span>

          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="px-3 py-1.5 text-xs rounded-md border border-line bg-paper disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block w-full overflow-x-auto min-w-full">
        <DataTable
          columns={columns}
          rows={groupedPurchases}
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          onRowDoubleClick={(r) => startEditGroup(r)}
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
          page={page}
          pages={pages}
          onPageChange={setPage}
          emptyLabel="No expenses match your filters."
        />
      </div>
    </div>
  );
}