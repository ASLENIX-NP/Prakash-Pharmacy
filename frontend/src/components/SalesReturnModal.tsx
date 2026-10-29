import React, { useState } from 'react';
import { RotateCcw, X, AlertCircle } from 'lucide-react';
import { SaleInvoice } from '../types/pharmacy';
import { usePharmacy } from '../context/PharmacyContext';

interface SalesReturnModalProps {
  invoice: SaleInvoice;
  onClose: () => void;
  onSuccess: (refundAmount: number) => void;
}

export const SalesReturnModal: React.FC<SalesReturnModalProps> = ({
  invoice,
  onClose,
  onSuccess,
}) => {
  const { returnSaleItems } = usePharmacy();
  const [reason, setReason] = useState('Customer return / change of prescription');
  const [returnQtys, setReturnQtys] = useState<Record<string, { packs: number; loose: number }>>(() => {
    const initial: Record<string, { packs: number; loose: number }> = {};
    invoice.items.forEach((item, index) => {
      initial[`${item.medicineId}-${index}`] = { packs: 0, loose: 0 };
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate estimated refund
  const estimatedRefund = invoice.items.reduce((sum, item, index) => {
    const entry = returnQtys[`${item.medicineId}-${index}`] || { packs: 0, loose: 0 };
    const upp = item.unitsPerPack > 0 ? item.unitsPerPack : 1;
    const packPrice = item.isLooseUnit ? item.unitPrice * upp : item.unitPrice;
    const loosePrice = item.isLooseUnit ? item.unitPrice : packPrice / upp;
    return sum + (entry.packs * packPrice) + (entry.loose * loosePrice);
  }, 0);

  const totalReturnCount = Object.values(returnQtys).reduce(
    (acc, cur) => acc + cur.packs + cur.loose,
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalReturnCount === 0) {
      setError('Please specify at least one pack or loose unit to return.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const returnedItems: Array<{
        billItemId?: number;
        inventoryId: number;
        quantityPacks: number;
        quantityLoose: number;
      }> = [];

      invoice.items.forEach((item, index) => {
        const entry = returnQtys[`${item.medicineId}-${index}`];
        if (entry && (entry.packs > 0 || entry.loose > 0)) {
          const invId = item.inventoryId || parseInt(String(item.medicineId).replace(/\D/g, ''), 10) || 0;
          returnedItems.push({
            inventoryId: invId,
            billItemId: item.billItemId || (typeof item.id === 'number' ? item.id : undefined),
            quantityPacks: entry.packs,
            quantityLoose: entry.loose,
          });
        }
      });

      const res = await returnSaleItems(invoice.id, {
        reason,
        returnedItems,
      });

      onSuccess(res.refundAmount ?? estimatedRefund);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process return.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500/20 text-teal-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">Sales Return &amp; Customer Refund</h3>
              <p className="text-xs text-slate-400">
                Invoice #{invoice.invoiceNumber} • {invoice.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700">Return Reason / Notes</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Doctor changed dose, customer unopened medicine return"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Select Items to Return
              </h4>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Returned quantities will be restored back to the batch stock automatically.
              </p>

              <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
                {invoice.items.map((item, idx) => {
                  const key = `${item.medicineId}-${idx}`;
                  const entry = returnQtys[key] || { packs: 0, loose: 0 };
                  const alreadyReturned = item.alreadyReturnedQuantity || 0;
                  const returnable = item.returnableQuantity !== undefined
                    ? item.returnableQuantity
                    : Math.max(0, item.quantity - alreadyReturned);
                  const isFullyReturned = returnable <= 0;
                  const maxUnits = item.isLooseUnit ? returnable : 0;
                  const maxPacks = item.isLooseUnit ? 0 : returnable;

                  return (
                    <div
                      key={key}
                      className={`flex flex-wrap items-center justify-between gap-3 p-3.5 transition ${
                        isFullyReturned ? 'bg-slate-100/70 opacity-60' : ''
                      }`}
                    >
                      <div className="min-w-[180px] flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-xs">{item.medicineName}</span>
                          {isFullyReturned && (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                              Fully Returned
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          Sold: <span className="font-semibold text-slate-700">{item.quantity} {item.isLooseUnit ? 'Loose' : 'Pack(s)'}</span>
                          {alreadyReturned > 0 && (
                            <span className="font-semibold text-amber-700"> • Returned: {alreadyReturned}</span>
                          )}
                          <span className="font-semibold text-teal-700"> • Available to Return: {returnable}</span>
                          {item.batchNumber && <span> • Batch: {item.batchNumber}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {!item.isLooseUnit && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">Packs:</span>
                            <input
                              type="number"
                              min={0}
                              max={maxPacks}
                              disabled={isFullyReturned}
                              value={entry.packs || ''}
                              onChange={(e) => {
                                const val = Math.min(maxPacks, Math.max(0, parseInt(e.target.value || '0', 10)));
                                setReturnQtys((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], packs: val },
                                }));
                              }}
                              className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs font-bold focus:border-teal-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </div>
                        )}

                        {item.isLooseUnit && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">Loose:</span>
                            <input
                              type="number"
                              min={0}
                              max={maxUnits}
                              disabled={isFullyReturned}
                              value={entry.loose || ''}
                              onChange={(e) => {
                                const val = Math.min(maxUnits, Math.max(0, parseInt(e.target.value || '0', 10)));
                                setReturnQtys((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], loose: val },
                                }));
                              }}
                              className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs font-bold focus:border-teal-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div>
              <div className="text-[11px] text-slate-500">Total Refund Payable:</div>
              <div className="font-mono text-lg font-black text-slate-900">
                Rs. {estimatedRefund.toFixed(2)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || totalReturnCount === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{loading ? 'Processing...' : 'Confirm Return'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
