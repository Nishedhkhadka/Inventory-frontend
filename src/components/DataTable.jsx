import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export function Badge({ tone = "muted", children }) {
  const tones = {
    moss: "bg-moss-light text-moss-dark",
    clay: "bg-clay-light text-clay",
    sky: "bg-sky-light text-sky",
    rose: "bg-rose-light text-rose",
    amber: "bg-amber-light text-amber",
    muted: "bg-paper text-muted",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Generic table shell: search box + optional filter slot, a hairline-ruled
 * table, and page controls. Callers own the data fetching and just hand
 * over columns + rows for the current page.
 */
export default function DataTable({
  columns,
  rows,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  page,
  pages,
  onPageChange,
  onRowDoubleClick,
  emptyLabel = "Nothing here yet.",
}) {
  return (
    <div className="w-full h-[78vh] border border-line rounded-lg overflow-hidden   ">
      <div className="h-full overflow-auto">
        <table className="w-full table-fixed">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-line">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-paper rounded-md border border-line focus:outline-none focus:border-moss"
              />
            </div>
            {filters}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-5 py-2.5 text-xs uppercase tracking-wide text-muted font-medium whitespace-nowrap"
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-5 py-10 text-center text-muted text-sm"
                    >
                      {emptyLabel}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.key ?? row._id}
                      className="border-b border-line last:border-0 hover:bg-paper/60"
                      onDoubleClick={() => onRowDoubleClick?.(row)}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className="px-5 py-3 whitespace-nowrap"
                        >
                          {col.render ? col.render(row) : row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-line text-xs text-muted">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-md border border-line disabled:opacity-40 hover:bg-paper"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => onPageChange(Math.min(pages, page + 1))}
                  disabled={page >= pages}
                  className="p-1.5 rounded-md border border-line disabled:opacity-40 hover:bg-paper"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </table>
      </div>
    </div>
  );
}
