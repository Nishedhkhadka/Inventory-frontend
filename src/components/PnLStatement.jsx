import { FileDown, FileText } from "lucide-react";
import { pnlExportUrl } from "../api/analytics";
import { formatMoney } from "../utils/currency";
import { downloadFile } from "../utils/download";

const pct = (n) => `${n.toFixed(1)}%`;

export default function PnLStatement({
  pnl,
  loading,
  rangeParams,
  masked = false,
}) {
  if (loading) {
    return (
      <div className="bg-card border border-line rounded-lg px-5 py-4">
        <p className="text-sm text-muted">Generating P&L statement…</p>
      </div>
    );
  }
  if (!pnl) return null;

  return (
    <div className="bg-card border border-line rounded-lg overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
        <div>
          <p className="font-display text-lg text-ink">
            Profit &amp; Loss statement
          </p>
          <p className="text-xs text-muted mt-0.5">
            Revenue less cost of goods sold, less operating expenses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              downloadFile(pnlExportUrl(rangeParams, "xlsx"), "zeno-pnl.xlsx")
            }
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-line text-muted hover:text-ink hover:border-moss transition-colors"
          >
            <FileDown size={13} /> XLSX
          </button>
          <button
            onClick={() =>
              downloadFile(pnlExportUrl(rangeParams, "pdf"), "zeno-pnl.pdf")
            }
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-line text-muted hover:text-ink hover:border-moss transition-colors"
          >
            <FileText size={13} /> PDF
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-1 font-mono text-sm tabular">
        <Line label="Revenue" value={pnl.revenue} masked={masked} />
        <Line label="Cost of goods sold" value={-pnl.cogs} masked={masked} />
        <Line
          label="Gross profit"
          value={pnl.grossProfit}
          bold
          tone={pnl.grossProfit >= 0 ? "moss" : "clay"}
          masked={masked}
        />
        <Line
          label="Gross margin"
          value={pct(pnl.grossMarginPct)}
          isText
          masked={masked}
        />

        <div className="pt-3 mt-2 border-t border-line">
          <p className="text-xs uppercase tracking-wide text-muted mb-1.5">
            Operating expenses
          </p>
          {pnl.operatingExpenseBreakdown.length === 0 ? (
            <p className="text-xs text-muted font-sans">
              No operating expenses logged in this range.
            </p>
          ) : (
            pnl.operatingExpenseBreakdown.map((e) => (
              <Line
                key={e.category}
                label={`  ${e.category}`}
                value={-e.total}
                muted
                masked={masked}
              />
            ))
          )}
          <Line
            label="Total operating expenses"
            value={-pnl.operatingExpenses}
            masked={masked}
          />
        </div>

        <div className="pt-3 mt-2 border-t border-line">
          <Line
            label="Delivery fees collected"
            value={pnl.deliveryFeesCollected}
            muted
            masked={masked}
          />
          <Line
            label="Delivery cost (paid to courier)"
            value={-pnl.deliveryCost}
            muted
            masked={masked}
          />
          {pnl.ordersWithUnknownDeliveryFee > 0 && (
            <p className="text-[11px] text-muted font-sans pt-1">
              {pnl.ordersWithUnknownDeliveryFee} delivered order(s) have no
              recorded customer delivery fee (historical data) — not counted as
              $0 above.
            </p>
          )}
        </div>

        <div className="pt-3 mt-2 border-t border-line">
          <Line
            label="Net profit"
            value={pnl.netProfit}
            bold
            size="lg"
            tone={pnl.netProfit >= 0 ? "moss" : "clay"}
            masked={masked}
          />
          <Line
            label="Net margin"
            value={pct(pnl.netMarginPct)}
            isText
            masked={masked}
          />
        </div>

        <p className="pt-3 mt-2 border-t border-line text-[11px] text-muted font-sans leading-relaxed">
          Inventory purchased in this range (
          {masked ? "••••••" : formatMoney(pnl.inventoryCapitalized)}) is
          capitalized — it's expensed as COGS only once those units actually
          sell, so it isn't counted above.
        </p>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  isText,
  bold,
  muted,
  size,
  tone,
  masked = false,
}) {
  const toneClass =
    tone === "moss"
      ? "text-moss-dark"
      : tone === "clay"
        ? "text-clay"
        : "text-ink";
  const displayValue = masked ? "••••••" : isText ? value : formatMoney(value);

  return (
    <div className="flex items-center justify-between py-0.5">
      <span
        className={`font-sans ${muted ? "text-muted" : "text-ink"} ${bold ? "font-medium" : ""}`}
      >
        {label}
      </span>
      <span
        className={`${bold ? toneClass + " font-semibold" : muted ? "text-muted" : "text-ink"} ${
          size === "lg" ? "text-base" : ""
        }`}
      >
        {displayValue}
      </span>
    </div>
  );
}
