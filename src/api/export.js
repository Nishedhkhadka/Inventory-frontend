export const productsExportUrl = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v)),
  ).toString();
  return `/products/export${query ? `?${query}` : ""}`;
};

// One workbook, four sheets (Sales, Expenses, Inventory, Suppliers & contacts)
// — from/to scope applies to Sales/Expenses, Inventory is the current snapshot,
// and Suppliers & contacts is the manual directory.
export const exportAllUrl = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v)),
  ).toString();
  return `/export/all${query ? `?${query}` : ""}`;
};
