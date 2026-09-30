import { useRef, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { importWorkbook } from "../api/import";

function ReasonRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 ledger-rule last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-mono text-sm tabular text-ink">{value}</span>
    </div>
  );
}

export default function Import({ onNavigate }) {
  const [file, setFile] = useState(null);
  const [reset, setReset] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const pickFile = (f) => {
    if (!f) return;
    setFile(f);
    setStatus("idle");
    setResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const handleImport = async () => {
    if (!file) return;
    setStatus("uploading");
    setError(null);
    try {
      const res = await importWorkbook(file, { reset });
      setResult(res.stats);
      setStatus("done");
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setStatus("error");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-xl sm:text-2xl text-ink">
          Import data
        </h1>
        <p className="text-sm text-muted mt-1">
          Upload your Zeno business workbook (.xlsx) to seed Products, Sales,
          and Expenses in one go. Everything imported is a normal record — edit
          or delete it afterward from Inventory, Sales, or Expenses just like
          anything created by hand.
        </p>
      </div>

      <div className="bg-card border border-line rounded-lg p-5 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted">
          Expected sheets
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-paper rounded-md border border-line px-3 py-2.5">
            <p className="text-ink font-medium">Inventory</p>
            <p className="text-xs text-muted mt-0.5">
              Item ID, Item name, Type, Price, Stock…
            </p>
          </div>
          <div className="bg-paper rounded-md border border-line px-3 py-2.5">
            <p className="text-ink font-medium">Purchase</p>
            <p className="text-xs text-muted mt-0.5">
              Product, Status, Quantity, Cost…
            </p>
          </div>
          <div className="bg-paper rounded-md border border-line px-3 py-2.5">
            <p className="text-ink font-medium">Sales</p>
            <p className="text-xs text-muted mt-0.5">
              Order, Product, Status, Quantity, Price…
            </p>
          </div>
        </div>
        <p className="text-xs text-muted">
          Inventory is imported first so Purchase and Sales rows can be linked
          to the right product by name. A Purchase row is only linked to a
          catalog item when it's an inventory procurement (not Meta Ads,
          Packaging, Shipping, or Misc). The Inventory sheet's Stock column is
          treated as the already-correct current count and isn't recalculated
          from Purchase/Sales history during import — those import as historical
          records only. Once imported, live activity on the Sales and Expenses
          pages does adjust stock going forward.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-moss bg-moss-light/40" : "border-line bg-card"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileSpreadsheet size={28} className="text-moss-dark" />
            <p className="text-sm text-ink font-medium">{file.name}</p>
            <p className="text-xs text-muted">
              {(file.size / 1024).toFixed(0)} KB
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs text-muted underline hover:text-ink mt-1"
            >
              Choose a different file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud size={28} className="text-muted" />
            <p className="text-sm text-ink">Drag your Zeno (.xlsx) file here</p>
            <p className="text-xs text-muted">or</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-sm bg-ink text-paper px-4 py-2 rounded-md hover:bg-moss-dark transition-colors"
            >
              Browse files
            </button>
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm text-muted bg-card border border-line rounded-lg px-4 py-3">
        <input
          type="checkbox"
          checked={reset}
          onChange={(e) => setReset(e.target.checked)}
          className="accent-clay mt-0.5"
        />
        <span>
          <span className="text-ink font-medium">Replace existing data</span> —
          wipes all current Products, Sales, and Expenses before importing.
          Leave this off to add the workbook's rows on top of what's already in
          the app (safe to re-run; duplicate products are skipped and duplicate
          order IDs get a suffix).
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button
          disabled={!file || status === "uploading"}
          onClick={handleImport}
          className="flex items-center gap-1.5 bg-moss text-white text-sm px-5 py-2.5 rounded-md hover:bg-moss-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === "uploading" ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Importing…
            </>
          ) : (
            <>
              <UploadCloud size={15} /> Import workbook
            </>
          )}
        </button>
        {status === "done" && (
          <span className="flex items-center gap-1.5 text-sm text-moss-dark">
            <CheckCircle2 size={15} /> Import complete
          </span>
        )}
      </div>

      {status === "error" && (
        <div className="bg-clay-light border border-clay/30 text-clay rounded-lg px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="bg-card border border-line rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <p className="font-display text-lg text-ink">Import summary</p>
            <p className="text-xs text-muted mt-0.5">
              Everything below is now a normal, editable record.
            </p>
          </div>
          <div className="px-5 py-4">
            <ReasonRow
              label="Products created"
              value={result.productsCreated}
            />
            <ReasonRow
              label="Products back-filled with a cost price"
              value={result.productsWithCostPriceUpdated}
            />
            <ReasonRow
              label="Purchases / expenses imported"
              value={result.purchasesCreated}
            />
            <ReasonRow
              label="  …linked to a catalog product"
              value={result.purchasesLinkedToInventory}
            />
            <ReasonRow
              label="Sales orders imported"
              value={result.salesCreated}
            />
            <ReasonRow
              label="  …with a delivery cost recorded"
              value={result.salesDeliveryChargesImported}
            />
            <ReasonRow
              label="  …skipped, no matching product"
              value={result.salesSkippedNoProduct}
            />
            <ReasonRow
              label="  …duplicate order IDs renamed"
              value={result.duplicateOrderIdsRenamed}
            />
          </div>

          {result.warnings?.length > 0 && (
            <div className="px-5 py-4 border-t border-line">
              <p className="text-xs uppercase tracking-wide text-muted mb-2">
                Warnings ({result.warnings.length})
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-clay leading-relaxed">
                    {w}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="px-5 py-4 border-t border-line flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate?.("inventory")}
              className="text-sm px-4 py-2 rounded-md border border-line text-ink hover:border-moss transition-colors"
            >
              View Inventory
            </button>
            <button
              onClick={() => onNavigate?.("sales")}
              className="text-sm px-4 py-2 rounded-md border border-line text-ink hover:border-moss transition-colors"
            >
              View Sales
            </button>
            <button
              onClick={() => onNavigate?.("expenses")}
              className="text-sm px-4 py-2 rounded-md border border-line text-ink hover:border-moss transition-colors"
            >
              View Expenses
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
