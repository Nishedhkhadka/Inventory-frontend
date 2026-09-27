import { useEffect, useState, useCallback } from "react";
import { Plus, FileDown, PackageCheck, AlertTriangle, Receipt } from "lucide-react";
import { fetchSummary, fetchPnL } from "../api/analytics";
import { exportAllUrl } from "../api/export";
import { fetchPendingPackaging } from "../api/packaging";
import { fetchProducts } from "../api/products";
import { fetchSales } from "../api/sales";
import KPICard from "../components/KPICard";
import RevenueChart from "../components/RevenueChart";
import TopProductsChart from "../components/TopProductsChart";
import ExpenseDonut from "../components/ExpenseDonut";
import DateRangeFilter, { presetToRange } from "../components/DateRangeFilter";
import PnLStatement from "../components/PnLStatement";
import { formatMoney } from "../utils/currency";
import { downloadFile } from "../utils/download";
import { groupPendingPackages } from "../utils/packaging";
import { useAuth } from "../context/AuthContext";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Regular users never see revenue/expense/profit figures — just the
// operational facts they need day to day. Built entirely from endpoints
// that don't require admin (packaging + inventory + sales counts), so
// there's no risk of a stray fetch to the financial endpoints leaking an
// error state onto their screen.
function SimpleDashboard({ onNavigate }) {
  const [pendingCount, setPendingCount] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(null);
  const [todayOrders, setTodayOrders] = useState(null);

  useEffect(() => {
    const today = todayStr();
    fetchPendingPackaging().then((rows) => {
      const packageGroups = groupPendingPackages(rows);
      setPendingCount(packageGroups.length);
    });
    fetchProducts({ lowStockOnly: true }).then((rows) => setLowStockCount(rows.length));
    fetchSales({ from: today, to: today, limit: 1 }).then((res) => setTodayOrders(res.total ?? 0));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-ink">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Today at a glance.</p>
        </div>
        <button
          onClick={() => onNavigate?.("sales", null, { openForm: true })}
          className="flex items-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors shrink-0"
        >
          <Plus size={15} /> New sale
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate?.("sales")}
          className="bg-card border border-line rounded-lg px-5 py-4 text-left hover:border-moss transition-colors"
        >
          <Receipt size={18} className="text-muted mb-2" />
          <p className="text-2xl font-mono tabular text-ink">{todayOrders ?? "—"}</p>
          <p className="text-xs text-muted mt-1">Orders placed today</p>
        </button>
        <button
          onClick={() => onNavigate?.("packaging")}
          className="bg-card border border-line rounded-lg px-5 py-4 text-left hover:border-moss transition-colors"
        >
          <PackageCheck size={18} className="text-muted mb-2" />
          <p className="text-2xl font-mono tabular text-ink">{pendingCount ?? "—"}</p>
          <p className="text-xs text-muted mt-1">Packages waiting to be packed</p>
        </button>
        <button
          onClick={() => onNavigate?.("inventory")}
          className="bg-card border border-line rounded-lg px-5 py-4 text-left hover:border-moss transition-colors"
        >
          <AlertTriangle size={18} className="text-muted mb-2" />
          <p className="text-2xl font-mono tabular text-ink">{lowStockCount ?? "—"}</p>
          <p className="text-xs text-muted mt-1">Items running low on stock</p>
        </button>
      </div>
    </div>
  );
}

function AdminDashboard({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pnlLoading, setPnlLoading] = useState(true);
  const [error, setError] = useState(null);

  const [preset, setPreset] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });

  const handlePresetChange = (key) => {
    setPreset(key);
    const r = presetToRange(key);
    if (r) setRange(r);
  };

  const params = preset === "all" ? {} : { from: range.from || undefined, to: range.to || undefined };

  const load = useCallback(() => {
    setLoading(true);
    setPnlLoading(true);
    fetchSummary(params)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    fetchPnL(params)
      .then(setPnl)
      .finally(() => setPnlLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-ink">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Real-time snapshot of Zeno's books.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeFilter
            preset={preset}
            range={range}
            onPresetChange={handlePresetChange}
            onRangeChange={setRange}
          />
          <button
            onClick={() => onNavigate?.("sales", null, { openForm: true })}
            className="flex items-center gap-1.5 bg-ink text-paper text-sm px-4 py-2 rounded-md hover:bg-moss-dark transition-colors shrink-0"
          >
            <Plus size={15} /> New sale
          </button>
          <button
            onClick={() => downloadFile(exportAllUrl(params), "zeno-full-export.xlsx")}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md border border-line text-muted hover:text-ink hover:border-moss transition-colors shrink-0"
          >
            <FileDown size={15} /> Export all
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Loading ledger…</p>}
      {error && <p className="text-sm text-clay">Couldn't load analytics: {error}</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Delivered revenue" value={summary.totalDeliveredRevenue} tone="moss" />
            <KPICard label="Total expenses" value={summary.totalExpenses} tone="clay" />
            <KPICard
              label="Net cash flow"
              value={summary.netCashFlow}
              tone={summary.netCashFlow >= 0 ? "moss" : "clay"}
            />
            <KPICard label="Warehouse valuation" value={summary.warehouseAssetValuation} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RevenueChart data={summary.monthlyRevenue} />
            </div>
            <ExpenseDonut data={summary.expenseBreakdown} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopProductsChart data={summary.productPerformance} />

            <div className="bg-card border border-line rounded-lg px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-muted mb-3">Product performance</p>
              <div className="space-y-0">
                {summary.productPerformance.length === 0 ? (
                  <p className="text-sm text-muted py-6 text-center">No delivered sales yet.</p>
                ) : (
                  summary.productPerformance.map((p) => (
                    <div
                      key={p.productId}
                      className="flex items-center justify-between py-2 ledger-rule last:border-0"
                    >
                      <div>
                        <p className="text-sm text-ink">{p.name}</p>
                        <p className="text-xs text-muted">{p.unitsSold} units sold</p>
                      </div>
                      <p className="font-mono text-sm tabular text-ink">{formatMoney(p.revenue)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <PnLStatement pnl={pnl} loading={pnlLoading} rangeParams={params} />
        </>
      )}
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard onNavigate={onNavigate} /> : <SimpleDashboard onNavigate={onNavigate} />;
}
