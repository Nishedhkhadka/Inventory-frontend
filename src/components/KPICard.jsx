import { formatMoney } from "../utils/currency";

export default function KPICard({
  label,
  value,
  tone = "ink",
  suffix,
  masked = false,
}) {
  const toneClass =
    tone === "moss"
      ? "text-moss-dark"
      : tone === "clay"
        ? "text-clay"
        : "text-ink";

  const displayValue = masked
    ? "••••••"
    : typeof value === "number"
      ? formatMoney(value)
      : value;

  return (
    <div className="bg-card border border-line rounded-lg px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted mb-2">{label}</p>
      <p className={`font-mono text-2xl tabular ${toneClass}`}>
        {displayValue}
        {suffix && <span className="text-sm text-muted ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
