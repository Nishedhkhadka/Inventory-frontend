import client from "./client";

export const fetchPendingPackaging = () => client.get("/packaging/pending").then((r) => r.data);

// multipart/form-data upload of the package photo — returns OCR text plus
// ranked candidate order matches. Doesn't change any order yet.
export const verifyPackagePhoto = (file) => {
  const formData = new FormData();
  formData.append("photo", file);
  return client
    .post("/packaging/verify", formData, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};

// Confirms a match: moves the chosen order to Packed and records the photo
// + OCR result against it.
export const confirmPackaging = (payload) =>
  client.post("/packaging/confirm", payload).then((r) => r.data);
