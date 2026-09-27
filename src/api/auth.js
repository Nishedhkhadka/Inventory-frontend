import client from "./client";

export const login = (username, password) =>
  client.post("/auth/login", { username, password }).then((r) => r.data);

export const fetchMe = () => client.get("/auth/me").then((r) => r.data);

export const fetchUsers = () => client.get("/auth/users").then((r) => r.data);

export const createUser = (payload) => client.post("/auth/users", payload).then((r) => r.data);

export const deleteUser = (id) => client.delete(`/auth/users/${id}`).then((r) => r.data);

export const resetUserPassword = (id, password) =>
  client.put(`/auth/users/${id}/password`, { password }).then((r) => r.data);
