import client from "./client";

export const fetchProducts = (params) =>
  client.get("/products", { params }).then((r) => r.data);
export const fetchProduct = (id) =>
  client.get(`/products/${id}`).then((r) => r.data);
export const createProduct = (payload) =>
  client.post("/products", payload).then((r) => r.data);
export const updateProduct = (id, payload) =>
  client.put(`/products/${id}`, payload).then((r) => r.data);
export const deleteProduct = (id) =>
  client.delete(`/products/${id}`).then((r) => r.data);
export const fetchProductTypes = () =>
  client.get("/products/types").then((r) => r.data);
export const createProductType = (payload) =>
  client.post("/products/types", payload).then((r) => r.data);
export const updateProductType = (oldName, payload) =>
  client
    .put(`/products/types/${encodeURIComponent(oldName)}`, payload)
    .then((r) => r.data);
export const deleteProductType = (typeName) =>
  client
    .delete(`/products/types/${encodeURIComponent(typeName)}`)
    .then((r) => r.data);
export const fetchStockLog = (id) =>
  client.get(`/products/${id}/stock-log`).then((r) => r.data);
