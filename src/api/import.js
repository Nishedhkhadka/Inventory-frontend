import client from "./client";

// multipart/form-data upload — axios sets the right Content-Type boundary
// automatically as long as we don't override it ourselves.
export const importWorkbook = (file, { reset = false } = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("reset", String(reset));
  return client
    .post("/import", formData, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};

// Targeted fix for sales whose delivery cost (paid to the courier) is
// missing or wrong — matches by Order ID and patches only deliveryCost.
export const backfillDeliveryCosts = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return client
    .post("/import/backfill-delivery-costs", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

// Targeted fix for purchases imported before Approved/Dispatched sheet
// statuses were recognized — matches by Order column and corrects only
// the status label (not stock — see resyncStockFromSheet for that).
export const backfillPurchaseStatuses = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return client
    .post("/import/backfill-purchase-statuses", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

// The direct fix for stock counts thrown off by the historical
// double-deduction bug — overwrites currentStock from the Inventory
// sheet's Stock column.
export const resyncStockFromSheet = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return client
    .post("/import/resync-stock", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};
