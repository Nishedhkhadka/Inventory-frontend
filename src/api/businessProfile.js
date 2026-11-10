import client from "./client";

export const fetchBusinessProfile = () => client.get("/business-profile").then((r) => r.data);
export const saveBusinessProfileApi = (payload) => client.put("/business-profile", payload).then((r) => r.data);