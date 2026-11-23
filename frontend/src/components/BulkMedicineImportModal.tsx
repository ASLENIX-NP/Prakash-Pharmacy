import React, { useState, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Building, 
  FileText, 
  Layers, 
  X 
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { useDialog } from '../context/DialogContext';
import { Medicine, StockistInvoiceItem } from '../types/pharmacy';
import { parseMedicinesFromExcel } from '../utils/excelUtils';
import { localDateString } from '../utils/date';

interface BulkMedicineImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BulkMedicineImportModal: React.FC<BulkMedicineImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { showToast } = useDialog();
  const { stockists, addStockist, addPurchaseInvoice, bulkImportMedicines } = usePharmacy();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importErrors, setImportErrors] = useState<{ row: number; reason: string }[]>([]);
  const [parsedImportItems, setParsedImportItems] = useState<Medicine[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace' | 'skip'>('merge');
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [importResult, setImportResult] = useState<{
    message: string;
    summary?: {
      received: number;
      created: number;
      updated: number;
      skipped: number;
      errors: number;
    };
    errors?: any[];
  } | null>(null);

  // Wholesaler Bill Import Configuration
  const [importType, setImportType] = useState<'bill' | 'catalog'>('bill');
  const [billDistributorMode, setBillDistributorMode] = useState<'existing' | 'new'>('existing');
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>('');
  const [newDistributorName, setNewDistributorName] = useState('');
  const [newDistributorPhone, setNewDistributorPhone] = useState('');
  const [newDistributorPan, setNewDistributorPan] = useState('');
  const [newDistributorCreditLimit, setNewDistributorCreditLimit] = useState<number | string>(200000);
  const [newDistributorAddress, setNewDistributorAddress] = useState('Hetauda, Makwanpur');
  const [newDistributorContactPerson, setNewDistributorContactPerson] = useState('');
  const [billInvoiceNumber, setBillInvoiceNumber] = useState('');
  const [billDate, setBillDate] = useState(() => localDateString());
  const [billPaymentMode, setBillPaymentMode] = useState<'credit' | 'cash'>('credit');
  const [billDueDate, setBillDueDate] = useState('');

  // Calculate imported purchase totals using complete packs only.
  const billCalculations = useMemo(() => {
    let subtotal = 0;
    let taxableAmount = 0;
    let totalPacks = 0;
    let totalFreePacks = 0;

    parsedImportItems.forEach(item => {
      const packs = Number(item.stockPacks) || 0;
      const free = Number(item.freePacks) || 0;
      const cost = item.costPrice > 0 ? item.costPrice : (item.mrpPrice > 0 ? item.mrpPrice : 0);

      const line = Math.round((packs * cost) * 100) / 100;

      subtotal += line;
      totalPacks += packs;
      totalFreePacks += free;
      if (item.isVatApplicable) {
        taxableAmount += line;
      }
    });

    const vatAmount = Math.round(taxableAmount * 0.13 * 100) / 100;
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      vatAmount,
      grandTotal,
      totalPacks,
      totalFreePacks
    };
  }, [parsedImportItems]);

  if (!isOpen) return null;

  const handleClose = () => {
    setParsedImportItems([]);
    setImportErrors([]);
    setImportResult(null);
    setBillInvoiceNumber('');
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportResult(null);
      const res = await parseMedicinesFromExcel(file);
      setParsedImportItems(res.success);
      setImportErrors(res.errors);

      if (res.success.length > 0) {
        const today = new Date();
        const nextMonth = new Date(today);
        nextMonth.setDate(nextMonth.getDate() + 30);
        setBillDueDate(localDateString(nextMonth));

        const sheetSuppliers = Array.from(new Set(res.success.map(item => item.supplierName?.trim()).filter(Boolean) as string[]));
        if (sheetSuppliers.length > 1) {
          setImportType('catalog');
        } else if (sheetSuppliers.length === 1) {
          const detectedSupplier = sheetSuppliers[0];
          const match = stockists.find(s => s.name.toLowerCase() === detectedSupplier.toLowerCase());
          if (match) {
            setSelectedDistributorId(match.id);
            setBillDistributorMode('existing');
          } else {
            setBillDistributorMode('new');
            setNewDistributorName(detectedSupplier);
            const detectedCredit = res.success.find(it => it.supplierCreditLimit && it.supplierCreditLimit > 0)?.supplierCreditLimit;
            if (detectedCredit) {
              setNewDistributorCreditLimit(detectedCredit);
            }
          }
        } else if (!selectedDistributorId && stockists.length > 0) {
          const firstActive = stockists.find(s => !s.status || s.status.toLowerCase() === 'active') || stockists[0];
          setSelectedDistributorId(firstActive.id);
        }
      }
    } catch (err: any) {
      setImportErrors([{ row: 0, reason: err.message || 'Failed to parse Excel file' }]);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (parsedImportItems.length === 0) return;

    try {
      setIsSubmittingImport(true);

      if (importType === 'bill') {
        if (!billInvoiceNumber.trim()) {
          showToast('Enter the actual wholesaler invoice number. The system will not fabricate one.', 'warning', 'Validation');
          return;
        }
        const invalidTraceabilityRow = parsedImportItems.findIndex(item =>
          !String(item.batchNumber || '').trim() ||
          !/^\d{4}-\d{2}-\d{2}$/.test(String(item.expiryDate || '').trim())
        );
        if (invalidTraceabilityRow >= 0) {
          showToast(`Imported row ${invalidTraceabilityRow + 1} is missing a real batch number or expiry date. Correct the source file and import again.`, 'warning', 'Validation');
          return;
        }

        let finalStockistId = selectedDistributorId;
        let finalStockistName = '';
        let finalStockistPan = '';

        if (billDistributorMode === 'new') {
          if (!newDistributorName.trim()) {
            showToast('Please specify the Distributor / Wholesaler Name.', 'warning', 'Validation');
            setIsSubmittingImport(false);
            return;
          }
          const parsedCreditLimit = Number(newDistributorCreditLimit);
          const finalCreditLimit = !isNaN(parsedCreditLimit) && parsedCreditLimit >= 0 ? parsedCreditLimit : 200000;

          const created = await addStockist({
            name: newDistributorName.trim(),
            phone: newDistributorPhone.trim() || '9800000000',
            panNumber: newDistributorPan.trim() || '',
            address: newDistributorAddress.trim() || 'Hetauda, Makwanpur',
            contactPerson: newDistributorContactPerson.trim() || '',
            creditLimit: finalCreditLimit,
            email: ''
          });
          finalStockistId = created.id;
          finalStockistName = created.name;
          finalStockistPan = created.panNumber || '';
        } else {
          const firstActive = stockists.find(s => !s.status || s.status.toLowerCase() === 'active');
          const existing = stockists.find(s => s.id === selectedDistributorId || String((s as any).distributorId) === String(selectedDistributorId)) || firstActive || stockists[0];
          if (!existing) {
            showToast('Please select or create a Distributor.', 'warning', 'Validation');
            setIsSubmittingImport(false);
            return;
          }
          finalStockistId = existing.id;
          finalStockistName = existing.name;
          finalStockistPan = existing.panNumber || '';
        }

        const invNum = billInvoiceNumber.trim();

        const invoiceItems: StockistInvoiceItem[] = parsedImportItems.map((item, idx) => {
          const packs = Number(item.stockPacks) || 0;
          const upp = Number(item.unitsPerPack) > 0 ? Number(item.unitsPerPack) : 10;
          const cost = item.costPrice > 0 ? item.costPrice : (item.mrpPrice > 0 ? item.mrpPrice : 0);
          const lineTotal = Math.round((packs * cost) * 100) / 100;
          return {
            id: `row-${Date.now()}-${idx}`,
            medicineName: item.name,
            genericName: item.genericName || '',
            category: item.category || 'Tablet',
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate || '',
            packQty: packs,
            looseUnits: 0,
            freePacks: Number(item.freePacks) || 0,
            unitsPerPack: upp,
            costPrice: cost,
            discountPercent: Number(item.discountPercent) || 0,
            isVatApplicable: Boolean(item.isVatApplicable),
            prescriptionRequired: Boolean(item.prescriptionRequired),
            mrpPrice: item.mrpPrice || (cost > 0 ? Math.round(cost * 1.25 * 100) / 100 : 0),
            rackLocation: item.rackLocation || 'Unassigned',
            lineTotal
          };
        });

        const createdInvoice = await addPurchaseInvoice({
          invoiceNumber: invNum,
          stockistId: finalStockistId,
          stockistName: finalStockistName,
          stockistPan: finalStockistPan,
          date: billDate,
          paymentMode: billPaymentMode,
          dueDate: billPaymentMode === 'credit' ? billDueDate : undefined,
          items: invoiceItems,
          subtotal: billCalculations.subtotal,
          totalDiscount: 0,
          taxableAmount: billCalculations.taxableAmount,
          vatAmount: billCalculations.vatAmount,
          grandTotal: billCalculations.grandTotal,
          paidAmount: billPaymentMode === 'cash' ? billCalculations.grandTotal : 0,
          paymentStatus: billPaymentMode === 'cash' ? 'paid' : 'pending',
          notes: `Imported via Wholesaler Bill Excel (${parsedImportItems.length} items)`
        });

        setImportResult({
          message: `Wholesaler Bill "${createdInvoice.invoiceNumber}" for ${finalStockistName} (NPR ${billCalculations.grandTotal.toLocaleString()}) recorded successfully! Stockist ledger & running balance updated, and ${invoiceItems.length} medicines added to inventory.`,
          summary: {
            received: parsedImportItems.length,
            created: parsedImportItems.length,
            updated: 0,
            skipped: 0,
            errors: 0
          }
        });
        setParsedImportItems([]);
        setImportErrors([]);
        onSuccess?.();
      } else {
        const res = await bulkImportMedicines(parsedImportItems, importMode);
        setImportResult({
          message: res.message,
          summary: res.summary,
          errors: res.data?.errors || [],
        });
        setParsedImportItems([]);
        setImportErrors([]);
        onSuccess?.();
      }
    } catch (err: any) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Bulk inventory import failed. Please verify admin privileges.',
        'error',
        'Import Error'
      );
    } finally {
      setIsSubmittingImport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl max-h-[calc(100dvh-1rem)] rounded-2xl shadow-2xl border border-slate-200 overflow-y-auto my-auto">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-bold text-base">Bulk Medicine Excel (.xlsx / .csv) Import</h3>
              <p className="text-[11px] text-slate-300">Import wholesaler purchase invoices or catalog stock directly into PostgreSQL</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {importResult ? (
          <div className="p-6 space-y-4">
            <div className="bg-emerald-50 border border-emerald-300 p-5 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 text-emerald-700" />
              </div>
              <h4 className="text-base font-bold text-emerald-900">
                Import Completed Successfully!
              </h4>
              <p className="text-xs text-emerald-800 font-medium">
                {importResult.message}
              </p>
            </div>

            {importResult.summary && (
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Processed</div>
                  <div className="text-lg font-bold text-slate-800">{importResult.summary.received}</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-emerald-600 text-[10px] uppercase font-bold">New Created</div>
                  <div className="text-lg font-bold text-emerald-800">{importResult.summary.created}</div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="text-blue-600 text-[10px] uppercase font-bold">Updated / Merged</div>
                  <div className="text-lg font-bold text-blue-800">{importResult.summary.updated}</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-amber-600 text-[10px] uppercase font-bold">Skipped</div>
                  <div className="text-lg font-bold text-amber-800">{importResult.summary.skipped}</div>
                </div>
              </div>
            )}

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
                  <span>Errors reported ({importResult.errors.length}):</span>
                </div>
                <ul className="list-disc pl-5 text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>Row {err.row}: {err.medicine ? `${err.medicine} - ` : ''}{err.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Mode Selector Tabs */}
            <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold gap-1">
              <button
                type="button"
                onClick={() => setImportType('bill')}
                className={`flex-1 py-2 px-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  importType === 'bill'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span>Wholesaler Purchase Bill (Record to Ledger &amp; Stock)</span>
              </button>
              <button
                type="button"
                onClick={() => setImportType('catalog')}
                className={`flex-1 py-2 px-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  importType === 'catalog'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Catalog / Opening Stock (No Ledger Debt)</span>
              </button>
            </div>

            {/* Wholesaler Details (for bill mode) */}
            {importType === 'bill' && (
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-teal-600" />
                    <span>Distributor / Wholesaler: *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setBillDistributorMode(billDistributorMode === 'existing' ? 'new' : 'existing')}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-800 cursor-pointer"
                  >
                    {billDistributorMode === 'existing' ? '+ Register New Distributor' : '← Pick Existing Distributor'}
                  </button>
                </div>

                {billDistributorMode === 'existing' ? (
                  <div className="space-y-2">
                    <select
                      value={selectedDistributorId}
                      onChange={(e) => setSelectedDistributorId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden"
                    >
                      {stockists.length === 0 && <option value="">No distributors registered yet (Click + Register New)</option>}
                      {stockists.map(s => {
                        const isInactive = Boolean(s.status && s.status.toLowerCase() !== 'active');
                        return (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.panNumber ? `(PAN: ${s.panNumber})` : ''} - Balance: Rs. {s.currentBalance.toLocaleString()} {isInactive ? ' • [Inactive]' : ' • [Active]'}
                          </option>
                        );
                      })}
                    </select>
                    {(() => {
                      const firstActive = stockists.find(s => !s.status || s.status.toLowerCase() === 'active');
                      const selectedStockist = stockists.find(s => s.id === selectedDistributorId || String((s as any).distributorId) === String(selectedDistributorId)) || firstActive || stockists[0];
                      if (!selectedStockist) return null;
                      const isStockistInactive = Boolean(selectedStockist.status && selectedStockist.status.toLowerCase() !== 'active');
                      const availableCredit = Math.max(0, selectedStockist.creditLimit - selectedStockist.currentBalance);
                      const isOverCredit = billPaymentMode === 'credit' && parsedImportItems.length > 0 && selectedStockist.creditLimit > 0 && billCalculations.grandTotal > availableCredit;
                      return (
                        <div className="space-y-2">
                          {isStockistInactive && (
                            <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-900 font-medium">
                              ℹ️ Distributor <strong>{selectedStockist.name}</strong> was marked inactive and will be auto-reactivated upon importing this invoice.
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-teal-50/70 border border-teal-200 text-xs">
                            <div className="flex items-center gap-3">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Credit Limit</span>
                                <span className="font-bold font-mono text-slate-800">Rs. {selectedStockist.creditLimit.toLocaleString()}</span>
                              </div>
                              <div className="h-6 w-px bg-teal-200" />
                              <div>
                                <span className="text-[10px] text-slate-500 block">Current Liability</span>
                                <span className={`font-bold font-mono ${selectedStockist.currentBalance > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                                  Rs. {selectedStockist.currentBalance.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-6 w-px bg-teal-200" />
                              <div>
                                <span className="text-[10px] text-slate-500 block">Available Credit</span>
                                <span className="font-bold font-mono text-teal-800">
                                  Rs. {availableCredit.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            {isOverCredit && (
                              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                ⚠️ Bill exceeds available credit!
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-200">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Distributor Name: *</label>
                        <input
                          type="text"
                          placeholder="e.g. ABC Pharma Distributors"
                          value={newDistributorName}
                          onChange={(e) => setNewDistributorName(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Phone Number:</label>
                        <input
                          type="text"
                          placeholder="e.g. 9845012345"
                          value={newDistributorPhone}
                          onChange={(e) => setNewDistributorPhone(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">PAN Number:</label>
                        <input
                          type="text"
                          placeholder="e.g. 601234567"
                          value={newDistributorPan}
                          onChange={(e) => setNewDistributorPan(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-[10px] font-bold text-teal-800 mb-1 flex items-center justify-between">
                          <span>Credit Limit (NPR): *</span>
                          <span className="text-[9px] text-teal-600 font-normal">Udharo Limit</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="e.g. 200000"
                          value={newDistributorCreditLimit}
                          onChange={(e) => setNewDistributorCreditLimit(e.target.value)}
                          className="w-full border border-teal-300 bg-teal-50/40 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:border-teal-600 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Depot Address:</label>
                        <input
                          type="text"
                          placeholder="e.g. Hetauda-5, Makwanpur"
                          value={newDistributorAddress}
                          onChange={(e) => setNewDistributorAddress(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Contact Person:</label>
                        <input
                          type="text"
                          placeholder="e.g. Ram Shrestha"
                          value={newDistributorContactPerson}
                          onChange={(e) => setNewDistributorContactPerson(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-200/80">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Bill / Invoice #: *</label>
                    <input
                      type="text"
                      placeholder="e.g. BILL-2081-001"
                      value={billInvoiceNumber}
                      onChange={(e) => setBillInvoiceNumber(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Bill Date:</label>
                    <input
                      type="date"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Payment Mode:</label>
                    <select
                      value={billPaymentMode}
                      onChange={(e) => setBillPaymentMode(e.target.value as 'credit' | 'cash')}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-semibold text-slate-900"
                    >
                      <option value="credit">Credit (Payable to Ledger)</option>
                      <option value="cash">Cash (Settled)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Due Date:</label>
                    <input
                      type="date"
                      value={billDueDate}
                      onChange={(e) => setBillDueDate(e.target.value)}
                      disabled={billPaymentMode === 'cash'}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-slate-900 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Drag & Drop File Zone */}
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:bg-slate-50 transition-colors">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-7 h-7 mx-auto text-slate-400 mb-1.5" />
              <p className="text-xs font-semibold text-slate-700">
                Select or drag &amp; drop your Excel / CSV invoice or catalog file
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Columns recognized: Medicine Name, Generic, Batch, Expiry, Packs, Cost Price, MRP, Rack, VAT
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2.5 px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Choose Excel File
              </button>
            </div>

            {isImporting && (
              <div className="text-center py-4 text-xs font-semibold text-teal-700">
                Parsing and validating spreadsheet rows...
              </div>
            )}

            {parsedImportItems.length > 0 && (
              <div className="space-y-3">
                {importType === 'bill' ? (
                  <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 p-4 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-teal-900 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-teal-700" />
                        <span>
                          Parsed {parsedImportItems.length} Bill Items ({billCalculations.totalPacks} Packs
                          {billCalculations.totalFreePacks > 0 ? ` + ${billCalculations.totalFreePacks} Free Bonus` : ''})
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-teal-800 font-mono">
                        {billInvoiceNumber || 'Invoice number required'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-teal-200">
                      <div className="bg-white/80 p-2 rounded-lg">
                        <div className="text-[10px] text-slate-500 font-semibold">Subtotal</div>
                        <div className="text-xs font-bold font-mono text-slate-800">Rs. {billCalculations.subtotal.toLocaleString()}</div>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg">
                        <div className="text-[10px] text-slate-500 font-semibold">13% Taxable</div>
                        <div className="text-xs font-bold font-mono text-slate-800">Rs. {billCalculations.taxableAmount.toLocaleString()}</div>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg">
                        <div className="text-[10px] text-slate-500 font-semibold">13% VAT</div>
                        <div className="text-xs font-bold font-mono text-blue-700">Rs. {billCalculations.vatAmount.toLocaleString()}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-300 shadow-2xs">
                        <div className="text-[10px] text-emerald-800 font-bold uppercase">Total Bill Value</div>
                        <div className="text-sm font-extrabold font-mono text-emerald-900">Rs. {billCalculations.grandTotal.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">Duplicate Batch Handling Mode:</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className={`p-2 rounded-lg text-left border transition-all text-[11px] cursor-pointer ${
                          importMode === 'merge'
                            ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div>Merge Stock</div>
                        <div className="text-[9px] text-slate-500 font-normal mt-0.5">Add stock &amp; keep existing details</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`p-2 rounded-lg text-left border transition-all text-[11px] cursor-pointer ${
                          importMode === 'replace'
                            ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div>Full Replace</div>
                        <div className="text-[9px] text-slate-500 font-normal mt-0.5">Overwrite record (resets unlisted fields)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('skip')}
                        className={`p-2 rounded-lg text-left border transition-all text-[11px] cursor-pointer ${
                          importMode === 'skip'
                            ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div>Skip Existing</div>
                        <div className="text-[9px] text-slate-500 font-normal mt-0.5">Keep existing records untouched</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 flex justify-between">
                    <span>Items Preview (Showing first 5 of {parsedImportItems.length})</span>
                    <span>Quantity &amp; Rate</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-[11px] p-2 bg-white">
                    {parsedImportItems.slice(0, 5).map((item, i) => (
                      <div key={i} className="py-1 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          {item.genericName && <span className="text-slate-500 ml-1">({item.genericName})</span>}
                          {item.batchNumber && <span className="text-[10px] text-slate-400 font-mono ml-1.5">[{item.batchNumber}]</span>}
                          {item.supplierName && (
                            <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1 py-0.2 rounded ml-1 font-medium">
                              🏢 {item.supplierName}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-right">
                          <span className="text-slate-700">
                            {item.stockPacks} pk
                            {Number(item.freePacks) > 0 ? (
                              <span className="text-emerald-700 font-bold ml-1">+{item.freePacks} free</span>
                            ) : ''}
                          </span>
                          {(item.costPrice > 0 || item.mrpPrice > 0) && (
                            <span className="text-teal-700 ml-2">@ Rs. {item.costPrice > 0 ? item.costPrice : item.mrpPrice}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {parsedImportItems.length > 5 && (
                      <div className="pt-1 text-slate-500 text-center italic text-[10px]">
                        ...and {parsedImportItems.length - 5} more items in this file
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
                  <span>Validation notices found ({importErrors.length}):</span>
                </div>
                <ul className="list-disc pl-5 text-[11px] space-y-0.5 max-h-28 overflow-y-auto">
                  {importErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>Row {err.row}: {err.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!importResult && (
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              disabled={isSubmittingImport}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={parsedImportItems.length === 0 || isSubmittingImport}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2"
            >
              {isSubmittingImport ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{importType === 'bill' ? 'Recording Invoice & Ledger...' : 'Saving to Database...'}</span>
                </>
              ) : importType === 'bill' ? (
                <span>Record Bill &amp; Post to Ledger (Rs. {billCalculations.grandTotal.toLocaleString()})</span>
              ) : (
                <span>Import {parsedImportItems.length} Medicines into Database</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
