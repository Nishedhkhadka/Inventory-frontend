import client from "./client";

export const fetchContacts = (params = {}) =>
  client.get("/contacts", { params }).then((r) => r.data);
export const fetchContact = (id) =>
  client.get(`/contacts/${id}`).then((r) => r.data);
export const createContact = (payload) =>
  client.post("/contacts", payload).then((r) => r.data);
export const updateContact = (id, payload) =>
  client.put(`/contacts/${id}`, payload).then((r) => r.data);
export const deleteContact = (id) =>
  client.delete(`/contacts/${id}`).then((r) => r.data);
