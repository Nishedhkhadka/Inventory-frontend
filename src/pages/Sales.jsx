import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Trash2, Pencil, X, FileDown } from "lucide-react";
import {
  fetchSales,
  createSale,
  updateSale,
  deleteSale,
  salesExportUrl,
} from "../api/sales";
import { fetchProducts } from "../api/products";
import DataTable from "../components/DataTable";
import { focusNextOnEnter } from "../utils/formNav";
import { formatDate, todayStr } from "../utils/dateFmt";
import { formatMoney } from "../utils/currency";

// Tone mappings using light background and dark text palette
const STATUS_TONE = {
  "In progress": "bg-sky-light text-sky",
  Packed: "bg-amber-light text-amber",
  Delivered: "bg-moss-light text-moss-dark",
  Returned: "bg-clay-light text-clay",
  Damaged: "bg-rose-light text-rose",
};

const PAYMENT_TONE = {
  Paid: "bg-moss-light text-moss-dark",
  COD: "bg-amber-light text-amber",
  Unpaid: "bg-rose-light text-rose",
};

const STATUSES = ["In progress", "Packed", "Delivered", "Returned", "Damaged"];
const PAID_STATUSES = ["COD", "Paid", "Unpaid"];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Strips sub-line suffixes (-line-2, -L2) to group multi-product orders into a single row
const baseOrderId = (id) =>
  (id || "").replace(/(-line-\d+|-L\d+|-line\d+)$/i, "");

const makeEmptyLine = () => ({
  product: "",
  color: "",
  quantity: 1,
  unitPrice: "",
  lineTotal: "",
  priceTouched: false,
});

const DELIVERY_PARTNER_DEFAULTS = ["PD", "ID", "YG", "Nabil", "Pathao", "RedX"];

const makeEmptyOrderForm = () => ({
  orderId: "",
  status: "In progress",
  paidStatus: "COD",
  pointOfContact: "",
  customerPhone: "",
  orderDate: todayStr(),
  notes: "",
  deliveryPartner: "",
  deliveryFeeCharged: "",
  deliveryCost: "",
});

export default function Sales({ initialSearch, openFormOnLoad }) {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState(initialSearch || "");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [showForm, setShowForm] = useState(!!openFormOnLoad);
  const [editingGroup, setEditingGroup] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [orderForm, setOrderForm] = useState(makeEmptyOrderForm);
  const [lines, setLines] = useState([makeEmptyLine()]);
  const [orderDiscount, setOrderDiscount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deliveryPartners, setDeliveryPartners] = useState(
    DELIVERY_PARTNER_DEFAULTS,
  );
  const [deliveryMenuOpen, setDeliveryMenuOpen] = useState(false);

  const load = useCallback(() => {
    fetchSales({
      search,
      status,
      page,
      limit: 25,
      from: fromDate,
      to: toDate,
    }).then((res) => {
      const sorted = [...(res.data || [])].sort(
        (a, b) =>
          new Date(b.orderDate || b.createdAt || 0) -
          new Date(a.orderDate || a.createdAt || 0),
      );
      setSales(sorted);
      setPages(res.pages || 1);
    });
  }, [search, status, page, fromDate, toDate]);

  useEffect(() => {
    const stored = localStorage.getItem("zeno-delivery-partners");
    const parsed = stored ? JSON.parse(stored) : [];
    const merged = [
      ...new Set([
        ...DELIVERY_PARTNER_DEFAULTS,
        ...parsed,
        ...sales.map((s) => s.deliveryPartner).filter(Boolean),
      ]),
    ];
    setDeliveryPartners(merged);
  }, [sales]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openFormOnLoad) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [openFormOnLoad]);

  useEffect(() => {
    fetchProducts().then(setProducts);
  }, []);

  const productById = useMemo(() => {
    const map = new Map();
    products.forEach((p) => map.set(p._id, p));
    return map;
  }, [products]);

  const stockFor = (product, colorName) => {
    if (!product) return null;
    if (!product.colors?.length) return product.currentStock;
    const c = product.colors.find((c) => c.name === colorName);
    return c ? c.stock : null;
  };

  const groupedSales = useMemo(() => {
    const map = new Map();
    for (const sale of sales) {
      const key = baseOrderId(sale.orderId) || sale._id;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(sale);
    }
    return Array.from(map.entries()).map(([key, groupLines]) => {
      const deliveryLine =
        groupLines.find(
          (l) =>
            l.deliveryFeeCharged !== null && l.deliveryFeeCharged !== undefined,
        ) ||
        groupLines.find((l) => l.deliveryCost) ||
        groupLines[0];
      return {
        key,
        primary: groupLines[0],
        deliveryLine,
        lines: groupLines,
        lineTotal: groupLines.reduce((sum, l) => sum + (l.lineTotal || 0), 0),
        quantity: groupLines.reduce((sum, l) => sum + (l.quantity || 0), 0),
      };
    });
  }, [sales]);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0),
    [lines],
  );
  const finalProductTotal = Math.max(
    0,
    round2(subtotal - (Number(orderDiscount) || 0)),
  );
  const deliveryFeeNum =
    orderForm.deliveryFeeCharged === ""
      ? 0
      : Number(orderForm.deliveryFeeCharged);
  const grandTotal = round2(finalProductTotal + deliveryFeeNum);

  const updateLine = (i, patch) =>
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );

  const handleLineProductChange = (i, productId) => {
    const product = productById.get(productId);
    updateLine(i, {
      product: productId,
      color: product?.colors?.length ? product.colors[0].name : "",
      unitPrice: product ? product.retailPrice : "",
      lineTotal: product
        ? product.retailPrice * (Number(lines[i].quantity) || 1)
        : "",
      priceTouched: false,
    });
  };

  const handleLineQuantityChange = (i, value) => {
    const line = lines[i];
    updateLine(i, {
      quantity: value,
      lineTotal: !line.priceTouched
        ? round2((Number(line.unitPrice) || 0) * (Number(value) || 0))
        : line.lineTotal,
    });
  };

  const addLine = () => setLines((prev) => [...prev, makeEmptyLine()]);
  const removeLine = (i) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i));

  const handleStatusChange = async (group, newStatus) => {
    await Promise.all(
      group.lines.map((l) => updateSale(l._id, { status: newStatus })),
    );
    load();
  };

  const handlePaidStatusChange = async (group, newPaidStatus) => {
    await Promise.all(
      group.lines.map((l) => updateSale(l._id, { paidStatus: newPaidStatus })),
    );
    load();
  };

  const handleDelete = async (group) => {
    const label =
      group.lines.length > 1
        ? `all ${group.lines.length} lines of this order`
        : "this order";
    if (
      !confirm(
        `Delete ${label}? This will restock inventory for anything not Returned.`,
      )
    )
      return;
    await Promise.all(group.lines.map((l) => deleteSale(l._id)));
    load();
  };

  const startEdit = (group) => {
    setEditingGroup(group);
    setOrderDiscount("");
    setOrderForm({
      orderId: baseOrderId(group.primary.orderId),
      status: group.primary.status,
      paidStatus: group.primary.paidStatus,
      deliveryPartner: group.deliveryLine?.deliveryPartner || "",
      deliveryFeeCharged:
        group.deliveryLine?.deliveryFeeCharged === null ||
        group.deliveryLine?.deliveryFeeCharged === undefined
          ? ""
          : group.deliveryLine.deliveryFeeCharged,
      deliveryCost: group.deliveryLine?.deliveryCost || "",
    });

    setLines(
      group.lines.map((l) => ({
        _id: l._id,
        product: l.product?._id || l.product || "",
        color: l.color || "",
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        priceTouched: true,
      })),
    );

    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingGroup(null);
    setOrderForm(makeEmptyOrderForm());
    setLines([makeEmptyLine()]);
    setOrderDiscount("");
  };

  const resolveOrderId = () => {
    const typed = orderForm.orderId.trim();
    if (typed) return typed;
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `A-${rand}`;
  };

  const selectPartner = (value) => {
    setOrderForm((prev) => ({ ...prev, deliveryPartner: value }));
    setDeliveryMenuOpen(false);
  };

  const addPartner = () => {
    const partner = window.prompt("Add courier partner name");
    const cleaned = partner?.trim();
    if (!cleaned) return;
    const merged = [...new Set([...deliveryPartners, cleaned])];
    setDeliveryPartners(merged);
    localStorage.setItem("zeno-delivery-partners", JSON.stringify(merged));
    setOrderForm((prev) => ({ ...prev, deliveryPartner: cleaned }));
    setDeliveryMenuOpen(false);
  };

  const deletePartner = (partnerName) => {
    if (!partnerName) return;
    const next = deliveryPartners.filter((p) => p !== partnerName);
    setDeliveryPartners(next);
    localStorage.setItem("zeno-delivery-partners", JSON.stringify(next));
    if (orderForm.deliveryPartner === partnerName) {
      setOrderForm((prev) => ({ ...prev, deliveryPartner: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const shared = {
        status: orderForm.status,
        paidStatus: orderForm.paidStatus,
        pointOfContact: orderForm.pointOfContact,
        customerPhone: orderForm.customerPhone,
        orderDate: orderForm.orderDate || todayStr(),
        notes: orderForm.notes,
        deliveryPartner: orderForm.deliveryPartner || undefined,
      };

      const discount = Number(orderDiscount) || 0;
      const target = Math.max(0, subtotal - discount);
      let allocated = 0;
      const finalLineTotals = lines.map((l, idx) => {
        const explicitValue =
          l.priceTouched ||
          (l.lineTotal !== "" &&
            l.lineTotal !== null &&
            l.lineTotal !== undefined)
            ? Number(l.lineTotal || 0)
            : null;

        if (explicitValue !== null) {
          allocated += explicitValue;
          return explicitValue;
        }

        if (idx === lines.length - 1)
          return round2(Math.max(0, target - allocated));
        const share =
          subtotal > 0 ? ((Number(l.lineTotal) || 0) / subtotal) * target : 0;
        const rounded = round2(share);
        allocated += rounded;
        return rounded;
      });

      const baseId = resolveOrderId();

      if (editingGroup) {
        const currentIds = new Set(lines.map((l) => l._id).filter(Boolean));
        const removedLines = editingGroup.lines.filter(
          (l) => !currentIds.has(l._id),
        );
        await Promise.all(removedLines.map((l) => deleteSale(l._id)));

        const linePromises = lines.map((line, i) => {
          const lineOrderId = i === 0 ? baseId : `${baseId}-line-${i + 1}`;
          const linePayload = {
            ...shared,
            orderId: lineOrderId,
            product: line.product,
            color: line.color || undefined,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            lineTotal: finalLineTotals[i],
            deliveryPartner:
              i === 0 ? orderForm.deliveryPartner || undefined : undefined,
            deliveryFeeCharged:
              i === 0
                ? orderForm.deliveryFeeCharged === ""
                  ? 0
                  : Number(orderForm.deliveryFeeCharged)
                : null,
            deliveryCost:
              i === 0
                ? orderForm.deliveryCost === ""
                  ? 0
                  : Number(orderForm.deliveryCost)
                : 0,
          };

          return line._id
            ? updateSale(line._id, linePayload)
            : createSale(linePayload);
        });

        await Promise.all(linePromises);
      } else {
        const linePromises = lines.map((line, i) => {
          const linePayload = {
            ...shared,
            orderId: i === 0 ? baseId : `${baseId}-line-${i + 1}`,
            product: line.product,
            color: line.color || undefined,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            lineTotal: finalLineTotals[i],
            deliveryPartner:
              i === 0 ? orderForm.deliveryPartner || undefined : undefined,
            deliveryFeeCharged:
              i === 0
                ? orderForm.deliveryFeeCharged === ""
                  ? 0
                  : Number(orderForm.deliveryFeeCharged)
                : null,
            deliveryCost:
              i === 0
                ? orderForm.deliveryCost === ""
                  ? 0
                  : Number(orderForm.deliveryCost)
                : 0,
          };

          return createSale(linePayload);
        });

        await Promise.all(linePromises);
      }

      cancelForm();
      setPage(1);
      load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "date",
      header: "Date",
      render: (r) => formatDate(r.primary.orderDate),
    },
    {
      key: "order",
      header: "Order ID",
      render: (r) => baseOrderId(r.primary.orderId) || "—",
    },
    {
      key: "customer",
      header: "Customer",
      render: (r) => (
        <div>
          <div className="font-medium">{r.primary.pointOfContact || "—"}</div>
          {r.primary.customerPhone && (
            <div className="text-xs text-muted">{r.primary.customerPhone}</div>
          )}
        </div>
      ),
    },
    {
      key: "product",
      header: "Products",
      render: (r) => (
        <div className="space-y-1 min-w-[160px]">
          {r.lines.map((l, idx) => (
            <div
              key={l._id || `${l.product?._id || l.product}-${idx}`}
              className="text-sm"
            >
              {l.product?.name || "Product"}
              {l.color && <span className="text-muted"> ({l.color})</span>}
              <span className="text-muted font-medium"> ×{l.quantity}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "total",
      header: "Grand Total",
      render: (r) => {
        const delivery = r.deliveryLine?.deliveryFeeCharged || 0;
        return formatMoney(r.lineTotal + delivery);
      },
    },
    {
      key: "deliveryCost",
      header: "Delivery Cost",
      render: (r) =>
        r.deliveryLine?.deliveryCost
          ? formatMoney(r.deliveryLine.deliveryCost)
          : "—",
    },
    {
      key: "notes",
      header: "Notes",
      render: (r) => (
        <span className="max-w-[200px] block truncate">
          {r.primary.notes || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <select
          value={r.primary.status}
          onChange={(e) => handleStatusChange(r, e.target.value)}
          className={`text-xs rounded-full px-2.5 py-1 border-0 font-medium cursor-pointer ${
            STATUS_TONE[r.primary.status] || "bg-paper text-muted"
          }`}
        >
          {STATUSES.map((s) => (
            <option key={s} className="bg-paper text-ink">
              {s}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "deliveryPartner",
      header: "Delivery partner",
      render: (r) => (
        <span className="font-medium">
          {r.deliveryLine?.deliveryPartner || "—"}
        </span>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      render: (r) => (
        <select
          value={r.primary.paidStatus}
          onChange={(e) => handlePaidStatusChange(r, e.target.value)}
          className={`text-xs rounded-full px-2.5 py-1 border-0 font-medium cursor-pointer ${
            PAYMENT_TONE[r.primary.paidStatus] || "bg-paper text-muted"
          }`}
        >
          {PAID_STATUSES.map((s) => (
            <option key={s} className="bg-paper text-ink">
              {s}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-2">
          <button
            onClick={() => startEdit(r)}
            className="text-muted hover:text-green-700"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleDelete(r)}
            className="text-muted hover:text-red-700"
          >
            <Trash2 size={15} />
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
            Sales orders
          </h1>
          <p className="text-sm text-muted mt-1">
            Stock is reserved as soon as an order is placed and stays deducted
            through Packed, Delivered, and Damaged — only marking an order
            Returned puts it back.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={salesExportUrl({ status })}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md border border-line text-muted hover:text-ink hover:border-moss transition-colors"
          >
            <FileDown size={15} />{" "}
            <span className="hidden sm:inline">Export</span>
          </a>
          <button
            onClick={() => {
              if (showForm) {
                cancelForm();
              } else {
                setShowForm(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="flex items-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors"
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? "Cancel" : "New order"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          onKeyDown={focusNextOnEnter}
          className="bg-card border border-line rounded-lg p-5 space-y-4 w-full"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <input
              placeholder="Order ID (optional)"
              value={orderForm.orderId}
              onChange={(e) =>
                setOrderForm({ ...orderForm, orderId: e.target.value })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <select
              value={orderForm.status}
              onChange={(e) =>
                setOrderForm({ ...orderForm, status: e.target.value })
              }
              className={`px-3 py-2 text-sm rounded-md font-medium border-0 ${
                STATUS_TONE[orderForm.status] ||
                "bg-paper text-ink border border-line"
              }`}
            >
              {STATUSES.map((s) => (
                <option key={s} className="bg-paper text-ink">
                  {s}
                </option>
              ))}
            </select>
            <select
              value={orderForm.paidStatus}
              onChange={(e) =>
                setOrderForm({ ...orderForm, paidStatus: e.target.value })
              }
              className={`px-3 py-2 text-sm rounded-md font-medium border-0 ${
                PAYMENT_TONE[orderForm.paidStatus] ||
                "bg-paper text-ink border border-line"
              }`}
            >
              {PAID_STATUSES.map((s) => (
                <option key={s} className="bg-paper text-ink">
                  {s}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={orderForm.orderDate}
              onChange={(e) =>
                setOrderForm({ ...orderForm, orderDate: e.target.value })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted">
              Products
            </p>
            {lines.map((line, i) => {
              const product = productById.get(line.product);
              const hasColors = product?.colors?.length > 0;
              const regularTotal = round2(
                (Number(line.unitPrice) || 0) * (Number(line.quantity) || 0),
              );
              const lineDiscount = Math.max(
                0,
                round2(regularTotal - (Number(line.lineTotal) || 0)),
              );
              return (
                <div
                  key={i}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-start bg-paper/60 rounded-md p-2"
                >
                  <select
                    required
                    value={line.product}
                    onChange={(e) => handleLineProductChange(i, e.target.value)}
                    className="px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-2 sm:col-span-1"
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} — {p.currentStock} in stock
                      </option>
                    ))}
                  </select>

                  {hasColors ? (
                    <select
                      value={line.color}
                      onChange={(e) => updateLine(i, { color: e.target.value })}
                      className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
                    >
                      {product.colors.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} — {c.stock} in stock
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted flex items-center">
                      {product
                        ? `${product.currentStock} in stock`
                        : "No colour"}
                    </div>
                  )}

                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) =>
                      handleLineQuantityChange(i, e.target.value)
                    }
                    className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Line total"
                      value={line.lineTotal}
                      onChange={(e) =>
                        updateLine(i, {
                          lineTotal: e.target.value,
                          priceTouched: true,
                        })
                      }
                      className="px-3 py-2 text-sm bg-paper rounded-md border border-line flex-1"
                    />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="text-muted hover:text-clay shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-4 -mt-1 flex flex-wrap gap-x-4 text-[11px] text-muted">
                    {lineDiscount > 0 && (
                      <span className="text-clay">
                        Discount: {formatMoney(lineDiscount)}
                      </span>
                    )}
                    {product &&
                      Number(line.quantity) >
                        (stockFor(product, line.color) ??
                          product.currentStock) && (
                        <span className="text-clay">
                          Only{" "}
                          {stockFor(product, line.color) ??
                            product.currentStock}{" "}
                          in stock
                          {line.color ? ` for ${line.color}` : ""} — will
                          oversell if Delivered.
                        </span>
                      )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addLine}
              className="text-xs text-moss-dark hover:underline"
            >
              + Add another product to this order
            </button>
          </div>

          {lines.length > 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-paper/60 rounded-md p-3">
              <div className="text-sm">
                <p className="text-xs text-muted">Subtotal</p>
                <p className="font-mono tabular">{formatMoney(subtotal)}</p>
              </div>
              <label className="text-xs text-muted flex flex-col gap-1">
                Order discount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={orderDiscount}
                  onChange={(e) => setOrderDiscount(e.target.value)}
                  className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
                />
              </label>
              <div className="text-sm">
                <p className="text-xs text-muted">Final product total</p>
                <p className="font-mono tabular">
                  {formatMoney(finalProductTotal)}
                </p>
              </div>
              <div className="text-sm">
                <p className="text-xs text-muted">Split across lines</p>
                <p className="text-xs text-muted">proportionally, on save</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">
              Delivery partner
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDeliveryMenuOpen((prev) => !prev)}
                  className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line text-left flex items-center justify-between"
                >
                  <span>{orderForm.deliveryPartner || "Select partner…"}</span>
                  <span className="text-xs text-muted">▾</span>
                </button>

                {deliveryMenuOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border border-line bg-paper shadow-sm max-h-64 overflow-auto">
                    <button
                      type="button"
                      onClick={addPartner}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-paper/80 border-b border-line"
                    >
                      + Add courier...
                    </button>

                    {deliveryPartners.map((partner) => (
                      <div
                        key={partner}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-line last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => selectPartner(partner)}
                          className="flex-1 text-left text-sm hover:text-moss-dark"
                        >
                          {partner}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePartner(partner);
                          }}
                          className="h-5 w-5 rounded-sm text-[11px] text-muted hover:bg-clay-light hover:text-clay"
                          aria-label={`Delete ${partner}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">
              Delivery fee charged to customer
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount customer pays"
                value={orderForm.deliveryFeeCharged}
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    deliveryFeeCharged: e.target.value,
                  })
                }
                className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
              />
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">
              Actual delivery cost
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount paid to courier"
                value={orderForm.deliveryCost}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, deliveryCost: e.target.value })
                }
                className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
              />
            </label>
            <div className="text-sm flex flex-col justify-end">
              <p className="text-xs text-muted">Grand total</p>
              <p className="font-mono tabular font-medium">
                {formatMoney(grandTotal)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <input
              placeholder="Customer name"
              value={orderForm.pointOfContact}
              onChange={(e) =>
                setOrderForm({ ...orderForm, pointOfContact: e.target.value })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <input
              placeholder="Customer phone"
              value={orderForm.customerPhone}
              onChange={(e) =>
                setOrderForm({ ...orderForm, customerPhone: e.target.value })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
            <input
              placeholder="Notes"
              value={orderForm.notes}
              onChange={(e) =>
                setOrderForm({ ...orderForm, notes: e.target.value })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-2"
            />
          </div>

          <button
            disabled={saving}
            className="bg-moss text-white text-sm rounded-md py-2 px-6 hover:bg-moss-dark disabled:opacity-50"
          >
            {saving ? "Saving…" : editingGroup ? "Update order" : "Save order"}
          </button>
        </form>
      )}

      {/* Full-width table container allowing horizontal expansion */}
      <div className="w-full overflow-x-auto min-w-full">
        <DataTable
          columns={columns}
          rows={groupedSales}
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          onRowDoubleClick={startEdit}
          searchPlaceholder="Search order ID, customer, phone, or product…"
          filters={
            <div className="flex gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
              />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
              >
                <option value="">All Status</option>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          }
          page={page}
          pages={pages}
          onPageChange={setPage}
          emptyLabel="No sales orders match your filters."
        />
      </div>
    </div>
  );
}
