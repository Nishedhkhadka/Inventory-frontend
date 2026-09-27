import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { fetchPendingPackaging } from "../api/packaging";
import { fetchProducts } from "../api/products";
import { fetchSummary } from "../api/analytics";
import { formatMoney } from "../utils/currency";
import { groupPendingPackages } from "../utils/packaging";

// Refreshed on mount and every 60s — cheap enough (a few small fetches) to
// poll rather than needing a push mechanism; this is a header glance, not
// a live dashboard number.
const REFRESH_MS = 60000;
// If there's more than one insight, cycle through them so the header stays
// a single short line instead of getting crowded.
const ROTATE_MS = 5000;


function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function StatusPulse() {
  const [insights, setInsights] = useState([]);
  const [attention, setAttention] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      const today = todayStr();
      Promise.all([
        fetchPendingPackaging(),
        fetchProducts({ lowStockOnly: true }),
        fetchSummary({ from: today, to: today }),
      ])
        .then(([pending, lowStock, todaySummary]) => {
          if (cancelled) return;

          const pendingPackages = groupPendingPackages(pending);
          const items = [];
          if (pendingPackages.length > 0) {
            items.push({
              text: `${pendingPackages.length} package${pendingPackages.length === 1 ? "" : "s"} waiting to be packed`,
              urgent: true,
            });
          }
          if (lowStock.length > 0) {
            items.push({
              text: `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} running low on stock`,
              urgent: true,
            });
          }
          if (todaySummary?.totalDeliveredRevenue > 0) {
            items.push({
              text: `${formatMoney(todaySummary.totalDeliveredRevenue)} delivered today`,
              urgent: false,
            });
          }
          if (items.length === 0) {
            items.push({ text: "All caught up — nothing urgent right now", urgent: false });
          }

          setInsights(items);
          setAttention(items.some((i) => i.urgent));
          setIndex(0);
        })
        .catch(() => {
          // A header glance shouldn't ever show an error state — just stay quiet.
          if (!cancelled) setInsights([]);
        });
    };

    load();
    const refreshTimer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    if (insights.length < 2) return;
    const rotateTimer = setInterval(() => {
      setIndex((i) => (i + 1) % insights.length);
    }, ROTATE_MS);
    return () => clearInterval(rotateTimer);
  }, [insights.length]);

  if (insights.length === 0) return null;
  const current = insights[index];

  return (
    <span
      className={`hidden md:flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 truncate transition-colors ${
        attention
          ? "border-amber/30 bg-amber-light text-amber"
          : "border-moss/20 bg-moss-light text-moss-dark"
      }`}
    >
      <Sparkles size={11} className="shrink-0" />
      {current.text}
    </span>
  );
}
