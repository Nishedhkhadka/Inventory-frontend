import client from "./client";

export const fetchSummary = (params) => client.get("/analytics/summary", { params }).then((r) => r.data);
export const fetchPnL = (params) => client.get("/analytics/pnl", { params }).then((r) => r.data);

// Path (not a full URL) for the authenticated download helper in
// utils/download.js — plain <a href> can't carry the auth token our API
// now requires.
export const pnlExportUrl = (params, format) => {
  const query = new URLSearchParams({ ...params, format }).toString();
  return `/analytics/pnl/export?${query}`;
};
