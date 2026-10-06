import { formatDate, todayStr } from "./dateFmt";
import { formatMoneyText } from "./currency";

export const DEFAULT_BUSINESS_PROFILE = {
  companyName: "Zeno",
  logoUrl:
    "https://wsrv.nl/?url=https%3A%2F%2Fcdn.zalient.shop%2Fshops%2Fshop_1769109112_0a83031d20aaa650.png&w=1920&q=80&output=webp&we&default=1",
  panNo: "",
  phone: "",
  address: "",
  email: "",
  website: "",
  invoiceNote: "",
};

export function getBusinessProfile() {
  if (typeof window === "undefined") return { ...DEFAULT_BUSINESS_PROFILE };

  try {
    const raw = localStorage.getItem("zeno-business-profile");
    return { ...DEFAULT_BUSINESS_PROFILE, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_BUSINESS_PROFILE };
  }
}

export function saveBusinessProfile(profile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    "zeno-business-profile",
    JSON.stringify({ ...DEFAULT_BUSINESS_PROFILE, ...(profile || {}) }),
  );
}

// Strips sub-line suffixes
export function baseOrderId(id) {
  return (id || "").replace(/(-line-\d+|-L\d+|-line\d+)$/i, "");
}

// Invoice calculation & generation logic
export function generateInvoiceHtml(group) {
  const profile = getBusinessProfile();
  const billSource = group.lines.find((line) => line.billNo) || group.primary;
  const invoiceDate = formatDate(group.primary.orderDate || todayStr());
  const cleanOrderId = baseOrderId(group.primary.orderId) || "";

  const subtotalValue = group.lines.reduce(
    (sum, line) =>
      sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
    0,
  );

  const discountedSubtotal = group.lines.reduce(
    (sum, line) => sum + (Number(line.lineTotal) || 0),
    0,
  );

  const discountValue = Math.max(0, subtotalValue - discountedSubtotal);

  // Delivery Fee Charged to customer
  const deliveryFee = Number(group.deliveryLine?.deliveryFeeCharged) || 0;
  const deliveryPartner = group.deliveryLine?.deliveryPartner || "—";

  const grandTotalValue = Math.max(0, discountedSubtotal + deliveryFee);
  const billNo = String(billSource.billNo || "").trim();

  // Dynamic QR Code URL containing Order ID
  const qrCodeUrl = cleanOrderId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
        cleanOrderId,
      )}`
    : "";

  const rows = group.lines
    .map((line, idx) => {
      const lineAmount =
        (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);

      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${line.product?.name || "Product"}${
          line.color ? ` (${line.color})` : ""
        }</td>
        <td>${Number(line.quantity) || 0}</td>
        <td>${formatMoneyText(Number(line.unitPrice) || 0)}</td>
        <td>${formatMoneyText(lineAmount)}</td>
      </tr>`;
    })
    .join("");

  const addressLines = (profile.address || "")
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    

  return `<!DOCTYPE html>
<html>
<head>
  <title>Bill - ${cleanOrderId || "Order"}</title>

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
              ${profile.phone}
            </div>`
          : ""
      }

      ${
        profile.email
          ? `<div class="company-details">
              ${profile.email}
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

        ${
          qrCodeUrl
            ? `<td rowspan="2" style="width: 75px; text-align: center; padding: 4px;">
                <img src="${qrCodeUrl}" alt="Order QR" style="width: 65px; height: 65px; display: block; margin: 0 auto;" />
               </td>`
            : ""
        }
      </tr>

      <tr>
        <td ${qrCodeUrl ? "" : 'colspan="2"'}>
          <span class="label">Order No.:</span>
          ${cleanOrderId}
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
          ${group.primary.pointOfContact || "Walk-in Customer"}
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
}

export function printInvoice(group) {
  const printableHtml = generateInvoiceHtml(group);

  const invoiceWindow = window.open(
    "",
    "_blank",
    "width=900,height=1000",
  );

  if (!invoiceWindow) {
    alert("Please allow pop-ups to print the invoice.");
    return;
  }

  try {
    invoiceWindow.document.open();
    invoiceWindow.document.write(printableHtml);
    invoiceWindow.document.close();

    const printWhenReady = () => {
      invoiceWindow.focus();
      invoiceWindow.print();
    };

    if (invoiceWindow.document.readyState === "complete") {
      setTimeout(printWhenReady, 100);
    } else {
      invoiceWindow.onload = () => {
        setTimeout(printWhenReady, 100);
      };
    }
  } catch {
    try {
      invoiceWindow.close();
    } catch {
      // Ignore close errors
    }
    alert("Print preview was blocked. Please retry with pop-ups enabled.");
  }
}