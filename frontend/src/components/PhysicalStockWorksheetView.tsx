import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  History,
  Layers,
  Minus,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { AuditReason, Medicine } from '../types/pharmacy';
import { exportAuditLogToExcel } from '../utils/excelUtils';
import { digitsOnlyUpTo, preventInvalidNumberKeys } from '../utils/inputValidation';

type WorksheetEntry = {
  packs: number;
  loose: number;
  reason: AuditReason | '';
};

const AUDIT_REASONS: AuditReason[] = [
  'Physical Count Audit',
  'Damaged / Broken Strip',
  'Expired Medicine Disposal',
  'Supplier Return / Correction',
  'Theft / Shrinkage Loss',
  'Other Adjustment',
];

const AVATAR_STYLES = [
  'bg-teal-100 text-teal-800',
  'bg-violet-100 text-violet-800',
  'bg-orange-100 text-orange-800',
  'bg-sky-100 text-sky-800',
];

function getUnits(medicine: Medicine, count: WorksheetEntry) {
  return count.packs * medicine.unitsPerPack + count.loose;
}

function getExpiryMonths(expiryDate: string) {
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) {
    return null;
  }
  const now = new Date();
  return (
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    expiry.getMonth() -
    now.getMonth()
  );
}

export const PhysicalStockWorksheetView: React.FC = () => {
  const {
    medicines,
    racks,
    stockAdjustments,
    settings,
    inventoryBackendStatus,
    inventoryBackendError,
    stockAdjustmentHistoryBackendStatus,
    stockAdjustmentHistoryBackendError,
    submitStockAdjustment,
    setActiveAuditMedicine,
  } = usePharmacy();

  const [activeSubTab, setActiveSubTab] = useState<'worksheet' | 'history'>('worksheet');
  const [selectedRack, setSelectedRack] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [worksheetCounts, setWorksheetCounts] = useState<Record<string, WorksheetEntry>>({});
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(() => new Set());
  const [pendingSubmissionIds, setPendingSubmissionIds] = useState<Set<string> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');

  const rackLocations = useMemo(() => {
    const locations = new Set<string>();
    racks.forEach(rack => rack.name && locations.add(rack.name));
    medicines.forEach(medicine => {
      if (medicine.rackLocation && medicine.rackLocation !== 'Unassigned') {
        locations.add(medicine.rackLocation);
      }
    });
    return [...locations].sort((a, b) => a.localeCompare(b));
  }, [medicines, racks]);

  const filteredMedicines = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return medicines.filter(medicine => {
      const matchesRack =
        selectedRack === 'All' || medicine.rackLocation === selectedRack;
      const matchesSearch =
        !query ||
        medicine.name.toLowerCase().includes(query) ||
        medicine.genericName.toLowerCase().includes(query) ||
        medicine.batchNumber.toLowerCase().includes(query);
      return matchesRack && matchesSearch;
    });
  }, [medicines, searchQuery, selectedRack]);

  const entries = useMemo(
    () =>
      medicines.map(medicine => ({
        medicine,
        count: worksheetCounts[medicine.id] ?? {
          packs: medicine.stockPacks,
          loose: medicine.stockLooseUnits,
          reason: '',
        },
      })),
    [medicines, worksheetCounts]
  );

  const matchingCount = entries.filter(
    ({ medicine, count }) => getUnits(medicine, count) ===
      medicine.stockPacks * medicine.unitsPerPack + medicine.stockLooseUnits
  ).length;
  const varianceCount = medicines.length - matchingCount;
  const verifiedCount = [...verifiedIds].filter(id =>
    medicines.some(medicine => medicine.id === id)
  ).length;
  const verifiedPercent = medicines.length
    ? Math.round((verifiedCount / medicines.length) * 100)
    : 0;
  const pendingReasons = entries.filter(
    ({ medicine, count }) =>
      getUnits(medicine, count) !==
        medicine.stockPacks * medicine.unitsPerPack + medicine.stockLooseUnits &&
      !count.reason
  ).length;
  const canSubmit =
    medicines.length > 0 &&
    verifiedCount === medicines.length &&
    pendingReasons === 0 &&
    inventoryBackendStatus === 'connected' &&
    !isSubmitting;

  const updateCount = (
    medicine: Medicine,
    update: Partial<WorksheetEntry>
  ) => {
    setSubmitError('');
    setSubmitMessage('');
    setWorksheetCounts(previous => {
      const current = previous[medicine.id] ?? {
        packs: medicine.stockPacks,
        loose: medicine.stockLooseUnits,
        reason: '',
      };
      return {
        ...previous,
        [medicine.id]: { ...current, ...update },
      };
    });
    setVerifiedIds(previous => {
      const next = new Set(previous);
      next.delete(medicine.id);
      return next;
    });
    setPendingSubmissionIds(previous =>
      previous ? new Set(previous).add(medicine.id) : previous
    );
  };

  const verifyMedicine = (medicine: Medicine, count: WorksheetEntry) => {
    const variance =
      getUnits(medicine, count) -
      (medicine.stockPacks * medicine.unitsPerPack + medicine.stockLooseUnits);
    if (variance !== 0 && !count.reason) {
      setSubmitError(`Choose an audit reason for ${medicine.name} before verifying.`);
      return;
    }

    setSubmitError('');
    setVerifiedIds(previous => new Set(previous).add(medicine.id));
  };

  const handleConfirmMatches = () => {
    setSubmitError('');
    setSubmitMessage('');
    setVerifiedIds(previous => {
      const next = new Set(previous);
      filteredMedicines.forEach(medicine => {
        const count = worksheetCounts[medicine.id] ?? {
          packs: medicine.stockPacks,
          loose: medicine.stockLooseUnits,
          reason: '',
        };
        const systemUnits =
          medicine.stockPacks * medicine.unitsPerPack + medicine.stockLooseUnits;
        if (getUnits(medicine, count) === systemUnits) {
          next.add(medicine.id);
        }
      });
      return next;
    });
  };

  const handleResetCounts = () => {
    setWorksheetCounts({});
    setVerifiedIds(new Set());
    setPendingSubmissionIds(null);
    setSubmitError('');
    setSubmitMessage('');
  };

  const handleSubmitAudit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitMessage('');

    const entriesToSubmit = entries.filter(
      ({ medicine }) =>
        pendingSubmissionIds === null || pendingSubmissionIds.has(medicine.id)
    );
    const failedEntries: Record<string, WorksheetEntry> = {};
    let submitted = 0;

    for (const { medicine, count } of entriesToSubmit) {
      try {
        await submitStockAdjustment({
          medicineId: medicine.id,
          type: 'reconcile',
          countedPacks: count.packs,
          countedLoose: count.loose,
          reason: count.reason || 'Physical Count Audit',
          notes: 'Physical stock worksheet audit',
        });
        submitted += 1;
      } catch (error) {
        failedEntries[medicine.id] = count;
        console.error(`Unable to submit stock count for ${medicine.name}:`, error);
      }
    }

    if (Object.keys(failedEntries).length > 0) {
      setWorksheetCounts(failedEntries);
      setVerifiedIds(new Set(medicines.map(medicine => medicine.id)));
      setPendingSubmissionIds(new Set(Object.keys(failedEntries)));
      setSubmitError(
        `${submitted} item(s) saved. ${Object.keys(failedEntries).length} item(s) failed; check the connection and retry.`
      );
    } else {
      setWorksheetCounts({});
      setVerifiedIds(new Set());
      setPendingSubmissionIds(null);
      setSubmitMessage(`Audit submitted. ${submitted} item(s) recorded in the backend audit history.`);
    }

    setIsSubmitting(false);
  };

  const footerMessage = pendingReasons > 0
    ? `${pendingReasons} variance${pendingReasons === 1 ? '' : 's'} need a reason.`
    : inventoryBackendStatus !== 'connected'
      ? inventoryBackendStatus === 'error'
        ? 'Reconnect to live inventory before submitting this audit.'
        : 'Wait for live inventory to connect before submitting this audit.'
    : verifiedCount < medicines.length
      ? `${medicines.length - verifiedCount} item(s) left to verify.`
      : 'All items verified. Ready to submit.';

  return (
    <div className="space-y-5 pb-3">
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-950/[0.02]">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
              Physical stock verification &amp; audit
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Count shelf by shelf, reconcile with the system, and keep an audit trail.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveSubTab('worksheet')}
              className={`rounded-lg px-3.5 py-2 transition-colors ${
                activeSubTab === 'worksheet'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Shelf worksheet
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('history')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition-colors ${
                activeSubTab === 'history'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Audit history ({stockAdjustments.length})
            </button>
          </div>
          <button
            type="button"
            onClick={() => exportAuditLogToExcel(stockAdjustments, settings.storeName)}
            className="flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-3.5 py-2.5 text-xs font-bold text-teal-800 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            <Download className="h-4 w-4" />
            Export audit log
          </button>
        </div>
      </section>

      <section
        aria-live="polite"
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            inventoryBackendStatus === 'connected'
              ? 'bg-emerald-500'
              : inventoryBackendStatus === 'error'
                ? 'bg-rose-500'
                : inventoryBackendStatus === 'loading'
                  ? 'animate-pulse bg-amber-500'
                  : 'bg-slate-400'
          }`} />
          <div className="min-w-0 text-xs">
            <span className="font-bold text-slate-700">Inventory</span>
            <span className={`ml-2 ${
            inventoryBackendStatus === 'connected'
              ? 'font-semibold text-emerald-700'
              : inventoryBackendStatus === 'error'
                ? 'font-semibold text-rose-700'
                : inventoryBackendStatus === 'loading'
                  ? 'font-semibold text-amber-700'
                  : 'font-semibold text-slate-500'
            }`}>
              {inventoryBackendStatus === 'connected'
                ? 'Connected'
                : inventoryBackendStatus === 'loading'
                  ? 'Syncing live inventory'
                  : inventoryBackendStatus === 'error'
                    ? 'Connection failed'
                    : 'Sign in to sync'}
            </span>
            {inventoryBackendStatus === 'loading' && (
              <span className="mt-1 block text-[10px] text-slate-500">Cached values may appear until sync finishes.</span>
            )}
            {inventoryBackendStatus === 'error' && (
              <span className="mt-1 block break-words text-[10px] text-rose-700">{inventoryBackendError}</span>
            )}
          </div>
        </div>
        <span className="hidden h-8 w-px bg-slate-200 sm:block" />
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            stockAdjustmentHistoryBackendStatus === 'connected'
              ? 'bg-emerald-500'
              : stockAdjustmentHistoryBackendStatus === 'error'
                ? 'bg-rose-500'
                : stockAdjustmentHistoryBackendStatus === 'loading'
                  ? 'animate-pulse bg-amber-500'
                  : 'bg-slate-400'
          }`} />
          <div className="min-w-0 text-xs">
            <span className="font-bold text-slate-700">Audit history</span>
            <span className={`ml-2 ${
            stockAdjustmentHistoryBackendStatus === 'connected'
              ? 'font-semibold text-emerald-700'
              : stockAdjustmentHistoryBackendStatus === 'error'
                ? 'font-semibold text-rose-700'
                : stockAdjustmentHistoryBackendStatus === 'loading'
                  ? 'font-semibold text-amber-700'
                  : 'font-semibold text-slate-500'
            }`}>
              {stockAdjustmentHistoryBackendStatus === 'connected'
                ? 'Connected'
                : stockAdjustmentHistoryBackendStatus === 'loading'
                  ? 'Syncing records'
                  : stockAdjustmentHistoryBackendStatus === 'error'
                    ? 'Connection failed'
                    : 'Sign in to sync'}
            </span>
            {stockAdjustmentHistoryBackendStatus === 'error' && (
              <span className="mt-1 block break-words text-[10px] text-rose-700">{stockAdjustmentHistoryBackendError}</span>
            )}
          </div>
        </div>
      </section>

      {activeSubTab === 'worksheet' ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Items on worksheet</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{medicines.length}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200">Rx</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Matching system</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-emerald-700">{matchingCount}</p>
              </div>
              <CheckCircle2 className="h-10 w-10 rounded-xl bg-emerald-50 p-2.5 text-emerald-700 ring-1 ring-emerald-100" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">With variance</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-rose-700">{varianceCount}</p>
              </div>
              <ShieldAlert className="h-10 w-10 rounded-xl bg-rose-50 p-2.5 text-rose-700 ring-1 ring-rose-100" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Verified</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{verifiedPercent}%</p>
              </div>
              <div
                className="grid h-12 w-12 place-items-center rounded-full ring-1 ring-slate-200"
                style={{
                  background: `conic-gradient(#0f766e ${verifiedPercent}%, #e2e8f0 0)`,
                }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[10px] font-bold text-slate-700">
                  {verifiedCount}/{medicines.length}
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-950/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Layers className="h-4 w-4 text-teal-700" />
                Filter by rack
              </div>
              <label className="relative block min-w-[220px] flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="Search medicine or batch"
                  placeholder="Search medicine or batch"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRack('All')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedRack === 'All'
                    ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                All racks ({medicines.length})
              </button>
              {rackLocations.map(rack => (
                <button
                  type="button"
                  key={rack}
                  onClick={() => setSelectedRack(rack)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    selectedRack === rack
                      ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {rack} ({medicines.filter(medicine => medicine.rackLocation === rack).length})
                </button>
              ))}
            </div>
          </section>

          {submitError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 shadow-sm">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}
          {submitMessage && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {submitMessage}
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/[0.02]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] uppercase tracking-[0.08em] text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3.5">Medicine</th>
                    <th className="border-b border-slate-200 px-3 py-3.5">Batch &amp; expiry</th>
                    <th className="border-b border-slate-200 px-3 py-3.5">Rack</th>
                    <th className="border-b border-slate-200 px-3 py-3.5 text-right">Pack size</th>
                    <th className="border-b border-slate-200 px-3 py-3.5">System stock</th>
                    <th className="border-b border-teal-100 bg-teal-50 px-3 py-3.5 text-teal-900">Counted packs</th>
                    <th className="border-b border-teal-100 bg-teal-50 px-3 py-3.5 text-teal-900">Loose units</th>
                    <th className="border-b border-slate-200 px-3 py-3.5 text-right">Variance</th>
                    <th className="border-b border-slate-200 px-3 py-3.5">Reason</th>
                    <th className="border-b border-slate-200 px-3 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMedicines.map((medicine, index) => {
                    const count = worksheetCounts[medicine.id] ?? {
                      packs: medicine.stockPacks,
                      loose: medicine.stockLooseUnits,
                      reason: '',
                    };
                    const systemUnits =
                      medicine.stockPacks * medicine.unitsPerPack + medicine.stockLooseUnits;
                    const physicalUnits = getUnits(medicine, count);
                    const variance = physicalUnits - systemUnits;
                    const isVerified = verifiedIds.has(medicine.id);
                    const expiryMonths = getExpiryMonths(medicine.expiryDate);

                    return (
                      <tr
                        key={medicine.id}
                        className={`transition-colors ${
                          isVerified
                            ? 'bg-emerald-50/50 hover:bg-emerald-50'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="border-l-2 border-transparent px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold ring-1 ring-black/[0.04] ${AVATAR_STYLES[index % AVATAR_STYLES.length]}`}>
                              {medicine.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-bold leading-snug text-slate-900">{medicine.name}</span>
                              <span className="mt-0.5 block text-[11px] text-slate-500">{medicine.genericName}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="font-mono text-[11px] font-semibold text-slate-700">{medicine.batchNumber}</span>
                          <span className="mt-1 block text-[11px] text-slate-500">Exp {medicine.expiryDate}</span>
                          {expiryMonths !== null && expiryMonths >= 0 && expiryMonths < 12 && (
                            <span className="mt-1 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              {expiryMonths} mo left
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
                            {medicine.rackLocation || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono text-slate-600">
                          {medicine.unitsPerPack} /pk
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="font-bold text-slate-900">
                            {medicine.stockPacks} packs
                            {medicine.stockLooseUnits ? ` + ${medicine.stockLooseUnits} loose` : ''}
                          </span>
                          <span className="mt-1 block text-[10px] font-medium text-slate-500">{systemUnits} total units</span>
                        </td>
                        <td className="border-l border-teal-100 bg-teal-50/40 px-3 py-3.5">
                          <div className="inline-flex h-10 items-center overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm transition focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10">
                            <button
                              type="button"
                              aria-label={`Decrease counted packs for ${medicine.name}`}
                              onClick={() => updateCount(medicine, { packs: Math.max(0, count.packs - 1) })}
                              className="grid h-full w-8 place-items-center bg-slate-50 text-slate-500 transition hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              aria-label={`Counted packs for ${medicine.name}`}
                              value={count.packs}
                              onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                              onChange={event =>
                                updateCount(medicine, {
                                  packs: Math.max(0, Number(digitsOnlyUpTo(event.target.value, 6)) || 0),
                                })
                              }
                              className="w-14 border-x border-slate-200 bg-white py-2 text-center font-mono font-bold text-slate-900 outline-none"
                            />
                            <button
                              type="button"
                              aria-label={`Increase counted packs for ${medicine.name}`}
                              onClick={() => updateCount(medicine, { packs: count.packs + 1 })}
                              className="grid h-full w-8 place-items-center bg-slate-50 text-slate-500 transition hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="border-r border-teal-100 bg-teal-50/40 px-3 py-3.5">
                          <input
                            type="number"
                            min="0"
                            max={medicine.unitsPerPack - 1}
                            step="1"
                            inputMode="numeric"
                            aria-label={`Loose units counted for ${medicine.name}`}
                            value={count.loose}
                            onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                            onChange={event =>
                              updateCount(medicine, {
                                loose: Math.min(
                                  medicine.unitsPerPack - 1,
                                  Math.max(0, Number(digitsOnlyUpTo(event.target.value, 6)) || 0)
                                ),
                              })
                            }
                            className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-center font-mono font-bold text-slate-900 shadow-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
                          />
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          {variance === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              Matches
                            </span>
                          ) : (
                            <span className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 font-mono font-extrabold ${
                              variance < 0
                                ? 'border-rose-200 bg-rose-50 text-rose-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                            }`}>
                              {variance > 0 ? '+' : ''}{variance} u
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          {variance !== 0 ? (
                            <select
                              aria-label={`Audit reason for ${medicine.name}`}
                              value={count.reason}
                              onChange={event =>
                                updateCount(medicine, { reason: event.target.value as AuditReason | '' })
                              }
                              className={`max-w-40 rounded-lg border bg-white px-2.5 py-2.5 text-[11px] text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 ${
                                !count.reason ? 'border-rose-300' : 'border-slate-300'
                              }`}
                            >
                              <option value="">Select reason</option>
                              {AUDIT_REASONS.map(reason => (
                                <option key={reason} value={reason}>{reason}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-slate-400">Not required</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => verifyMedicine(medicine, count)}
                              className={`whitespace-nowrap rounded-lg border px-2.5 py-2 text-[11px] font-bold ${
                                isVerified
                                  ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                                  : 'border-slate-300 bg-white text-slate-700 hover:border-teal-600 hover:bg-teal-50'
                              }`}
                            >
                              {isVerified ? <><Check className="mr-1 inline h-3.5 w-3.5" />Verified</> : 'Verify'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveAuditMedicine(medicine)}
                              className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                            >
                              Modal view
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMedicines.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">
                        {medicines.length === 0
                          ? 'No inventory is available from the backend yet.'
                          : 'No medicines match your search or rack filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-7 lg:px-7">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-600" role="status">
              <span className={`h-2 w-2 rounded-full ${
                isSubmitting
                  ? 'animate-pulse bg-amber-500'
                  : pendingReasons > 0
                    ? 'bg-rose-500'
                    : verifiedCount === medicines.length && medicines.length > 0
                      ? 'bg-emerald-500'
                      : 'bg-slate-400'
              }`} />
              {isSubmitting ? 'Saving verified counts to the backend…' : footerMessage}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResetCounts}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset counts
              </button>
              <button
                type="button"
                onClick={handleConfirmMatches}
                disabled={isSubmitting || medicines.length === 0}
                className="rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs font-bold text-teal-900 shadow-sm transition hover:border-teal-300 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm all matching
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitAudit()}
                disabled={!canSubmit}
                title={inventoryBackendStatus !== 'connected' ? 'Connect to live inventory before submitting the audit.' : undefined}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? 'Submitting…' : 'Submit audit'}
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-teal-800 ring-1 ring-slate-200">
                <History className="h-4 w-4" />
              </span>
              Physical count audit history
            </h3>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
              Records <strong className="ml-1 text-slate-800">{stockAdjustments.length}</strong>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-[0.08em] text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3.5">Time</th>
                  <th className="border-b border-slate-200 px-4 py-3.5">Record</th>
                  <th className="border-b border-slate-200 px-4 py-3.5 text-right">Variance</th>
                  <th className="border-b border-slate-200 px-4 py-3.5">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockAdjustments.map(log => (
                  <tr key={log.id} className="transition-colors hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <strong className="text-slate-900">{log.medicineName}</strong>
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{log.batchNumber}</span>
                      <span className="mt-1 block text-[11px] text-slate-600">
                        {log.reason}{log.notes && log.notes !== log.reason ? ` · ${log.notes}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-extrabold">
                      <span className={
                        log.netVarianceUnits > 0
                          ? 'text-amber-700'
                          : log.netVarianceUnits < 0
                            ? 'text-rose-700'
                            : 'text-slate-500'
                      }>
                        {log.netVarianceUnits > 0 ? '+' : ''}{log.netVarianceUnits} units
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">{log.recordedBy}</td>
                  </tr>
                ))}
                {stockAdjustments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                      No audit history is available from the backend yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
