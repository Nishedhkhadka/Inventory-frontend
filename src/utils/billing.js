export const DEFAULT_BUSINESS_PROFILE = {
  companyName: "Zeno",
  logoUrl:
    "https://wsrv.nl/?url=https%3A%2F%2Fcdn.zalient.shop%2Fshops%2Fshop_1769109112_0a83031d20aaa650.png&w=1920&q=80&output=webp&we&default=1",
  phone: "",
  panNo: "",
  address: "",
  email: "",
  website: "",
  invoiceNote: "Thank you for your business.",
};

export function getBusinessProfile() {
  if (typeof window === "undefined") return { ...DEFAULT_BUSINESS_PROFILE };

  try {
    const raw = localStorage.getItem("zeno-business-profile");
    return { ...DEFAULT_BUSINESS_PROFILE, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_BUSINESS_PROFILE };
  }
}

export function saveBusinessProfile(profile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    "zeno-business-profile",
    JSON.stringify({ ...DEFAULT_BUSINESS_PROFILE, ...(profile || {}) }),
  );
}
