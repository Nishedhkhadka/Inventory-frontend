import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Camera, Loader2, AlertTriangle, CheckCircle2, X, PackageCheck, CheckSquare, Square } from "lucide-react";
import { fetchPendingPackaging, verifyPackagePhoto, confirmPackaging } from "../api/packaging";
import { updateSale } from "../api/sales";
import { formatDate } from "../utils/dateFmt";

// Confidence at/above this line is pre-checked in the confirmation dialog;
// anything lower still shows up, just unchecked, so a packer can still
// include a low-confidence hit after eyeballing it.
const AUTO_CHECK_THRESHOLD = 55;

export default function Packaging({ onNavigate }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Manual multi-select on the cards themselves, for "mark these as Packed"
  // without going through a photo at all.
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMarking, setBulkMarking] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  // Per-card quick action, so the card can show its own tiny spinner
  // instead of the whole grid re-rendering as "loading".
  const [markingId, setMarkingId] = useState(null);

  const fileInputRef = useRef(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  // Confirmation dialog state: a single photo can show several packages,
  // so this is a MULTI-select of matches, not one chosen order.
  const [dialog, setDialog] = useState(null); // { imagePath, ocrText, matches }
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [manualAddId, setManualAddId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  const groupedPendingSales = useMemo(() => {
    const groups = new Map();
    for (const sale of sales) {
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
    return Array.from(groups.values()).map((group) => ({
      ...group,
      ids: group.sales.map((s) => s._id),
      totalQuantity: group.sales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0),
      orderIds: [...new Set(group.sales.map((s) => s.orderId))],
      productNames: [...new Set(group.sales.map((s) => s.product?.name).filter(Boolean))],
    }));
  }, [sales]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchPendingPackaging()
      .then(setSales)
      .catch((err) => setLoadError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCardSelected = (group) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = group.ids.every((id) => next.has(id));
      for (const id of group.ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sales.map((s) => s._id)));
  const clearSelection = () => setSelectedIds(new Set());

  // Quick path: skip the photo/OCR flow entirely and mark a single card
  // Packed directly.
  const markPacked = async (group) => {
    setMarkingId(group.key);
    setBulkError(null);
    try {
      await Promise.all(group.ids.map((id) => updateSale(id, { status: "Packed" })));
      setSales((prev) => prev.filter((s) => !group.ids.includes(s._id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of group.ids) next.delete(id);
        return next;
      });
    } catch (err) {
      setBulkError(err.response?.data?.message || err.message);
    } finally {
      setMarkingId(null);
    }
  };

  const markSelectedPacked = async () => {
    if (selectedIds.size === 0) return;
    setBulkMarking(true);
    setBulkError(null);
    try {
      const ids = [...new Set([...selectedIds])];
      await Promise.all(ids.map((id) => updateSale(id, { status: "Packed" })));
      setSales((prev) => prev.filter((s) => !ids.includes(s._id)));
      clearSelection();
    } catch (err) {
      setBulkError(err.response?.data?.message || err.message);
      load();
    } finally {
      setBulkMarking(false);
    }
  };

  // Single global button: one photo can cover multiple packages, so this
  // isn't tied to any particular card.
  const openCamera = () => fileInputRef.current?.click();

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file next time
    if (!file) return;

    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await verifyPackagePhoto(file);
      setDialog(res);
      setCheckedIds(new Set(res.matches.filter((m) => m.confidence >= AUTO_CHECK_THRESHOLD).map((m) => m.saleId)));
      setManualAddId("");
    } catch (err) {
      setVerifyError(err.response?.data?.message || err.message);
    } finally {
      setVerifying(false);
    }
  };

  const toggleChecked = (saleId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(saleId) ? next.delete(saleId) : next.add(saleId);
      return next;
    });
  };

  const addManualMatch = () => {
    if (!manualAddId) return;
    const sale = sales.find((s) => s._id === manualAddId);
    if (!sale) return;
    setDialog((d) => ({
      ...d,
      matches: d.matches.some((m) => m.saleId === sale._id)
        ? d.matches
        : [
            ...d.matches,
            {
              saleId: sale._id,
              orderId: sale.orderId,
              customer: sale.pointOfContact,
              product: sale.product?.name,
              color: sale.color,
              confidence: 0,
              matchedOn: ["added manually"],
            },
          ],
    }));
    setCheckedIds((prev) => new Set(prev).add(sale._id));
    setManualAddId("");
  };

  const closeDialog = () => {
    setDialog(null);
    setCheckedIds(new Set());
    setManualAddId("");
    setConfirmError(null);
  };

  const handleConfirm = async () => {
    if (!dialog || checkedIds.size === 0) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const chosen = dialog.matches.filter((m) => checkedIds.has(m.saleId));
      await Promise.all(
        chosen.map((m) =>
          confirmPackaging({
            saleId: m.saleId,
            imagePath: dialog.imagePath,
            ocrText: dialog.ocrText,
            confidence: m.confidence,
          })
        )
      );
      closeDialog();
      load();
    } catch (err) {
      setConfirmError(err.response?.data?.message || err.message);
    } finally {
      setConfirming(false);
    }
  };

  const unmatchedSales = useMemo(
    () => sales.filter((s) => !dialog?.matches.some((m) => m.saleId === s._id)),
    [sales, dialog]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-ink">Packaging verification</h1>
          <p className="text-sm text-muted mt-1">
            One photo can cover several packages — Zeno matches everyone in it automatically.
          </p>
        </div>
        <button
          onClick={openCamera}
          disabled={verifying}
          className="flex items-center justify-center gap-2 bg-ink text-paper text-sm font-medium px-4 py-2.5 rounded-md hover:bg-moss-dark disabled:opacity-50 transition-colors shrink-0"
        >
          {verifying ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Reading photo…
            </>
          ) : (
            <>
              <Camera size={16} /> Take Package Photo
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {verifyError && (
        <div className="bg-clay-light border border-clay/30 text-clay rounded-lg px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{verifyError}</span>
        </div>
      )}
      {bulkError && (
        <div className="bg-clay-light border border-clay/30 text-clay rounded-lg px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{bulkError}</span>
        </div>
      )}

      {sales.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-card border border-line rounded-lg px-4 py-2.5">
          <button
            onClick={selectedIds.size === sales.length ? clearSelection : selectAll}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            {selectedIds.size === sales.length ? <CheckSquare size={15} /> : <Square size={15} />}
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
          </button>
          {selectedIds.size > 0 && (
            <>
              <button onClick={clearSelection} className="text-sm text-muted hover:text-ink">
                Clear
              </button>
              <button
                onClick={markSelectedPacked}
                disabled={bulkMarking}
                className="ml-auto flex items-center gap-1.5 bg-moss text-white text-sm font-medium px-3 py-1.5 rounded-md hover:bg-moss-dark disabled:opacity-50 transition-colors"
              >
                {bulkMarking ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Marking…
                  </>
                ) : (
                  <>
                    <PackageCheck size={14} /> Mark {selectedIds.size} as Packed
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-muted">Loading pending orders…</p>}

      {loadError && (
        <div className="bg-clay-light border border-clay/30 text-clay rounded-lg px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {!loading && !loadError && sales.length === 0 && (
        <div className="bg-card border border-line rounded-lg p-8 text-center">
          <PackageCheck size={24} className="text-muted mx-auto mb-2" />
          <p className="text-sm text-muted">Nothing waiting to be packed right now.</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {groupedPendingSales.map((group) => {
          const isSelected = group.ids.every((id) => selectedIds.has(id));
          return (
            <div
              key={group.key}
              className={`bg-card border rounded-lg p-3 flex flex-col gap-2 cursor-pointer transition-colors ${
                isSelected ? "border-moss ring-1 ring-moss" : "border-line"
              }`}
              onClick={() => toggleCardSelected(group)}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.("sales", group.orderIds[0]);
                  }}
                  className="font-display text-sm text-ink truncate hover:text-moss-dark hover:underline text-left"
                >
                  {group.orderIds.length > 1 ? `${group.orderIds.length} orders` : group.orderIds[0] || "Order"}
                </button>
                {isSelected ? (
                  <CheckSquare size={15} className="text-moss-dark shrink-0" />
                ) : (
                  <Square size={15} className="text-muted shrink-0" />
                )}
              </div>

              <dl className="text-xs space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted shrink-0">Customer</dt>
                  <dd className="text-right truncate">
                    {group.customer ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate?.("sales", group.customer);
                        }}
                        className="text-ink hover:text-moss-dark hover:underline"
                      >
                        {group.customer}
                      </button>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <Row label="Orders" value={group.orderIds.length} />
                <Row label="Products" value={group.productNames.length > 0 ? group.productNames.join(", ") : "—"} />
                <Row label="Qty" value={group.totalQuantity} />
                {group.phone && group.phone !== "—" && <Row label="Phone" value={group.phone} />}
                <Row label="Date" value={formatDate(group.sales[0]?.orderDate)} />
              </dl>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markPacked(group);
                }}
                disabled={markingId === group.key}
                className="mt-1 flex items-center justify-center gap-1.5 bg-paper border border-line text-ink text-xs font-medium py-1.5 rounded-md hover:border-moss hover:text-moss-dark disabled:opacity-50 transition-colors"
              >
                {markingId === group.key ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <PackageCheck size={12} />
                )}
                Mark Packed
              </button>
            </div>
          );
        })}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 px-0 sm:px-4" onClick={closeDialog}>
          <div
            className="bg-card w-full sm:max-w-lg sm:rounded-lg rounded-t-lg border border-line max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <p className="font-display text-lg text-ink">Detected packages</p>
              <button onClick={closeDialog} className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted mb-1">Detected text</p>
                <p className="text-sm text-ink bg-paper border border-line rounded-md px-3 py-2 whitespace-pre-wrap max-h-28 overflow-y-auto">
                  {dialog.ocrText || "No text detected"}
                </p>
              </div>

              {dialog.matches.length === 0 ? (
                <p className="text-sm text-muted">
                  No confident match found. Add the correct order below.
                </p>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted mb-1.5">
                    Matched orders — tick the ones this photo covers
                  </p>
                  <div className="space-y-1.5">
                    {dialog.matches.map((m) => (
                      <label
                        key={m.saleId}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer text-sm ${
                          checkedIds.has(m.saleId) ? "border-moss bg-moss-light/40" : "border-line"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checkedIds.has(m.saleId)}
                          onChange={() => toggleChecked(m.saleId)}
                          className="accent-moss"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-ink font-medium truncate">
                            {m.orderId} — {m.customer || "no name"}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {m.product || "—"}
                            {m.color ? ` · ${m.color}` : ""}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-medium shrink-0 ${
                            m.confidence >= 70
                              ? "text-moss-dark"
                              : m.confidence >= 40
                              ? "text-amber"
                              : "text-muted"
                          }`}
                        >
                          {m.confidence}%
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wide text-muted mb-1.5">
                  Missing one? Add it manually
                </p>
                <div className="flex gap-2">
                  <select
                    value={manualAddId}
                    onChange={(e) => setManualAddId(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-paper rounded-md border border-line"
                  >
                    <option value="">Choose an order…</option>
                    {unmatchedSales.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.orderId} — {s.pointOfContact || "no name"}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addManualMatch}
                    disabled={!manualAddId}
                    className="px-3 py-2 text-sm rounded-md border border-line text-ink hover:border-moss disabled:opacity-50 transition-colors shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              {confirmError && (
                <div className="bg-clay-light border border-clay/30 text-clay rounded-lg px-3 py-2 text-xs flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{confirmError}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-line">
              <button
                onClick={handleConfirm}
                disabled={checkedIds.size === 0 || confirming}
                className="w-full flex items-center justify-center gap-2 bg-moss text-white text-sm font-medium py-2.5 rounded-md hover:bg-moss-dark disabled:opacity-50 transition-colors"
              >
                {confirming ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Confirming…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    Confirm {checkedIds.size > 0 ? `(${checkedIds.size})` : ""} as Packed
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-ink text-right truncate">{value}</dd>
    </div>
  );
}
