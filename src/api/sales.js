import client from "./client";

export const fetchSales = (params) => client.get("/sales", { params }).then((r) => r.data);
export const fetchSale = (id) => client.get(`/sales/${id}`).then((r) => r.data);
export const createSale = (payload) => client.post("/sales", payload).then((r) => r.data);
export const updateSale = (id, payload) => client.put(`/sales/${id}`, payload).then((r) => r.data);
export const deleteSale = (id) => client.delete(`/sales/${id}`).then((r) => r.data);

export const salesExportUrl = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString();
  return `/sales/export${query ? `?${query}` : ""}`;
};
