import client from "./client";

export const fetchPurchases = (params) => client.get("/purchases", { params }).then((r) => r.data);
export const fetchPurchase = (id) => client.get(`/purchases/${id}`).then((r) => r.data);
export const createPurchase = (payload) => client.post("/purchases", payload).then((r) => r.data);
export const updatePurchase = (id, payload) =>
  client.put(`/purchases/${id}`, payload).then((r) => r.data);
export const deletePurchase = (id) => client.delete(`/purchases/${id}`).then((r) => r.data);
export const fetchPurchaseTags = () => client.get("/purchases/tags").then((r) => r.data);
export const fetchPurchaseCategories = () => client.get("/purchases/categories").then((r) => r.data);

export const purchasesExportUrl = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString();
  return `/purchases/export${query ? `?${query}` : ""}`;
};
