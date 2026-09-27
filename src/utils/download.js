import client from "../api/client";

// Plain <a href="/api/..."> downloads don't carry the Authorization
// header our API now requires on every route — only axios requests do,
// via the interceptor in api/client.js. This fetches the file through
// that authenticated client as a blob, then triggers the browser's normal
// save behavior via a temporary object URL.
export async function downloadFile(path, filename) {
  const res = await client.get(path, { responseType: "blob" });

  // Prefer the filename the server actually sent (Content-Disposition),
  // falling back to the caller's guess.
  const disposition = res.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const finalName = match?.[1] || filename;

  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
