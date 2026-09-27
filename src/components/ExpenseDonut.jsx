import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatMoney } from "../utils/currency";

const PALETTE = ["#5B6A4C", "#B0602F", "#8A8368", "#D8B48C", "#3F4633", "#C98F6B"];

export default function ExpenseDonut({ data = [] }) {
  const chartData = data.map((d) => ({ name: d.category, value: d.total }));

  return (
    <div className="bg-card border border-line rounded-lg px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted mb-4">Expense breakdown</p>
      {chartData.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-muted">
          No purchases logged yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
            >
              {chartData.map((entry, i) => (
                <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #DAD3C2",
                fontSize: 12,
                fontFamily: "IBM Plex Mono, monospace",
              }}
              formatter={(v) => formatMoney(v)}
            />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ fontSize: 11, color: "#726C5F" }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
