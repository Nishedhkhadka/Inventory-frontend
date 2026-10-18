import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatMoney } from "../utils/currency";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const formatYAxisTick = (v) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return v;
};

export default function RevenueChart({ data = [] }) {
  const chartData = data.map((d) => {
    let label = d.label || "";

    if (!label) {
      if (d.dayName) {
        label = d.dayName;
      } else if (d.date) {
        const parsedDate = new Date(d.date);
        label = !isNaN(parsedDate)
          ? parsedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          : d.date;
      } else if (d.year && d.month && d.day) {
        const parsedDate = new Date(d.year, d.month - 1, d.day);
        label = parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else if (d.month && d.year) {
        label = `${MONTH_LABELS[d.month - 1]} '${String(d.year).slice(2)}`;
      } else if (d.year) {
        label = String(d.year);
      } else {
        label = "Period";
      }
    }

    return {
      label,
      revenue: d.revenue || 0,
    };
  });

  return (
    <div className="bg-card border border-line rounded-lg px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted mb-4">
        Revenue trajectory
      </p>
      {chartData.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E3E3E8" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#6E6E73" }}
              axisLine={{ stroke: "#E3E3E8" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6E6E73" }}
              axisLine={false}
              tickLine={false}
              width={45}
              tickFormatter={formatYAxisTick}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #E3E3E8",
                fontSize: 12,
                fontFamily: "-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif",
              }}
              formatter={(v) => [formatMoney(v), "Revenue"]}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#0071E3"
              strokeWidth={2}
              dot={{ r: 3, fill: "#0071E3" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[220px] flex items-center justify-center text-sm text-muted">
      No delivered orders yet — revenue will chart here once orders come in.
    </div>
  );
}