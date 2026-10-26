import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { fetchPendingPackaging } from "../api/packaging";
import { fetchProducts } from "../api/products";
import { fetchSummary } from "../api/analytics";
import { fetchSales } from "../api/sales";
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

function startOfWeekStr() {
  const date = new Date();
  const day = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

function startOfMonthStr() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export default function StatusPulse({ onNavigate }) {
  const [insights, setInsights] = useState([]);
  const [attention, setAttention] = useState(false);
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      const today = todayStr();
      const thisWeekFrom = startOfWeekStr();
      const thisMonthFrom = startOfMonthStr();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

      Promise.all([
        fetchPendingPackaging(),
        fetchProducts({ lowStockOnly: true }),
        fetchProducts({}),
        fetchSummary({ from: thisWeekFrom, to: today }),
        fetchSummary({ from: thisMonthFrom, to: today }),
        fetchSummary({ from: thirtyDaysAgoStr, to: today }),
        fetchSales({ status: "Returned", from: thisMonthFrom, to: today }),
        fetchSales({ status: "Transit" }),
      ])
        .then(
          ([
            pending,
            lowStock,
            allProducts,
            thisWeekSummary,
            thisMonthSummary,
            thirtyDaySummary,
            returnedSales,
            transitSales,
          ]) => {
            if (cancelled) return;

            const pendingPackages = groupPendingPackages(pending);
            const topWeekProduct = thisWeekSummary?.productPerformance?.[0];
            const topMonthProduct = thisMonthSummary?.productPerformance?.[0];
            const returnedThisMonth =
              returnedSales?.total ?? returnedSales?.data?.length ?? 0;
            const items = [];

            if (pendingPackages.length > 0) {
              items.push({
                text: `${pendingPackages.length} package${pendingPackages.length === 1 ? "" : "s"} waiting to be packed`,
                urgent: true,
                target: "packaging",
              });
            }

            // Orders still in transit for 7+ days check
            const transitList = transitSales?.data || transitSales || [];
            const now = new Date();
            const staleTransitCount = transitList.filter((sale) => {
              const orderDateVal = sale.orderDate || sale.createdAt;
              if (!orderDateVal) return false;
              const diffTime = now - new Date(orderDateVal);
              const diffDays = diffTime / (1000 * 60 * 60 * 24);
              return diffDays >= 7;
            }).length;

            if (staleTransitCount > 0) {
              items.push({
                text: `${staleTransitCount} order${staleTransitCount === 1 ? "" : "s"} still in transit since 7+ days`,
                urgent: true,
                target: "sales",
              });
            }

            if (lowStock.length > 0) {
              items.push({
                text: `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} running low on stock`,
                urgent: true,
                target: "inventory",
              });
            }

            // Days of Inventory Remaining (Fast Movers) check
            if (topWeekProduct && topWeekProduct.unitsSold > 0) {
              const matchedProd = (allProducts || []).find(
                (p) => p._id === topWeekProduct.productId || p.name === topWeekProduct.name
              );
              if (matchedProd) {
                const currentStock = Number(matchedProd.currentStock) || 0;
                const dailyVelocity = (Number(topWeekProduct.unitsSold) || 0) / 7;
                if (dailyVelocity > 0) {
                  const daysRemaining = Math.round(currentStock / dailyVelocity);
                  if (daysRemaining <= 10 && daysRemaining >= 0) {
                    items.push({
                      text: `Fast mover alert: ${topWeekProduct.name} has ~${daysRemaining} day${daysRemaining === 1 ? "" : "s"} of stock left`,
                      urgent: true,
                      target: "inventory",
                    });
                  }
                }
              }
            }

            // Dead Stock / Slow-Moving Item Alert (Only active stock items with >0 stock that haven't sold in 30 days)
            const soldProductIds = new Set(
              (thirtyDaySummary?.productPerformance || []).map((p) => p.productId || p.name)
            );
            const slowMovers = (allProducts || []).filter(
              (p) => (Number(p.currentStock) || 0) > 0 && !soldProductIds.has(p._id) && !soldProductIds.has(p.name)
            );
            if (slowMovers.length > 0) {
              items.push({
                text: `${slowMovers.length} slow-moving item${slowMovers.length === 1 ? "" : "s"} with zero sales in 30 days`,
                urgent: false,
                target: "inventory",
              });
            }

            if (topWeekProduct?.name) {
              items.push({
                text: `Top sales this week: ${topWeekProduct.name} (${topWeekProduct.unitsSold ?? 0} sold)`,
                urgent: false,
                target: "sales",
              });
            }
            if (topMonthProduct?.name) {
              items.push({
                text: `Top sales this month: ${topMonthProduct.name} (${topMonthProduct.unitsSold ?? 0} sold)`,
                urgent: false,
                target: "sales",
              });
            }
            if (returnedThisMonth > 0) {
              items.push({
                text: `${returnedThisMonth} returned ${returnedThisMonth === 1 ? "product" : "products"} this month`,
                urgent: false,
                target: "sales",
              });
            }
            if (items.length === 0) {
              items.push({
                text: "All caught up — nothing urgent right now",
                urgent: false,
                target: null,
              });
            }

            setInsights(items);
            setAttention(items.some((i) => i.urgent));
            setIndex(0);
          },
        )
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
      setAnimating(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % insights.length);
        setAnimating(false);
      }, 250); // duration of smooth crossfade
    }, ROTATE_MS);
    return () => clearInterval(rotateTimer);
  }, [insights.length]);

  if (insights.length === 0) return null;
  const current = insights[index];

  const handleClick = () => {
    if (current?.target && onNavigate) {
      onNavigate(current.target);
    }
  };

  return (
    <>
      <style>{`
        @keyframes oneWayScroll {
          0%, 20% { transform: translateX(0); }
          80%, 100% { transform: translateX(calc(-100% + 150px)); }
        }
        @media (max-width: 767px) {
          .mobile-scroll-text {
            display: inline-block;
            white-space: nowrap;
            animation: oneWayScroll 8s ease-in-out infinite alternate;
          }
          .mobile-scroll-container {
            overflow: hidden;
            display: inline-block;
            max-width: 160px;
          }
        }
        .apple-transition {
          transition: opacity 0.25s ease-in-out;
        }
      `}</style>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-1.5 text-xs rounded-full border px-3 py-1 transition-all font-medium shadow-sm cursor-pointer hover:opacity-80 ${
          attention
            ? " bg-amber-50 text-amber-700 border-amber-200"
            : "border-emerald-500 bg-emerald-50 text-emerald-900"
        }`}
        title="Click to view details"
      >
        <Sparkles size={11} className="shrink-0 mb-0.5" />
        <span className="mobile-scroll-container md:max-w-none md:overflow-visible md:truncate">
          <span
            className={`mobile-scroll-text md:animate-none md:whitespace-normal md:truncate inline-block apple-transition ${
              animating ? "opacity-0" : "opacity-100"
            }`}
          >
            {current.text}
          </span>
        </span>
      </button>
    </>
  );
}