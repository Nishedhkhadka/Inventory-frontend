import client from "./client";

export async function fetchCourierStatus(orderId) {
  const res = await client.get(`/pickndrop/status/${orderId}`);
  return res.data;
}
