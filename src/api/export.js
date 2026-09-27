export const productsExportUrl = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString();
  return `/products/export${query ? `?${query}` : ""}`;
};

// One workbook, three sheets (Sales, Expenses, Inventory) — from/to scope
// the Sales/Expenses sheets, Inventory is always the current snapshot.
export const exportAllUrl = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString();
  return `/export/all${query ? `?${query}` : ""}`;
};
