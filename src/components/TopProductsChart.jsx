import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatMoney } from "../utils/currency";

export default function TopProductsChart({ data = [] }) {
  const chartData = [...data]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((d) => ({ name: d.name, revenue: d.revenue }));

  return (
    <div className="bg-card border border-line rounded-lg px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted mb-4">Top products by revenue</p>
      {chartData.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-muted">
          No delivered sales yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} stroke="#DAD3C2" strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#726C5F" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11, fill: "#211F1B" }}
              axisLine={false}
              tickLine={false}
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
            <Bar dataKey="revenue" fill="#B0602F" radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
