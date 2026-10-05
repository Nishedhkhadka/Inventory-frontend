import { useEffect, useState, useCallback, useMemo } from "react";

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
import { formatMoney, formatMoneyText } from "../utils/currency";
import { getBusinessProfile } from "../utils/billing";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  FileDown,
  Printer,
  Truck,
} from "lucide-react";

// Tone mappings
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

const STATUSES = [
  "In progress",
  "Packed",
  "Delivered",
  "Returned",
  "Damaged",
];

const PAID_STATUSES = ["COD", "Paid", "Unpaid"];

const round2 = (n) =>
  Math.round((Number(n) || 0) * 100) / 100;

// Strips sub-line suffixes
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

const DELIVERY_PARTNER_DEFAULTS = [
  "Upaya",
  "Pathao",
  "Indrive",
  "Yango",
  "Fabbud",
  "Self",
];

const makeEmptyOrderForm = () => ({
  orderId: "",
  billNo: "",
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

  const [orderForm, setOrderForm] = useState(
    makeEmptyOrderForm,
  );

  const [lines, setLines] = useState([
    makeEmptyLine(),
  ]);

  const [orderDiscount, setOrderDiscount] = useState("");
  const [saving, setSaving] = useState(false);

  const [deliveryPartners, setDeliveryPartners] = useState(
    DELIVERY_PARTNER_DEFAULTS,
  );

  const [deliveryMenuOpen, setDeliveryMenuOpen] =
    useState(false);

  // ---------------------------------------------------------
  // BULK SELECTION
  // ---------------------------------------------------------

  const [selectedOrders, setSelectedOrders] = useState(
    new Set(),
  );

  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // ---------------------------------------------------------
  // LOAD SALES
  // ---------------------------------------------------------

  const load = useCallback(() => {
    fetchSales({
      search,
      status,
      page,
      limit: 25,
      from: fromDate,
      to: toDate,
    }).then((res) => {
      const sorted = [...(res.data || [])].sort((a, b) => {
        const dateA = new Date(
          a.orderDate || 0,
        ).getTime();

        const dateB = new Date(
          b.orderDate || 0,
        ).getTime();

        if (dateB !== dateA) {
          return dateB - dateA;
        }

        const createdA = new Date(
          a.createdAt || 0,
        ).getTime();

        const createdB = new Date(
          b.createdAt || 0,
        ).getTime();

        return createdB - createdA;
      });

      setSales(sorted);
      setPages(res.pages || 1);
    });
  }, [
    search,
    status,
    page,
    fromDate,
    toDate,
  ]);

  useEffect(() => {
    const stored = localStorage.getItem(
      "zeno-delivery-partners",
    );

    const parsed = stored ? JSON.parse(stored) : [];

    const merged = [
      ...new Set([
        ...DELIVERY_PARTNER_DEFAULTS,
        ...parsed,
        ...sales
          .map((s) => s.deliveryPartner)
          .filter(Boolean),
      ]),
    ];

    setDeliveryPartners(merged);
  }, [sales]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openFormOnLoad) {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, [openFormOnLoad]);

  useEffect(() => {
    fetchProducts().then(setProducts);
  }, []);

  // ---------------------------------------------------------
  // PRODUCT MAP
  // ---------------------------------------------------------

  const productById = useMemo(() => {
    const map = new Map();

    products.forEach((p) => {
      map.set(p._id, p);
    });

    return map;
  }, [products]);

  const stockFor = (product, colorName) => {
    if (!product) return null;

    if (!product.colors?.length) {
      return product.currentStock;
    }

    const c = product.colors.find(
      (c) => c.name === colorName,
    );

    return c ? c.stock : null;
  };

  // ---------------------------------------------------------
  // GROUP SALES
  // ---------------------------------------------------------

  const groupedSales = useMemo(() => {
    const map = new Map();

    for (const sale of sales) {
      const key =
        baseOrderId(sale.orderId) || sale._id;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(sale);
    }

    return Array.from(map.entries())
      .map(([key, groupLines]) => {
        // The line containing the manual bill number becomes
        // the primary line for displaying the order.
        const primary =
          groupLines.find((l) => l.billNo) ||
          groupLines.find((l) => l.pointOfContact) ||
          groupLines[0];

        const deliveryLine =
          groupLines.find(
            (l) =>
              l.deliveryFeeCharged !== null &&
              l.deliveryFeeCharged !== undefined,
          ) ||
          groupLines.find((l) => l.deliveryCost) ||
          groupLines[0];

        return {
          key,
          primary,
          deliveryLine,
          lines: groupLines,

          lineTotal: groupLines.reduce(
            (sum, l) =>
              sum + (l.lineTotal || 0),
            0,
          ),

          quantity: groupLines.reduce(
            (sum, l) =>
              sum + (l.quantity || 0),
            0,
          ),
        };
      })
      .sort((a, b) => {
        const dateA = new Date(
          a.primary.orderDate || 0,
        ).getTime();

        const dateB = new Date(
          b.primary.orderDate || 0,
        ).getTime();

        if (dateB !== dateA) {
          return dateB - dateA;
        }

        const createdA = new Date(
          a.primary.createdAt || 0,
        ).getTime();

        const createdB = new Date(
          b.primary.createdAt || 0,
        ).getTime();

        return createdB - createdA;
      });
  }, [sales]);

  // ---------------------------------------------------------
  // KEEP SELECTION CLEAN
  // ---------------------------------------------------------

  useEffect(() => {
    setSelectedOrders((prev) => {
      const visibleKeys = new Set(
        groupedSales.map((group) => group.key),
      );

      const next = new Set(
        [...prev].filter((key) =>
          visibleKeys.has(key),
        ),
      );

      return next;
    });
  }, [groupedSales]);

  // ---------------------------------------------------------
  // SELECT / DESELECT ORDERS
  // ---------------------------------------------------------

  const toggleOrderSelection = (orderKey) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);

      if (next.has(orderKey)) {
        next.delete(orderKey);
      } else {
        next.add(orderKey);
      }

      return next;
    });
  };

  const allVisibleSelected =
    groupedSales.length > 0 &&
    groupedSales.every((group) =>
      selectedOrders.has(group.key),
    );

  const someVisibleSelected =
    groupedSales.some((group) =>
      selectedOrders.has(group.key),
    );

  const toggleSelectAll = () => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);

      if (allVisibleSelected) {
        groupedSales.forEach((group) => {
          next.delete(group.key);
        });
      } else {
        groupedSales.forEach((group) => {
          next.add(group.key);
        });
      }

      return next;
    });
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
    setBulkStatus("");
  };

  // ---------------------------------------------------------
  // BULK STATUS CHANGE
  // ---------------------------------------------------------

  const handleBulkStatusChange = async (
    newStatus,
  ) => {
    if (!newStatus || selectedOrders.size === 0) {
      return;
    }

    const selectedGroups = groupedSales.filter(
      (group) =>
        selectedOrders.has(group.key),
    );

    if (!selectedGroups.length) {
      return;
    }

    const selectedCount = selectedGroups.length;

    const confirmed = window.confirm(
      `Change the status of ${selectedCount} selected ${
        selectedCount === 1 ? "order" : "orders"
      } to "${newStatus}"?`,
    );

    if (!confirmed) {
      setBulkStatus("");
      return;
    }

    setBulkUpdating(true);

    try {
      const updates = selectedGroups.flatMap(
        (group) =>
          group.lines.map((line) =>
            updateSale(line._id, {
              status: newStatus,
            }),
          ),
      );

      await Promise.all(updates);

      setSelectedOrders(new Set());
      setBulkStatus("");

      await load();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          err.message ||
          "Failed to update orders.",
      );
    } finally {
      setBulkUpdating(false);
    }
  };

  // ---------------------------------------------------------
  // FORM CALCULATIONS
  // ---------------------------------------------------------

  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, l) =>
          sum + (Number(l.lineTotal) || 0),
        0,
      ),
    [lines],
  );

  const finalProductTotal = Math.max(
    0,
    round2(
      subtotal -
        (Number(orderDiscount) || 0),
    ),
  );

  const deliveryFeeNum =
    orderForm.deliveryFeeCharged === ""
      ? 0
      : Number(
          orderForm.deliveryFeeCharged,
        );

  const grandTotal = round2(
    finalProductTotal +
      deliveryFeeNum,
  );

  // ---------------------------------------------------------
  // LINE MANAGEMENT
  // ---------------------------------------------------------

  const updateLine = (i, patch) =>
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? { ...l, ...patch }
          : l,
      ),
    );

  const handleLineProductChange = (
    i,
    productId,
  ) => {
    const product =
      productById.get(productId);

    updateLine(i, {
      product: productId,

      color: product?.colors?.length
        ? product.colors[0].name
        : "",

      unitPrice: product
        ? product.retailPrice
        : "",

      lineTotal: product
        ? product.retailPrice *
          (Number(lines[i].quantity) || 1)
        : "",

      priceTouched: false,
    });
  };

  const handleLineQuantityChange = (
    i,
    value,
  ) => {
    const line = lines[i];

    updateLine(i, {
      quantity: value,

      lineTotal: !line.priceTouched
        ? round2(
            (Number(line.unitPrice) || 0) *
              (Number(value) || 0),
          )
        : line.lineTotal,
    });
  };

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      makeEmptyLine(),
    ]);

  const removeLine = (i) =>
    setLines((prev) =>
      prev.filter(
        (_, idx) => idx !== i,
      ),
    );

  // ---------------------------------------------------------
  // INDIVIDUAL STATUS
  // ---------------------------------------------------------

  const handleStatusChange = async (
    group,
    newStatus,
  ) => {
    await Promise.all(
      group.lines.map((l) =>
        updateSale(l._id, {
          status: newStatus,
        }),
      ),
    );

    load();
  };

  const handlePaidStatusChange = async (
    group,
    newPaidStatus,
  ) => {
    await Promise.all(
      group.lines.map((l) =>
        updateSale(l._id, {
          paidStatus: newPaidStatus,
        }),
      ),
    );

    load();
  };

  // ---------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------

  const handleDelete = async (group) => {
    const label =
      group.lines.length > 1
        ? `all ${group.lines.length} lines of this order`
        : "this order";

    if (
      !confirm(
        `Delete ${label}? This will restock inventory for anything not Returned.`,
      )
    ) {
      return;
    }

    await Promise.all(
      group.lines.map((l) =>
        deleteSale(l._id),
      ),
    );

    setSelectedOrders((prev) => {
      const next = new Set(prev);
      next.delete(group.key);
      return next;
    });

    load();
  };

  // ---------------------------------------------------------
  // PRINT INVOICE
  // ---------------------------------------------------------

  const printInvoice = (group) => {
    const profile = getBusinessProfile();

    const billSource =
      group.lines.find((line) => line.billNo) ||
      group.primary;

    const invoiceDate = formatDate(
      group.primary.orderDate || todayStr(),
    );

    const subtotalValue = group.lines.reduce(
      (sum, line) =>
        sum +
        (Number(line.quantity) || 0) *
          (Number(line.unitPrice) || 0),
      0,
    );

    const discountedSubtotal = group.lines.reduce(
      (sum, line) =>
        sum + (Number(line.lineTotal) || 0),
      0,
    );

    const discountValue = Math.max(
      0,
      subtotalValue - discountedSubtotal,
    );

    const deliveryFee =
      Number(
        group.deliveryLine?.deliveryFeeCharged,
      ) || 0;

    const deliveryPartner =
      group.deliveryLine?.deliveryPartner || "";

    const grandTotalValue = Math.max(
      0,
      discountedSubtotal + deliveryFee,
    );

    // Manual bill number only.
    // If there is no bill number, show a dash.
    const billNo =
      String(billSource.billNo || "").trim() ;

    const rows = group.lines
      .map((line, idx) => {
        const lineAmount =
          (Number(line.quantity) || 0) *
          (Number(line.unitPrice) || 0);

        return `
        <tr>
          <td>${idx + 1}</td>
          <td>${line.product?.name || "Product"}${
          line.color ? ` (${line.color})` : ""
        }</td>
          <td>${Number(line.quantity) || 0}</td>
          <td>${formatMoneyText(
            Number(line.unitPrice) || 0,
          )}</td>
          <td>${formatMoneyText(
            lineAmount,
          )}</td>
        </tr>`;
      })
      .join("");

    const addressLines = (profile.address || "")
      .split(/\n|,/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("<br />");

    const printableHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Bill - ${
    baseOrderId(group.primary.orderId) || "Order"
  }</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff;
      font-size: 13px;
    }

    .invoice {
      width: 100%;
      max-width: 850px;
      margin: 0 auto;
      padding: 20px;
    }

    /* HEADER */
    .header {
      text-align: center;
      border-bottom: 1px solid #000;
      padding-bottom: 10px;
    }

    .logo {
      width: 55px;
      height: 55px;
      object-fit: contain;
      margin-bottom: 5px;
    }

    .company-name {
      font-size: 22px;
      font-weight: bold;
      margin: 0;
    }

    .company-details {
      font-size: 12px;
      line-height: 1.5;
      margin-top: 3px;
    }

    .pan {
      font-size: 13px;
      font-weight: bold;
      margin-top: 4px;
    }

    .invoice-title {
      text-align: center;
      font-size: 17px;
      font-weight: bold;
      margin: 9px 0;
    }

    /* BILL INFORMATION */
    .bill-info {
      width: 100%;
      border: 1px solid #000;
      border-collapse: collapse;
      margin-bottom: 10px;
    }

    .bill-info td {
      border: 1px solid #000;
      padding: 7px 9px;
    }

    .label {
      font-weight: bold;
    }

    /* CUSTOMER */
    .customer {
      border: 1px solid #000;
      padding: 8px 10px;
      margin-bottom: 10px;
    }

    .customer-title {
      font-weight: bold;
      margin-bottom: 5px;
    }

    .customer-details {
      display: flex;
      gap: 35px;
      flex-wrap: wrap;
    }

    /* ITEMS */
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5px;
    }

    table.items th,
    table.items td {
      border: 1px solid #000;
      padding: 7px 6px;
    }

    table.items th {
      text-align: center;
      font-weight: bold;
      background: #f2f2f2;
    }

    table.items td:nth-child(1) {
      width: 45px;
      text-align: center;
    }

    table.items td:nth-child(3) {
      width: 60px;
      text-align: center;
    }

    table.items td:nth-child(4),
    table.items td:nth-child(5) {
      width: 110px;
      text-align: right;
    }

    /* TOTALS */
    .summary {
      width: 100%;
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }

    .totals {
      width: 320px;
      border: 1px solid #000;
      border-collapse: collapse;
    }

    .totals-row {
      display: flex;
      border-bottom: 1px solid #000;
    }

    .totals-row:last-child {
      border-bottom: none;
    }

    .totals-row span {
      padding: 7px 8px;
    }

    .totals-row span:first-child {
      flex: 1;
    }

    .totals-row span:last-child {
      width: 125px;
      text-align: right;
      border-left: 1px solid #000;
    }

    .grand-total {
      font-weight: bold;
      font-size: 15px;
    }

    /* NOTES */
    .notes {
      border: 1px solid #000;
      padding: 8px 10px;
      margin-top: 10px;
    }

    /* SIGNATURE */
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 55px;
    }

    .signature {
      width: 190px;
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 5px;
    }

    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 11px;
    }

    @media print {
      @page {
        size: A4;
        margin: 12mm;
      }

      body {
        margin: 0;
      }

      .invoice {
        width: 100%;
        max-width: none;
        padding: 0;
      }
    }
  </style>
</head>

<body>

  <div class="invoice">

    <!-- BUSINESS HEADER -->

    <div class="header">

      ${
        profile.logoUrl
          ? `<img
              class="logo"
              src="${profile.logoUrl}"
              alt="Logo"
            />`
          : ""
      }

      <div class="company-name">
        ${profile.companyName || "Zeno"}
      </div>

      ${
        addressLines
          ? `<div class="company-details">
              ${addressLines}
            </div>`
          : ""
      }

      ${
        profile.phone
          ? `<div class="company-details">
              Phone: ${profile.phone}
            </div>`
          : ""
      }

      ${
        profile.email
          ? `<div class="company-details">
              Email: ${profile.email}
            </div>`
          : ""
      }

      ${
        profile.website
          ? `<div class="company-details">
              ${profile.website}
            </div>`
          : ""
      }

      ${
        profile.panNo
          ? `<div class="pan">
              PAN No.: ${profile.panNo}
            </div>`
          : ""
      }

    </div>

    <div class="invoice-title">
      SALES INVOICE
    </div>


    <!-- BILL INFORMATION -->

    <table class="bill-info">
      <tr>
        <td>
          <span class="label">Bill No.:</span>
          ${billNo || ""}
        </td>

        <td>
          <span class="label">Date:</span>
          ${invoiceDate}
        </td>
      </tr>

      <tr>
        <td>
          <span class="label">Order No.:</span>
          ${baseOrderId(group.primary.orderId) || ""}
        </td>

        <td>
          ${
            deliveryPartner
              ? `<span class="label">Delivery:</span>
                 ${deliveryPartner}`
              : ""
          }
        </td>
      </tr>
    </table>


    <!-- CUSTOMER -->

    <div class="customer">

      <div class="customer-title">
        Customer Details
      </div>

      <div class="customer-details">

        <div>
          <strong>Name:</strong>
          ${
            group.primary.pointOfContact ||
            "Walk-in Customer"
          }
        </div>

        ${
          group.primary.customerPhone
            ? `<div>
                <strong>Phone:</strong>
                ${group.primary.customerPhone}
              </div>`
            : ""
        }

      </div>

    </div>


    <!-- ITEMS -->

    <table class="items">

      <thead>
        <tr>
          <th>#</th>
          <th>Particulars</th>
          <th>Qty.</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>

      <tbody>
        ${rows}
      </tbody>

    </table>


    <!-- TOTALS -->

    <div class="summary">

      <div class="totals">

        <div class="totals-row">
          <span>Subtotal</span>
          <span>
            ${formatMoneyText(subtotalValue)}
          </span>
        </div>

        ${
          discountValue
            ? `<div class="totals-row">
                <span>Discount</span>
                <span>
                  -${formatMoneyText(discountValue)}
                </span>
              </div>`
            : ""
        }

        ${
          deliveryFee
            ? `<div class="totals-row">
                <span>Delivery Charge</span>
                <span>
                  ${formatMoneyText(deliveryFee)}
                </span>
              </div>`
            : ""
        }

        <div class="totals-row grand-total">
          <span>Grand Total</span>
          <span>
            ${formatMoneyText(grandTotalValue)}
          </span>
        </div>

      </div>

    </div>


    <!-- NOTES -->

    ${
      group.primary.notes || profile.invoiceNote
        ? `<div class="notes">

            ${
              group.primary.notes
                ? `<strong>Remarks:</strong>
                   ${group.primary.notes}`
                : ""
            }

            ${
              profile.invoiceNote
                ? `<div style="margin-top: 4px;">
                    ${profile.invoiceNote}
                   </div>`
                : ""
            }

          </div>`
        : ""
    }


    <!-- SIGNATURES -->

    <div class="signatures">

      <div class="signature">
        Customer Signature
      </div>

      <div class="signature">
        For ${profile.companyName || "Zeno"}
      </div>

    </div>


    <div class="footer">
      Thank you for your business.
    </div>

  </div>

</body>
</html>`;

    const invoiceBlob = new Blob(
      [printableHtml],
      { type: "text/html" },
    );

    const invoiceUrl =
      URL.createObjectURL(invoiceBlob);

    const invoiceWindow = window.open(
      invoiceUrl,
      "_blank",
      "width=900,height=1000,noopener,noreferrer",
    );

    if (!invoiceWindow) {
      URL.revokeObjectURL(invoiceUrl);

      alert(
        "Please allow pop-ups to print the invoice.",
      );

      return;
    }

    setTimeout(() => {
      try {
        invoiceWindow.focus();
        invoiceWindow.print();
      } catch {
        alert(
          "Print preview was blocked. Please retry with pop-ups enabled.",
        );
      } finally {
        setTimeout(
          () =>
            URL.revokeObjectURL(
              invoiceUrl,
            ),
          1000,
        );
      }
    }, 250);
  };

  // ---------------------------------------------------------
  // EDIT
  // ---------------------------------------------------------

  const startEdit = (group) => {
    setEditingGroup(group);
    setOrderDiscount("");

    // Find the line that actually owns the manual bill number.
    const billSource =
      group.lines.find(
        (line) => Boolean(line.billNo),
      ) || group.primary;

    const rawDate =
      group.primary.orderDate ||
      todayStr();

    const formattedDate =
      typeof rawDate === "string" &&
      rawDate.includes("T")
        ? rawDate.split("T")[0]
        : rawDate;

    setOrderForm({
      orderId: baseOrderId(
        group.primary.orderId,
      ),

      // Load the existing manual bill number.
      billNo: billSource.billNo || "",

      status:
        group.primary.status ||
        "In progress",

      paidStatus:
        group.primary.paidStatus ||
        "COD",

      pointOfContact:
        group.primary.pointOfContact || "",

      customerPhone:
        group.primary.customerPhone || "",

      orderDate: formattedDate,

      notes:
        group.primary.notes || "",

      deliveryPartner:
        group.deliveryLine?.deliveryPartner ||
        "",

      deliveryFeeCharged:
        group.deliveryLine
          ?.deliveryFeeCharged === null ||
        group.deliveryLine
          ?.deliveryFeeCharged === undefined
          ? ""
          : group.deliveryLine
              .deliveryFeeCharged,

      deliveryCost:
        group.deliveryLine?.deliveryCost ===
          null ||
        group.deliveryLine?.deliveryCost ===
          undefined
          ? ""
          : group.deliveryLine
              .deliveryCost,
    });

    setLines(
      group.lines.map((l) => ({
        _id: l._id,
        product:
          l.product?._id ||
          l.product ||
          "",
        color: l.color || "",
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        priceTouched: true,
      })),
    );

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingGroup(null);

    setOrderForm(
      makeEmptyOrderForm(),
    );

    setLines([
      makeEmptyLine(),
    ]);

    setOrderDiscount("");
    setDeliveryMenuOpen(false);
  };

  const resolveOrderId = () => {
    const typed =
      orderForm.orderId.trim();

    if (typed) {
      return typed;
    }

    const rand =
      Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();

    return `A-${rand}`;
  };

  // ---------------------------------------------------------
  // DELIVERY PARTNERS
  // ---------------------------------------------------------

  const selectPartner = (value) => {
    setOrderForm((prev) => ({
      ...prev,
      deliveryPartner: value,
    }));

    setDeliveryMenuOpen(false);
  };

  const addPartner = () => {
    const partner = window.prompt(
      "Add courier partner name",
    );

    const cleaned =
      partner?.trim();

    if (!cleaned) return;

    const merged = [
      ...new Set([
        ...deliveryPartners,
        cleaned,
      ]),
    ];

    setDeliveryPartners(merged);

    localStorage.setItem(
      "zeno-delivery-partners",
      JSON.stringify(merged),
    );

    setOrderForm((prev) => ({
      ...prev,
      deliveryPartner: cleaned,
    }));

    setDeliveryMenuOpen(false);
  };

  const deletePartner = (
    partnerName,
  ) => {
    if (!partnerName) return;

    const next =
      deliveryPartners.filter(
        (p) => p !== partnerName,
      );

    setDeliveryPartners(next);

    localStorage.setItem(
      "zeno-delivery-partners",
      JSON.stringify(next),
    );

    if (
      orderForm.deliveryPartner ===
      partnerName
    ) {
      setOrderForm((prev) => ({
        ...prev,
        deliveryPartner: "",
      }));
    }
  };

  // ---------------------------------------------------------
  // SAVE ORDER
  // ---------------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);

    try {
      /*
       * IMPORTANT:
       * billNo is NOT included in this shared object.
       *
       * This prevents the same bill number from being
       * automatically copied to every product line.
       */

      const shared = {
        status:
          orderForm.status,

        paidStatus:
          orderForm.paidStatus,

        pointOfContact:
          orderForm.pointOfContact,

        customerPhone:
          orderForm.customerPhone,

        orderDate:
          orderForm.orderDate ||
          todayStr(),

        notes:
          orderForm.notes,

        deliveryPartner:
          orderForm.deliveryPartner ||
          undefined,
      };

      /*
       * Manual bill number.
       *
       * Empty = null.
       * Non-empty = exactly what the user typed.
       *
       * No automatic BILL number is generated.
       */
      const manualBillNo =
        (orderForm.billNo || "").trim() ||
        null;

      const discount =
        Number(orderDiscount) || 0;

      const target = Math.max(
        0,
        subtotal - discount,
      );

      let allocated = 0;

      const finalLineTotals =
        lines.map((l, idx) => {
          const explicitValue =
            l.priceTouched ||
            (l.lineTotal !== "" &&
              l.lineTotal !== null &&
              l.lineTotal !== undefined)
              ? Number(
                  l.lineTotal || 0,
                )
              : null;

          if (
            explicitValue !== null
          ) {
            allocated +=
              explicitValue;

            return explicitValue;
          }

          if (
            idx ===
            lines.length - 1
          ) {
            return round2(
              Math.max(
                0,
                target -
                  allocated,
              ),
            );
          }

          const share =
            subtotal > 0
              ? ((Number(
                  l.lineTotal,
                ) || 0) /
                  subtotal) *
                target
              : 0;

          const rounded =
            round2(share);

          allocated += rounded;

          return rounded;
        });

      const baseId =
        resolveOrderId();

      // -----------------------------------------------------
      // EDITING EXISTING ORDER
      // -----------------------------------------------------

     if (editingGroup) {
  const currentIds = new Set(
    lines
      .map((l) => l._id)
      .filter(Boolean),
  );

  // Delete lines that were removed from the editor.
  const removedLines = editingGroup.lines.filter(
    (l) => !currentIds.has(l._id),
  );

  await Promise.all(
    removedLines.map((l) => deleteSale(l._id)),
  );

  /*
   * IMPORTANT:
   *
   * Preserve the existing orderId of every existing line.
   *
   * Example:
   *
   * A-JSL1
   * A-JSL1-line-2
   * A-JSL1-line-3
   *
   * Editing must NOT regenerate these IDs based on
   * array position because the database order is not
   * guaranteed to match the editor's position.
   */

  const existingOrderIds = new Set(
    editingGroup.lines
      .map((line) => line.orderId)
      .filter(Boolean),
  );

  /*
   * Find the existing line that owns the base order ID.
   */
  const baseLine = editingGroup.lines.find(
    (line) =>
      line.orderId === baseId,
  );

  /*
   * Find the line that owns the manual bill number.
   */
  const existingBillLine =
    editingGroup.lines.find(
      (line) => Boolean(line.billNo),
    );

  const existingBillId =
    existingBillLine?._id || null;

  const existingBillStillPresent =
    existingBillId &&
    lines.some(
      (line) =>
        line._id === existingBillId,
    );

  /*
   * Preserve the original bill owner if it still exists.
   * Otherwise the first remaining line gets the bill.
   */
  const billOwnerId =
    existingBillStillPresent
      ? existingBillId
      : null;

  /*
   * Find the next available line number for NEW lines.
   */
  let nextLineNumber = 2;

  while (
    existingOrderIds.has(
      `${baseId}-line-${nextLineNumber}`,
    )
  ) {
    nextLineNumber++;
  }

  const linePromises = lines.map(
    (line, i) => {
      /*
       * EXISTING LINE
       *
       * Always preserve its current database orderId.
       */
      let lineOrderId;

      if (line._id) {
        const originalLine =
          editingGroup.lines.find(
            (oldLine) =>
              oldLine._id === line._id,
          );

        lineOrderId =
          originalLine?.orderId ||
          (i === 0
            ? baseId
            : `${baseId}-line-${i + 1}`);
      }

      /*
       * NEW LINE
       *
       * Give it a new unique suffix.
       */
      else {
        lineOrderId =
          i === 0 && !baseLine
            ? baseId
            : `${baseId}-line-${nextLineNumber}`;

        nextLineNumber++;

        while (
          existingOrderIds.has(lineOrderId)
        ) {
          lineOrderId =
            `${baseId}-line-${nextLineNumber}`;

          nextLineNumber++;
        }
      }

      /*
       * Determine bill ownership.
       */
      const isBillOwner =
        billOwnerId
          ? line._id === billOwnerId
          : !existingBillId && i === 0;

      const linePayload = {
        ...shared,

        billNo: isBillOwner
          ? manualBillNo
          : null,

        /*
         * CRITICAL:
         * Existing lines retain their original orderId.
         */
        orderId: lineOrderId,

        product:
          line.product,

        color:
          line.color ||
          undefined,

        quantity:
          Number(line.quantity),

        unitPrice:
          Number(line.unitPrice),

        lineTotal:
          finalLineTotals[i],

        deliveryPartner:
          i === 0
            ? orderForm.deliveryPartner ||
              undefined
            : undefined,

        deliveryFeeCharged:
          i === 0
            ? orderForm.deliveryFeeCharged === ""
              ? 0
              : Number(
                  orderForm.deliveryFeeCharged,
                )
            : null,

        deliveryCost:
          i === 0
            ? orderForm.deliveryCost === ""
              ? 0
              : Number(
                  orderForm.deliveryCost,
                )
            : 0,
      };

      return line._id
        ? updateSale(
            line._id,
            linePayload,
          )
        : createSale(
            linePayload,
          );
    },
  );

  await Promise.all(linePromises);
}

      // -----------------------------------------------------
      // CREATE NEW ORDER
      // -----------------------------------------------------

      else {
        const linePromises =
          lines.map((line, i) => {
            const linePayload = {
              ...shared,

              /*
               * NEW ORDER:
               * first line owns the manual bill number.
               * all other lines have no bill number.
               */
              billNo:
                i === 0
                  ? manualBillNo
                  : null,

              orderId:
                i === 0
                  ? baseId
                  : `${baseId}-line-${i + 1}`,

              product:
                line.product,

              color:
                line.color ||
                undefined,

              quantity:
                Number(
                  line.quantity,
                ),

              unitPrice:
                Number(
                  line.unitPrice,
                ),

              lineTotal:
                finalLineTotals[i],

              deliveryPartner:
                i === 0
                  ? orderForm.deliveryPartner ||
                    undefined
                  : undefined,

              deliveryFeeCharged:
                i === 0
                  ? orderForm.deliveryFeeCharged ===
                    ""
                    ? 0
                    : Number(
                        orderForm.deliveryFeeCharged,
                      )
                  : null,

              deliveryCost:
                i === 0
                  ? orderForm.deliveryCost ===
                    ""
                    ? 0
                    : Number(
                        orderForm.deliveryCost,
                      )
                  : 0,
            };

            return createSale(
              linePayload,
            );
          });

        await Promise.all(
          linePromises,
        );
      }

      cancelForm();

      setPage(1);

      await load();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          err.message,
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------
  // TABLE COLUMNS
  // ---------------------------------------------------------

  const columns = [
    // -------------------------------------------------------
    // CHECKBOX
    // -------------------------------------------------------

    {
      key: "select",

      header: (
        <input
          type="checkbox"
          checked={allVisibleSelected}
          ref={(el) => {
            if (el) {
              el.indeterminate =
                someVisibleSelected &&
                !allVisibleSelected;
            }
          }}
          onChange={toggleSelectAll}
          onClick={(e) =>
            e.stopPropagation()
          }
          aria-label="Select all orders"
          className="h-4 w-4 cursor-pointer accent-current"
        />
      ),

      render: (r) => (
        <input
          type="checkbox"
          checked={selectedOrders.has(
            r.key,
          )}
          onChange={() =>
            toggleOrderSelection(
              r.key,
            )
          }
          onClick={(e) =>
            e.stopPropagation()
          }
          aria-label={`Select order ${
            baseOrderId(
              r.primary.orderId,
            ) || ""
          }`}
          className="h-4 w-4 cursor-pointer accent-current"
        />
      ),
    },

    // -------------------------------------------------------
    // DATE
    // -------------------------------------------------------

    {
      key: "date",

      header: "Date",

      render: (r) => {
        const rawDate =
          r.primary.orderDate ||
          r.primary.createdAt;

        const formattedDate = rawDate
          ? new Date(
              rawDate,
            ).toLocaleDateString(
              "en-US",
              {
                month: "short",
                day: "numeric",
              },
            )
          : "—";

        return (
          <div className="font-semibold min-w-[5px] max-w-[150px] text-sm text-gray-700">
            {formattedDate}
          </div>
        );
      },
    },

    // -------------------------------------------------------
    // ORDER + CUSTOMER
    // -------------------------------------------------------

    {
      key: "orderCustomer",

      header: "Order / Customer",

      render: (r) => (
        <div className="min-w-[180px] max-w-[230px]">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-normal text-sm text-gray-600">
              {baseOrderId(
                r.primary.orderId,
              ) || "—"}
            </span>

            {r.primary.billNo && (
              <span className="text-[10px] text-gray-500 border-gray-700 border rounded-full px-2 py-0.6 font-medium">
                {r.primary.billNo}
              </span>
            )}
          </div>

          <div className="font-semibold text-gray-900 truncate">
            {r.primary.pointOfContact ||
              "Walk-in customer"}
          </div>

          {r.primary.customerPhone && (
            <div className="text-xs text-gray-500 truncate">
              {r.primary.customerPhone}
            </div>
          )}
        </div>
      ),
    },

    // -------------------------------------------------------
    // PRODUCTS
    // -------------------------------------------------------

    {
      key: "product",

      header: "Products",

      render: (r) => (
        <div className="min-w-[180px] max-w-[240px] space-y-0.5">
          {r.lines.map((l, idx) => (
            <div
              key={
                l._id ||
                `${l.product?._id || l.product}-${idx}`
              }
              className="text-sm truncate"
              title={`${
                l.product?.name ||
                "Product"
              }${
                l.color
                  ? ` (${l.color})`
                  : ""
              } ×${l.quantity}`}
            >
              <span className="font-medium">
                {l.product?.name ||
                  "Product"}
              </span>

              {l.color && (
                <span className="text-muted">
                  {" "}
                  ({l.color})
                </span>
              )}

              <span className="text-muted font-medium">
                {" "}
                ×{l.quantity}
              </span>
            </div>
          ))}

          {r.lines.length > 1 && (
            <div className="text-[10px] text-muted">
              {r.lines.length} products
            </div>
          )}
        </div>
      ),
    },

    // -------------------------------------------------------
    // GRAND TOTAL
    // -------------------------------------------------------

    {
      key: "total",

      header: "Total",

      render: (r) => {
        const delivery =
          r.deliveryLine
            ?.deliveryFeeCharged || 0;

        return (
          <div className="whitespace-nowrap">
            <div className="font-semibold">
              {formatMoney(
                r.lineTotal +
                  delivery,
              )}
            </div>

            {delivery > 0 && (
              <div className="inline-flex items-center gap-1 text-[10px] text-muted">
                <Truck className="w-3 h-3 text-muted shrink-0" />
                <span>
                  {delivery}
                </span>
              </div>
            )}
          </div>
        );
      },
    },

    // -------------------------------------------------------
    // STATUS
    // -------------------------------------------------------

    {
      key: "status",

      header: "Status",

      render: (r) => (
        <select
          value={r.primary.status}
          onChange={(e) =>
            handleStatusChange(
              r,
              e.target.value,
            )
          }
          onClick={(e) =>
            e.stopPropagation()
          }
          className={`text-xs rounded-full px-2.5 py-1.5 border-0 font-medium cursor-pointer whitespace-nowrap ${
            STATUS_TONE[
              r.primary.status
            ] ||
            "bg-paper text-muted"
          }`}
        >
          {STATUSES.map((s) => (
            <option
              key={s}
              className="bg-paper text-ink"
            >
              {s}
            </option>
          ))}
        </select>
      ),
    },

    // -------------------------------------------------------
    // PAYMENT
    // -------------------------------------------------------

    {
      key: "payment",

      header: "Payment",

      render: (r) => (
        <select
          value={
            r.primary.paidStatus
          }
          onChange={(e) =>
            handlePaidStatusChange(
              r,
              e.target.value,
            )
          }
          onClick={(e) =>
            e.stopPropagation()
          }
          className={`text-xs rounded-full px-2.5 py-1.5 border-0 font-medium cursor-pointer whitespace-nowrap ${
            PAYMENT_TONE[
              r.primary.paidStatus
            ] ||
            "bg-paper text-muted"
          }`}
        >
          {PAID_STATUSES.map((s) => (
            <option
              key={s}
              className="bg-paper text-ink"
            >
              {s}
            </option>
          ))}
        </select>
      ),
    },

    // -------------------------------------------------------
    // DELIVERY
    // -------------------------------------------------------

    {
      key: "delivery",

      header: "Delivery",

      render: (r) => {
        const partner =
          r.deliveryLine
            ?.deliveryPartner;

        const cost =
          r.deliveryLine
            ?.deliveryCost;

        return (
          <div className="min-w-[90px]">
            <div className="font-medium">
              {partner || "—"}
            </div>

            {cost ? (
              <div className="text-[10px] text-muted">
                <Truck className="w-3 h-3 text-muted shrink-0 inline-block mr-1" />
                {cost}
              </div>
            ) : null}
          </div>
        );
      },
    },

    // -------------------------------------------------------
    // NOTES
    // -------------------------------------------------------

    {
      key: "notes",

      header: "Notes",

      render: (r) => (
        <span
          className="block max-w-[160px] truncate text-xs text-muted"
          title={
            r.primary.notes || ""
          }
        >
          {r.primary.notes || "—"}
        </span>
      ),
    },

    // -------------------------------------------------------
    // ACTIONS
    // -------------------------------------------------------

    {
      key: "actions",

      header: "",

      render: (r) => (
        <div className="flex gap-2 whitespace-nowrap">
          <button
            onClick={(e) => {
              e.stopPropagation();
              printInvoice(r);
            }}
            className="text-muted hover:text-ink"
            title="Print invoice"
          >
            <Printer size={15} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              startEdit(r);
            }}
            className="text-muted hover:text-green-700"
            title="Edit order"
          >
            <Pencil size={15} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r);
            }}
            className="text-muted hover:text-red-700"
            title="Delete order"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------

  return (
    <div className="space-y-6 px-2 sm:px-4 lg:px-6">

      {/* ---------------------------------------------------
          HEADER
      --------------------------------------------------- */}

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
            href={salesExportUrl({
              status,
            })}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md border border-line text-muted hover:text-ink hover:border-moss transition-colors"
          >
            <FileDown size={15} />

            <span className="hidden sm:inline">
              Export
            </span>
          </a>

          <button
            onClick={() => {
              if (showForm) {
                cancelForm();
              } else {
                setShowForm(true);

                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
              }
            }}
            className="flex items-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors"
          >
            {showForm ? (
              <X size={15} />
            ) : (
              <Plus size={15} />
            )}

            {showForm
              ? "Cancel"
              : "New order"}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------
          ORDER FORM
      --------------------------------------------------- */}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          onKeyDown={
            focusNextOnEnter
          }
          className="bg-card border border-line rounded-lg p-5 space-y-4 w-full"
        >

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">

            <input
              placeholder="Order ID (optional)"
              value={
                orderForm.orderId
              }
              onChange={(e) =>
                setOrderForm({
                  ...orderForm,
                  orderId:
                    e.target.value,
                })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />

            <input
              placeholder="Bill no"
              value={
                orderForm.billNo
              }
              onChange={(e) =>
                setOrderForm({
                  ...orderForm,
                  billNo:
                    e.target.value,
                })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />

            <select
              value={
                orderForm.status
              }
              onChange={(e) =>
                setOrderForm({
                  ...orderForm,
                  status:
                    e.target.value,
                })
              }
              className={`px-3 py-2 text-sm rounded-md font-medium border-0 ${
                STATUS_TONE[
                  orderForm.status
                ] ||
                "bg-paper text-ink border border-line"
              }`}
            >
              {STATUSES.map(
                (s) => (
                  <option
                    key={s}
                    className="bg-paper text-ink"
                  >
                    {s}
                  </option>
                ),
              )}
            </select>

            <select
              value={
                orderForm.paidStatus
              }
              onChange={(e) =>
                setOrderForm({
                  ...orderForm,
                  paidStatus:
                    e.target.value,
                })
              }
              className={`px-3 py-2 text-sm rounded-md font-medium border-0 ${
                PAYMENT_TONE[
                  orderForm.paidStatus
                ] ||
                "bg-paper text-ink border border-line"
              }`}
            >
              {PAID_STATUSES.map(
                (s) => (
                  <option
                    key={s}
                    className="bg-paper text-ink"
                  >
                    {s}
                  </option>
                ),
              )}
            </select>

            <input
              type="date"
              value={
                orderForm.orderDate
              }
              onChange={(e) =>
                setOrderForm({
                  ...orderForm,
                  orderDate:
                    e.target.value,
                })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />
          </div>

          {/* PRODUCTS */}

          <div className="space-y-2">

            <p className="text-xs uppercase tracking-wide text-muted">
              Products
            </p>

            {lines.map(
              (line, i) => {
                const product =
                  productById.get(
                    line.product,
                  );

                const hasColors =
                  product?.colors
                    ?.length > 0;

                const regularTotal =
                  round2(
                    (Number(
                      line.unitPrice,
                    ) || 0) *
                      (Number(
                        line.quantity,
                      ) || 0),
                  );

                const lineDiscount =
                  Math.max(
                    0,
                    round2(
                      regularTotal -
                        (Number(
                          line.lineTotal,
                        ) || 0),
                    ),
                  );

                return (
                  <div
                    key={i}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-start bg-paper/60 rounded-md p-2"
                  >

                    <select
                      required
                      value={
                        line.product
                      }
                      onChange={(e) =>
                        handleLineProductChange(
                          i,
                          e.target
                            .value,
                        )
                      }
                      className="px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-2 sm:col-span-1"
                    >
                      <option value="">
                        Select product…
                      </option>

                      {products.map(
                        (p) => (
                          <option
                            key={
                              p._id
                            }
                            value={
                              p._id
                            }
                          >
                            {p.name} —{" "}
                            {
                              p.currentStock
                            }{" "}
                            in stock
                          </option>
                        ),
                      )}
                    </select>

                    {hasColors ? (
                      <select
                        value={
                          line.color
                        }
                        onChange={(e) =>
                          updateLine(
                            i,
                            {
                              color:
                                e
                                  .target
                                  .value,
                            },
                          )
                        }
                        className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
                      >
                        {product.colors.map(
                          (c) => (
                            <option
                              key={
                                c.name
                              }
                              value={
                                c.name
                              }
                            >
                              {
                                c.name
                              }{" "}
                              —{" "}
                              {
                                c.stock
                              }{" "}
                              in stock
                            </option>
                          ),
                        )}
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
                      value={
                        line.quantity
                      }
                      onChange={(e) =>
                        handleLineQuantityChange(
                          i,
                          e.target
                            .value,
                        )
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
                        value={
                          line.lineTotal
                        }
                        onChange={(e) =>
                          updateLine(
                            i,
                            {
                              lineTotal:
                                e
                                  .target
                                  .value,

                              priceTouched:
                                true,
                            },
                          )
                        }
                        className="px-3 py-2 text-sm bg-paper rounded-md border border-line flex-1"
                      />

                      {lines.length >
                        1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeLine(
                              i,
                            )
                          }
                          className="text-muted hover:text-clay shrink-0"
                        >
                          <Trash2
                            size={14}
                          />
                        </button>
                      )}
                    </div>

                    <div className="col-span-2 sm:col-span-4 -mt-1 flex flex-wrap gap-x-4 text-[11px] text-muted">

                      {lineDiscount >
                        0 && (
                        <span className="text-clay">
                          Discount:{" "}
                          {formatMoney(
                            lineDiscount,
                          )}
                        </span>
                      )}

                      {product &&
                        Number(
                          line.quantity,
                        ) >
                          (stockFor(
                            product,
                            line.color,
                          ) ??
                            product.currentStock) && (
                          <span className="text-clay">
                            Only{" "}
                            {stockFor(
                              product,
                              line.color,
                            ) ??
                              product.currentStock}{" "}
                            in stock
                            {line.color
                              ? ` for ${line.color}`
                              : ""}{" "}
                            — will oversell if Delivered.
                          </span>
                        )}
                    </div>
                  </div>
                );
              },
            )}

            <button
              type="button"
              onClick={addLine}
              className="text-xs text-moss-dark hover:underline"
            >
              + Add another product to this order
            </button>
          </div>

          {/* MULTI PRODUCT TOTAL */}

          {lines.length > 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-paper/60 rounded-md p-3">

              <div className="text-sm">
                <p className="text-xs text-muted">
                  Subtotal
                </p>

                <p className="font-mono tabular">
                  {formatMoney(
                    subtotal,
                  )}
                </p>
              </div>

              <label className="text-xs text-muted flex flex-col gap-1">
                Order discount

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={
                    orderDiscount
                  }
                  onChange={(e) =>
                    setOrderDiscount(
                      e.target.value,
                    )
                  }
                  className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
                />
              </label>

              <div className="text-sm">
                <p className="text-xs text-muted">
                  Final product total
                </p>

                <p className="font-mono tabular">
                  {formatMoney(
                    finalProductTotal,
                  )}
                </p>
              </div>

              <div className="text-sm">
                <p className="text-xs text-muted">
                  Split across lines
                </p>

                <p className="text-xs text-muted">
                  proportionally, on save
                </p>
              </div>
            </div>
          )}

          {/* DELIVERY */}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">

            <label className="text-xs text-muted flex flex-col gap-1">
              Delivery partner

              <div className="relative">

                <button
                  type="button"
                  onClick={() =>
                    setDeliveryMenuOpen(
                      (prev) =>
                        !prev,
                    )
                  }
                  className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line text-left flex items-center justify-between"
                >
                  <span>
                    {orderForm.deliveryPartner ||
                      "Select partner…"}
                  </span>

                  <span className="text-xs text-muted">
                    ▾
                  </span>
                </button>

                {deliveryMenuOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border border-line bg-paper shadow-sm max-h-64 overflow-auto">

                    <button
                      type="button"
                      onClick={
                        addPartner
                      }
                      className="w-full px-3 py-2 text-left text-sm hover:bg-paper/80 border-b border-line"
                    >
                      + Add courier...
                    </button>

                    {deliveryPartners.map(
                      (partner) => (
                        <div
                          key={
                            partner
                          }
                          className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-line last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              selectPartner(
                                partner,
                              )
                            }
                            className="flex-1 text-left text-sm hover:text-moss-dark"
                          >
                            {
                              partner
                            }
                          </button>

                          <button
                            type="button"
                            onClick={(
                              e,
                            ) => {
                              e.stopPropagation();

                              deletePartner(
                                partner,
                              );
                            }}
                            className="h-5 w-5 rounded-sm text-[11px] text-muted hover:bg-clay-light hover:text-clay"
                            aria-label={`Delete ${partner}`}
                          >
                            ×
                          </button>
                        </div>
                      ),
                    )}
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
                value={
                  orderForm.deliveryFeeCharged
                }
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    deliveryFeeCharged:
                      e.target.value,
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
                value={
                  orderForm.deliveryCost
                }
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    deliveryCost:
                      e.target.value,
                  })
                }
                className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
              />
            </label>

            <div className="text-sm flex flex-col justify-end">
              <p className="text-xs text-muted">
                Grand total
              </p>

              <p className="font-mono tabular font-medium">
                {formatMoney(
                  grandTotal,
                )}
              </p>
            </div>
          </div>

          {/* CUSTOMER */}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">

            <input
              placeholder="Customer name"
              value={
                orderForm.pointOfContact
              }
              onChange={(e) =>
                setOrderForm({
                  ...orderForm,
                  pointOfContact:
                    e.target.value,
                })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />

            <input
              placeholder="Customer phone"
              value={
                orderForm.customerPhone
              }
              onChange={(e) =>
                setOrderForm({
                  ...orderForm,
                  customerPhone:
                    e.target.value,
                })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line"
            />

            <input
              placeholder="Notes"
              value={
                orderForm.notes
              }
              onChange={(e) =>
                setOrderForm({
                  ...orderForm,
                  notes:
                    e.target.value,
                })
              }
              className="px-3 py-2 text-sm bg-paper rounded-md border border-line col-span-1 sm:col-span-2"
            />
          </div>

          <button
            disabled={saving}
            className="bg-moss text-white text-sm rounded-md py-2 px-6 hover:bg-moss-dark disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : editingGroup
                ? "Update order"
                : "Save order"}
          </button>
        </form>
      )}

      {/* ---------------------------------------------------
          SALES TABLE
      --------------------------------------------------- */}

      <div className="w-full overflow-x-auto min-w-full">

        <DataTable
          columns={columns}
          rows={groupedSales}

          searchValue={search}

          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}

          onRowDoubleClick={
            startEdit
          }

          searchPlaceholder="Search order ID, customer, phone, or product…"

          filters={
            <div className="flex flex-wrap gap-2 items-center">

              {/* -----------------------------------------
                  BULK STATUS CONTROLS
              ----------------------------------------- */}

              {selectedOrders.size >
                0 && (
                <div className="flex items-center gap-2 mr-1">

                  <span className="text-xs text-muted whitespace-nowrap">
                    {selectedOrders.size}{" "}
                    selected
                  </span>

                  <select
                    value={
                      bulkStatus
                    }
                    onChange={(
                      e,
                    ) => {
                      const value =
                        e.target
                          .value;

                      setBulkStatus(
                        value,
                      );

                      if (value) {
                        handleBulkStatusChange(
                          value,
                        );
                      }
                    }}
                    disabled={
                      bulkUpdating
                    }
                    className="text-sm bg-paper rounded-md border border-line px-3 py-1.5 font-medium disabled:opacity-50"
                  >
                    <option value="">
                      {bulkUpdating
                        ? "Updating…"
                        : "Change status…"}
                    </option>

                    {STATUSES.map(
                      (s) => (
                        <option
                          key={s}
                          value={s}
                        >
                          {s}
                        </option>
                      ),
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={
                      clearSelection
                    }
                    disabled={
                      bulkUpdating
                    }
                    className="text-xs text-muted hover:text-ink disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* -----------------------------------------
                  DATE FILTERS
              ----------------------------------------- */}

              <input
                type="date"
                value={
                  fromDate
                }
                onChange={(e) => {
                  setFromDate(
                    e.target.value,
                  );
                  setPage(1);
                }}
                className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
              />

              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(
                    e.target.value,
                  );
                  setPage(1);
                }}
                className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
              />

              {/* -----------------------------------------
                  STATUS FILTER
              ----------------------------------------- */}

              <select
                value={status}
                onChange={(e) => {
                  setStatus(
                    e.target.value,
                  );
                  setPage(1);
                }}
                className="text-sm bg-paper rounded-md border border-line px-3 py-1.5"
              >
                <option value="">
                  All Status
                </option>

                {STATUSES.map(
                  (s) => (
                    <option
                      key={s}
                    >
                      {s}
                    </option>
                  ),
                )}
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