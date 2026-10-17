import client from "./client";

export const fetchLocations = () =>
  client.get("/locations").then((r) => r.data);

export const createLocation = (payload) =>
  client.post("/locations", payload).then((r) => r.data);

export const updateLocation = (id, payload) =>
  client.put(`/locations/${id}`, payload).then((r) => r.data);

export const deleteLocation = (id) =>
  client.delete(`/locations/${id}`).then((r) => r.data);

export const transferStock = (payload) =>
  client.post("/transfers", payload).then((r) => r.data);

export const fetchTransfers = (productId) =>
  client.get(`/transfers/${productId}`).then((r) => r.data);