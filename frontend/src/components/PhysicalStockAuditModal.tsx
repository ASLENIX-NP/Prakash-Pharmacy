import React, { useState, useEffect } from 'react';
import { 
  X, 
  ClipboardCheck, 
  PlusCircle, 
  MinusCircle, 
  Calculator, 
  AlertTriangle, 
  CheckCircle2, 
  PackageCheck,
  Calendar,
  Layers
} from 'lucide-react';
import { Medicine, AuditAdjustmentType, AuditReason } from '../types/pharmacy';
import { usePharmacy } from '../context/PharmacyContext';
import { digitsOnlyUpTo, preventInvalidNumberKeys } from '../utils/inputValidation';

interface PhysicalStockAuditModalProps {
  medicine: Medicine | null;
  onClose: () => void;
}

const AUDIT_REASONS: AuditReason[] = [
  'Physical Count Audit',
  'Damaged / Broken Strip',
  'Expired Medicine Disposal',
  'Found Unrecorded Stock / Bonus',
  'Theft / Shrinkage Loss',
  'Supplier Return / Correction',
  'Breakage in Transit',
  'Sample / Free Dispensation',
  'Other Adjustment'
];

export const PhysicalStockAuditModal: React.FC<PhysicalStockAuditModalProps> = ({ medicine, onClose }) => {
  const { submitStockAdjustment, currentUser } = usePharmacy();

  const [mode, setMode] = useState<AuditAdjustmentType>('reconcile');
  const [countedPacks, setCountedPacks] = useState<number>(0);
  const [countedLoose, setCountedLoose] = useState<number>(0);
  const [deltaPacks, setDeltaPacks] = useState<number>(0);
  const [deltaLoose, setDeltaLoose] = useState<number>(0);
  const [reason, setReason] = useState<AuditReason>('Physical Count Audit');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (medicine) {
      setCountedPacks(medicine.stockPacks);
      setCountedLoose(medicine.stockLooseUnits);
      setDeltaPacks(0);
      setDeltaLoose(0);
      setReason(mode === 'deduce' ? 'Damaged / Broken Strip' : mode === 'add' ? 'Found Unrecorded Stock / Bonus' : 'Physical Count Audit');
      setNotes('');
    }
  }, [medicine, mode]);

  if (!medicine) return null;

  const currentTotalUnits = (medicine.stockPacks * medicine.unitsPerPack) + medicine.stockLooseUnits;

  // Calculate projected new units and net variance
  let projectedTotalUnits = currentTotalUnits;
  let projectedPacks = medicine.stockPacks;
  let projectedLoose = medicine.stockLooseUnits;

  if (mode === 'reconcile') {
    projectedPacks = Math.max(0, countedPacks || 0);
    projectedLoose = Math.max(0, countedLoose || 0);
    projectedTotalUnits = (projectedPacks * medicine.unitsPerPack) + projectedLoose;
  } else if (mode === 'add') {
    const addP = Math.max(0, deltaPacks || 0);
    const addL = Math.max(0, deltaLoose || 0);
    projectedTotalUnits = currentTotalUnits + (addP * medicine.unitsPerPack) + addL;
    projectedPacks = Math.floor(projectedTotalUnits / medicine.unitsPerPack);
    projectedLoose = projectedTotalUnits % medicine.unitsPerPack;
  } else if (mode === 'deduce') {
    const dedP = Math.max(0, deltaPacks || 0);
    const dedL = Math.max(0, deltaLoose || 0);
    projectedTotalUnits = Math.max(0, currentTotalUnits - (dedP * medicine.unitsPerPack) - dedL);
    projectedPacks = Math.floor(projectedTotalUnits / medicine.unitsPerPack);
    projectedLoose = projectedTotalUnits % medicine.unitsPerPack;
  }

  const netVarianceUnits = projectedTotalUnits - currentTotalUnits;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError('');
    setIsSubmitting(true);
    if (mode === 'reconcile') {
      try {
        await submitStockAdjustment({
          medicineId: medicine.id,
          type: 'reconcile',
          countedPacks,
          countedLoose,
          reason,
          notes: notes || 'Shelf Physical Count Audit',
        });
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to save the stock adjustment.');
      } finally {
        setIsSubmitting(false);
      }
    } else if (mode === 'add') {
      if (deltaPacks === 0 && deltaLoose === 0) {
        setIsSubmitting(false);
        return;
      }
      try {
        await submitStockAdjustment({
          medicineId: medicine.id,
          type: 'add',
          addedPacks: deltaPacks,
          addedLoose: deltaLoose,
          reason,
          notes: notes || 'Manual Quick Stock Addition',
        });
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to save the stock adjustment.');
      } finally {
        setIsSubmitting(false);
      }
    } else if (mode === 'deduce') {
      if (deltaPacks === 0 && deltaLoose === 0) {
        setIsSubmitting(false);
        return;
      }
      try {
        await submitStockAdjustment({
          medicineId: medicine.id,
          type: 'deduce',
          addedPacks: deltaPacks,
          addedLoose: deltaLoose,
          reason,
          notes: notes || 'Manual Quick Stock Deduction',
        });
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to save the stock adjustment.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 text-teal-300 rounded-lg border border-teal-500/30">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Physical Stock Count &amp; Adjustment
              </h3>
              <p className="text-xs text-slate-300">
                Prakash Pharmacy Shelf Reconciliation System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Medicine Overview Card */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">{medicine.name}</span>
              <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">
                {medicine.batchNumber}
              </span>
            </div>
            <p className="text-slate-500 mt-0.5">{medicine.genericName} • Location: <strong className="text-slate-700">{medicine.rackLocation}</strong></p>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block">Current System Records:</span>
            <span className="font-bold text-slate-900 text-sm font-mono">
              {medicine.stockPacks} Packs + {medicine.stockLooseUnits} Loose
            </span>
            <span className="text-[11px] text-slate-500 block">
              (= {currentTotalUnits} total tablets/units)
            </span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('reconcile')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'reconcile'
                  ? 'bg-white text-teal-800 shadow-xs font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Count Reconciliation</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'add'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Quick Add Stock (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('deduce')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'deduce'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MinusCircle className="w-3.5 h-3.5" />
              <span>Quick Deduce Stock (-)</span>
            </button>
          </div>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Inputs depending on mode */}
          {mode === 'reconcile' ? (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Enter Physical Stock Counted on Shelf:</span>
                <span className="text-teal-700 font-normal">Pack size: {medicine.unitsPerPack} units</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Full Counted Packs:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={countedPacks}
                    onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                    onChange={(e) => setCountedPacks(Math.max(0, Number(digitsOnlyUpTo(e.target.value, 6)) || 0))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Loose Tablets / Units:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={medicine.unitsPerPack - 1}
                    inputMode="numeric"
                    value={countedLoose}
                    onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                    onChange={(e) => setCountedLoose(Math.max(0, Number(digitsOnlyUpTo(e.target.value, 6)) || 0))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-xl border space-y-3 ${
              mode === 'add' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
            }`}>
              <div className="text-xs font-semibold flex items-center justify-between">
                <span className={mode === 'add' ? 'text-emerald-900' : 'text-rose-900'}>
                  {mode === 'add' ? 'Enter Stock to Add (+):' : 'Enter Stock to Deduct (-):'}
                </span>
                <span className="text-slate-500 text-[11px] font-normal">Pack size: {medicine.unitsPerPack} units</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    {mode === 'add' ? '+ Full Packs' : '- Full Packs'}:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={deltaPacks}
                    onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                    onChange={(e) => setDeltaPacks(Math.max(0, Number(digitsOnlyUpTo(e.target.value, 6)) || 0))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    {mode === 'add' ? '+ Loose Tablets' : '- Loose Tablets'}:
                  </label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={deltaLoose}
                    onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                    onChange={(e) => setDeltaLoose(Math.max(0, Number(digitsOnlyUpTo(e.target.value, 6)) || 0))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Variance Live Calculation Box */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">Calculated Resulting Inventory:</span>
              <span className="font-bold text-slate-900 text-sm font-mono">
                {projectedPacks} Packs + {projectedLoose} Loose
              </span>
              <span className="text-[11px] text-slate-500">
                (= {projectedTotalUnits} total units)
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Net Variance:</span>
              <span className={`text-base font-extrabold font-mono flex items-center justify-end gap-1 ${
                netVarianceUnits > 0
                  ? 'text-emerald-700'
                  : netVarianceUnits < 0
                  ? 'text-rose-700'
                  : 'text-slate-600'
              }`}>
                {netVarianceUnits > 0 && '+'}
                {netVarianceUnits} units
                {netVarianceUnits === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : netVarianceUnits > 0 ? (
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
              </span>
              <span className="text-[10px] text-slate-500">
                {netVarianceUnits === 0 ? 'Exact match' : netVarianceUnits > 0 ? 'Surplus addition' : 'Shortage deduction'}
              </span>
            </div>
          </div>

          {/* Audit Reason & Log Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Audit / Adjustment Reason:
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as AuditReason)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {AUDIT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Authenticated auditor:
              </label>
              <input
                type="text"
                value={currentUser ? `${currentUser.name} (@${currentUser.username})` : 'Current signed-in user'}
                readOnly
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit notes (not saved by the current backend API):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Found 2 extra strips on bottom shelf tray during Saturday stock audit"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              The backend records the adjustment reason and signed-in auditor, but does not store free-text notes.
            </p>
          </div>

          {submitError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
              {submitError}
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (mode !== 'reconcile' && deltaPacks === 0 && deltaLoose === 0)}
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <PackageCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving…' : 'Confirm &amp; Update Stock'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
