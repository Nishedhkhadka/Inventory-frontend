import { Calendar } from "lucide-react";

const PRESETS = [
  { key: "all", label: "All time" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
];

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  return new Date(date.setDate(diff));
}

/** Turns a preset key into a concrete { from, to } ISO date-string range. */
export function presetToRange(preset) {
  const now = new Date();
  if (preset === "all") return { from: "", to: "" };
  if (preset === "week") {
    return { from: toISODate(startOfWeek(now)), to: toISODate(now) };
  }
  if (preset === "month") {
    return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISODate(now) };
  }
  if (preset === "year") {
    return { from: toISODate(new Date(now.getFullYear(), 0, 1)), to: toISODate(now) };
  }
  return null; // custom — caller keeps whatever from/to is already set
}

function toISODate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export default function DateRangeFilter({ preset, range, onPresetChange, onRangeChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center bg-card border border-line rounded-md p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPresetChange(p.key)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              preset === p.key ? "bg-moss text-white font-medium" : "text-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-1.5 bg-card border border-line rounded-md px-2.5 py-1.5">
          <Calendar size={13} className="text-muted" />
          <input
            type="date"
            value={range.from}
            onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
            className="text-xs bg-transparent focus:outline-none"
          />
          <span className="text-muted text-xs">→</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
            className="text-xs bg-transparent focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
