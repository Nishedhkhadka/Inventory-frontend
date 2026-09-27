export function groupPendingPackages(rows = []) {
  const groups = new Map();

  for (const sale of rows) {
    const personKey = `${(sale.pointOfContact || "Unknown").trim().toLowerCase()}|${(sale.customerPhone || "").trim()}`;

    if (!groups.has(personKey)) {
      groups.set(personKey, {
        key: personKey,
        sales: [],
        customer: sale.pointOfContact || "Unknown",
        phone: sale.customerPhone || "—",
      });
    }

    groups.get(personKey).sales.push(sale);
  }

  return Array.from(groups.values());
}
