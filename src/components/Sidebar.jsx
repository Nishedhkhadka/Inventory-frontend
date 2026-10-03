import {
  LayoutGrid,
  Receipt,
  Package,
  Wallet,
  UploadCloud,
  PackageCheck,
  Users as UsersIcon,
  Building2,
  LogOut,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_BUSINESS_PROFILE, getBusinessProfile } from "../utils/billing";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "sales", label: "Sales orders", icon: Receipt },
  { key: "packaging", label: "Packaging", icon: PackageCheck },
  { key: "expenses", label: "Expenses", icon: Wallet },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "contacts", label: "Contacts", icon: Building2 },
  { key: "import", label: "Import data", icon: UploadCloud },
];

// On desktop (md+) this sits statically in the flex row. On mobile it's a
// fixed off-canvas drawer that slides in from the left, with a dimmed
// backdrop behind it (rendered by App.jsx) to close on outside-tap.
export default function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
  isAdmin,
  username,
  onLogout,
}) {
  const [profile, setProfile] = useState(DEFAULT_BUSINESS_PROFILE);

  useEffect(() => {
    setProfile(getBusinessProfile());
  }, []);

  const items = isAdmin
    ? [...NAV_ITEMS, { key: "users", label: "Users", icon: UsersIcon }]
    : NAV_ITEMS;

  return (
    <aside
      className={`w-60 shrink-0 border-r border-line bg-card flex flex-col fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="px-6 py-7 flex items-center justify-between">
        <div>
          <p className="font-display text-2xl tracking-tight text-ink">Zeno</p>
          <p className="text-xs text-muted mt-0.5 tracking-wide uppercase">
            Ledger
          </p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden text-muted hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => {
                onNavigate(key);
                onClose?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm mb-1 transition-colors ${
                isActive
                  ? "bg-moss-light text-moss-dark font-medium"
                  : "text-muted hover:bg-paper hover:text-ink"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="px-6 py-5 border-t border-line space-y-3">
        {username && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-ink truncate">{username}</p>
              <p className="text-xs text-muted capitalize">
                {isAdmin ? "admin" : "user"}
              </p>
            </div>
            <img
              src={profile.logoUrl || DEFAULT_BUSINESS_PROFILE.logoUrl}
              alt="Business logo"
              className="w-8 h-8 inline-block rounded-md object-cover border border-line"
            />
            <button
              onClick={onLogout}
              className="text-muted hover:text-clay shrink-0"
              title="Log out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}

        <p className="text-xs text-muted leading-relaxed">
          Simply Minimal . Simply Modern .
        </p>
      </div>
    </aside>
  );
}
