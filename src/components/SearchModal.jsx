import { useEffect, useRef, useState } from "react";
import { Search, X, Package, Receipt, ShoppingBag, Users } from "lucide-react";
import { search } from "../api/search";
import { formatMoney } from "../utils/currency";

/**
 * A Cmd/Ctrl+K search palette. Fans a query out across products, sales,
 * expenses (purchases), and contacts, letting the user jump straight
 * to the matching record's page.
 */
export default function SearchModal({ open, onClose, onNavigate }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState({
    products: [],
    sales: [],
    purchases: [],
    contacts: [],
  });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults({ products: [], sales: [], purchases: [], contacts: [] });
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !q.trim()) {
      setResults({ products: [], sales: [], purchases: [], contacts: [] });
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      search(q.trim())
        .then((res) =>
          setResults({
            products: res.products || [],
            sales: res.sales || [],
            purchases: res.purchases || [],
            contacts: res.contacts || [],
          })
        )
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(handle);
  }, [q, open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = (view, term) => {
    onNavigate(view, term);
    onClose();
  };

  const hasAny =
    results.products.length ||
    results.sales.length ||
    results.purchases.length ||
    results.contacts.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-ink/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-line rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Search size={16} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, orders, bills, expenses, contacts…"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {!q.trim() && (
            <p className="px-4 py-6 text-sm text-muted text-center">
              Start typing to search across inventory, sales, bills, expenses, and contacts.
            </p>
          )}
          {q.trim() && !loading && !hasAny && (
            <p className="px-4 py-6 text-sm text-muted text-center">
              No matches for "{q}".
            </p>
          )}

          {results.products.length > 0 && (
            <ResultGroup label="Products" icon={Package}>
              {results.products.map((p) => (
                <ResultRow
                  key={p._id}
                  title={p.name}
                  subtitle={`${p.sku || "No SKU"} · ${p.currentStock} in stock`}
                  trailing={formatMoney(p.retailPrice)}
                  onClick={() => go("inventory", p.name)}
                />
              ))}
            </ResultGroup>
          )}

          {results.sales.length > 0 && (
            <ResultGroup label="Sales orders" icon={Receipt}>
              {results.sales.map((s) => {
                const titleText = s.pointOfContact
                  ? `${s.orderId} — ${s.pointOfContact}`
                  : s.orderId;

                const billBadge = s.billNo ? `Bill #${s.billNo}` : null;
                const subtitleText = [
                  billBadge,
                  s.product?.name || "—",
                  s.status,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <ResultRow
                    key={s._id}
                    title={titleText}
                    subtitle={subtitleText}
                    trailing={formatMoney(s.grandTotal ?? s.lineTotal)}
                    onClick={() => go("sales", s.billNo || q.trim())}
                  />
                );
              })}
            </ResultGroup>
          )}

          {results.purchases.length > 0 && (
            <ResultGroup label="Expenses" icon={ShoppingBag}>
              {results.purchases.map((p) => (
                <ResultRow
                  key={p._id}
                  title={p.productName}
                  subtitle={`${p.supplier || p.category} · ${p.status}${
                    p.tags?.length ? ` · ${p.tags.join(", ")}` : ""
                  }`}
                  trailing={formatMoney(p.cost)}
                  onClick={() => go("expenses", q.trim())}
                />
              ))}
            </ResultGroup>
          )}

          {results.contacts.length > 0 && (
            <ResultGroup label="Contacts & Suppliers" icon={Users}>
              {results.contacts.map((c) => {
                const contactDetails = [c.phone, c.email].filter(Boolean).join(" · ");

                return (
                  <ResultRow
                    key={c._id}
                    title={c.name}
                    subtitle={contactDetails || "No contact info"}
                    onClick={() => go("contacts", c.name)}
                  />
                );
              })}
            </ResultGroup>
          )}
        </div>

        <div className="px-4 py-2 border-t border-line text-[11px] text-muted flex items-center justify-between">
          <span>Enter a search term to jump straight to a record</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ label, icon: Icon, children }) {
  return (
    <div className="py-1">
      <p className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted flex items-center gap-1.5">
        <Icon size={11} /> {label}
      </p>
      {children}
    </div>
  );
}

function ResultRow({ title, subtitle, trailing, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-paper transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm text-ink truncate">{title}</p>
        <p className="text-xs text-muted truncate">{subtitle}</p>
      </div>
      {trailing && (
        <span className="font-mono text-xs tabular text-muted shrink-0 ml-3">
          {trailing}
        </span>
      )}
    </button>
  );
}