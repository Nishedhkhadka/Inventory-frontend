import client from "./client";

export const search = (q) => client.get("/search", { params: { q } }).then((r) => r.data);
