import { Search, Plus, Menu } from "lucide-react";
import StatusPulse from "./StatusPulse";

const TITLES = {
  dashboard: "",
  sales: "",
  packaging: "",
  expenses: "",
  inventory: "",
  contacts: "",
  import: "",
  users: "",
};

export default function Header({ view, onNavigate, onOpenSearch, onOpenMenu }) {
  return (
    <div className="flex items-center justify-between mb-6 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenMenu}
          className="md:hidden text-muted hover:text-ink shrink-0 -ml-1 p-1"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <p className="text-xs text-muted uppercase tracking-wide truncate">{TITLES[view] || ""}</p>
        <StatusPulse />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 text-sm text-muted bg-card border border-line rounded-md px-2.5 sm:px-3 py-1.5 hover:border-moss hover:text-ink transition-colors"
        >
          <Search size={14} />
          <span className="hidden lg:inline">Search everything…</span>
          <kbd className="hidden lg:inline text-[10px] bg-paper border border-line rounded px-1.5 py-0.5 ml-1">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={() => onNavigate("sales", null, { openForm: true })}
          className="flex items-center gap-1.5 bg-ink text-paper text-sm px-3 py-1.5 rounded-md hover:bg-moss-dark transition-colors"
        >
          <Plus size={14} /> <span className="hidden sm:inline">New sale</span>
        </button>
      </div>
    </div>
  );
}
