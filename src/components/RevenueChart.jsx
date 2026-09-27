import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatMoney } from "../utils/currency";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function RevenueChart({ data = [] }) {
  const chartData = data.map((d) => ({
    label: `${MONTH_LABELS[d.month - 1]} '${String(d.year).slice(2)}`,
    revenue: d.revenue,
  }));

  return (
    <div className="bg-card border border-line rounded-lg px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted mb-4">
        Monthly revenue trajectory
      </p>
      {chartData.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#DAD3C2" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#726C5F" }}
              axisLine={{ stroke: "#DAD3C2" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#726C5F" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #DAD3C2",
                fontSize: 12,
                fontFamily: "IBM Plex Mono, monospace",
              }}
              formatter={(v) => [formatMoney(v), "Revenue"]}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#5B6A4C"
              strokeWidth={2}
              dot={{ r: 3, fill: "#5B6A4C" }}
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
