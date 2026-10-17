import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatMoney } from "../utils/currency";

// Apple Slate / Neutral Accent Palette
// Replace PALETTE with this array:
// Replace PALETTE with this array:
// Replace PALETTE with this array:
const PALETTE = [
  "#5856D6", // Soft Indigo
  "#64D2FF", // Soft Sky Blue
  "#30B0C7", // Soft Teal
  "#34C759", // Soft Emerald
  "#FF9F0A", // Warm Sand/Amber
  "#FF6B81", // Soft Rose
];

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
                border: "1px solid #E3E3E8",
                fontSize: 12,
                fontFamily: "-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif",
              }}
              formatter={(v) => formatMoney(v)}
            />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ fontSize: 11, color: "#6E6E73" }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}