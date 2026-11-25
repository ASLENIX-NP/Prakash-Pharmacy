import React, { useState, useRef } from 'react';
import { X, Building, Plus } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { useDialog } from '../context/DialogContext';
import { MedicineCategory, StockistInvoiceItem } from '../types/pharmacy';
import { localDateString } from '../utils/date';
import { parseDecimalInput, parseIntegerInput, preventInvalidNumberKeys } from '../utils/inputValidation';

const MEDICINE_CATEGORIES: MedicineCategory[] = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Ointment',
  'Cream',
  'Gel',
  'Drops',
  'Inhaler',
  'Powder',
  'Lotion',
  'Solution',
  'Suppository',
  'Patch',
  'Other'
];

interface AddMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddMedicineModal: React.FC<AddMedicineModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast, confirmDialog } = useDialog();
  const { stockists, addStockist, addPurchaseInvoice, addMedicine, racks, isAdmin } = usePharmacy();

  const [manualDistributorMode, setManualDistributorMode] = useState<'select' | 'new'>('select');
  const [manualNewDistributorName, setManualNewDistributorName] = useState('');
  const [manualNewDistributorPhone, setManualNewDistributorPhone] = useState('');
  const [manualNewDistributorPan, setManualNewDistributorPan] = useState('');
  const [manualNewDistributorCreditLimit, setManualNewDistributorCreditLimit] = useState<number | string>(200000);
  const [manualNewDistributorAddress, setManualNewDistributorAddress] = useState('Hetauda, Makwanpur');

  const [manualPurchaseInvoiceNumber, setManualPurchaseInvoiceNumber] = useState('');
  const [manualPurchaseDate, setManualPurchaseDate] = useState(() => localDateString());
  const [manualPurchasePaymentMode, setManualPurchasePaymentMode] = useState<'credit' | 'cash'>('credit');
  const [manualPurchaseDueDate, setManualPurchaseDueDate] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const saveLockRef = useRef(false);

  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    category: 'Tablet' as MedicineCategory,
    batchNumber: '',
    expiryDate: '',
    unitsPerPack: 10 as number | undefined,
    stockPacks: 0 as number | undefined,
    freePacks: 0 as number | undefined,
    costPrice: 0 as number | undefined,
    mrpPrice: 0 as number | undefined,
    supplierId: '',
    supplierName: '',
    reorderLevel: 10 as number | undefined,
    rackLocation: 'Unassigned',
    isVatApplicable: false,
    prescriptionRequired: false,
    notes: '',
  });

  if (!isOpen) return null;

  const handleResetForm = () => {
    setFormData({
      name: '',
      genericName: '',
      category: 'Tablet',
      batchNumber: '',
      expiryDate: '',
      unitsPerPack: 10,
      stockPacks: 0,
      freePacks: 0,
      costPrice: 0,
      mrpPrice: 0,
      supplierId: '',
      supplierName: '',
      reorderLevel: 10,
      rackLocation: 'Unassigned',
      isVatApplicable: false,
      prescriptionRequired: false,
      notes: '',
    });
    setManualDistributorMode('select');
    setManualNewDistributorName('');
    setManualNewDistributorPhone('');
    setManualNewDistributorPan('');
    setManualPurchaseInvoiceNumber('');
    setManualPurchaseDate(localDateString());
    setManualPurchasePaymentMode('credit');
    setManualPurchaseDueDate('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const medicineName = formData.name.trim();
    const genericName = formData.genericName.trim();

    if (!medicineName) {
      showToast('Medicine Brand Name is required.', 'warning', 'Validation');
      return;
    }

    if (genericName && medicineName.toLowerCase() === genericName.toLowerCase()) {
      const confirmed = await confirmDialog({
        title: 'Similar Names',
        message: `Medicine name and Generic / Salt name are both "${medicineName}".\n\nDo you want to continue and save both names as entered?`,
        confirmLabel: 'Save As Entered',
        cancelLabel: 'Review Names',
        type: 'warning',
      });
      if (!confirmed) return;
    }

    if (!String(formData.batchNumber || '').trim()) {
      showToast('Batch Number is required.', 'warning', 'Validation');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(formData.expiryDate || '').trim())) {
      showToast('A valid Expiry Date (YYYY-MM-DD) is required.', 'warning', 'Validation');
      return;
    }

    const unitsPerPackVal = Number(formData.unitsPerPack);
    if (!Number.isInteger(unitsPerPackVal) || unitsPerPackVal < 1) {
      showToast('Units per pack must be a positive whole number (at least 1).', 'warning', 'Validation');
      return;
    }

    const openingPacks = Number(formData.stockPacks) || 0;
    const openingFreePacks = Number(formData.freePacks) || 0;
    if (openingPacks < 0 || openingFreePacks < 0) {
      showToast('Stock packs and free packs cannot be negative.', 'warning', 'Validation');
      return;
    }

    const costPriceVal = Number(formData.costPrice);
    if (!Number.isFinite(costPriceVal) || costPriceVal < 0) {
      showToast('Purchase cost price must be 0 or greater.', 'warning', 'Validation');
      return;
    }

    const mrpPriceVal = Number(formData.mrpPrice);
    if (!Number.isFinite(mrpPriceVal) || mrpPriceVal < 0) {
      showToast('Selling price (MRP) must be 0 or greater.', 'warning', 'Validation');
      return;
    }

    const reorderLevelVal = Number(formData.reorderLevel ?? 10);
    if (!Number.isInteger(reorderLevelVal) || reorderLevelVal < 0) {
      showToast('Reorder alert level must be 0 or greater.', 'warning', 'Validation');
      return;
    }

    const totalStockUnits = Math.round((openingPacks + openingFreePacks) * unitsPerPackVal);

    // If opening stock is greater than 0, purchase accounting is required
    if (totalStockUnits > 0) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(manualPurchaseDate)) {
        showToast('A valid Purchase Date is required.', 'warning', 'Validation');
        return;
      }

      if (manualDistributorMode === 'select' && !formData.supplierId) {
        showToast('Select a Distributor / Wholesaler when adding opening stock.', 'warning', 'Purchase Accounting Required');
        return;
      }

      if (manualDistributorMode === 'new' && !manualNewDistributorName.trim()) {
        showToast('Enter the new Distributor / Wholesaler name.', 'warning', 'Purchase Accounting Required');
        return;
      }
    }

    let supplierId = formData.supplierId || '';
    let supplierName = formData.supplierName || '';
    let supplierPan = stockists.find(s => s.id === supplierId || String((s as any).distributorId) === String(supplierId))?.panNumber || '';

    if (manualDistributorMode === 'new' && manualNewDistributorName.trim()) {
      try {
        const parsedLimit = Number(manualNewDistributorCreditLimit);
        const finalCreditLimit = !isNaN(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 200000;

        const createdDist = await addStockist({
          name: manualNewDistributorName.trim(),
          phone: manualNewDistributorPhone.trim() || '9800000000',
          panNumber: manualNewDistributorPan.trim() || '',
          address: manualNewDistributorAddress.trim() || 'Hetauda, Makwanpur',
          contactPerson: '',
          creditLimit: finalCreditLimit,
          email: ''
        });

        supplierId = createdDist.id;
        supplierName = createdDist.name;
        supplierPan = createdDist.panNumber || '';
      } catch (err: any) {
        showToast(err.message || 'Failed to create new distributor', 'error', 'Distributor Error');
        return;
      }
    }

    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSaving(true);

    try {
      if (totalStockUnits > 0) {
        const supplierInvoiceProvided = manualPurchaseInvoiceNumber.trim().length > 0;
        const purchaseReference = supplierInvoiceProvided
          ? manualPurchaseInvoiceNumber.trim()
          : `INT-NOBILL-${crypto.randomUUID()}`;

        const costPerPack = costPriceVal;
        const mrpPerPack = mrpPriceVal;
        const lineTotal = Math.round((openingPacks * costPerPack) * 100) / 100;
        const isVatApplicable = Boolean(formData.isVatApplicable);
        const taxableAmount = isVatApplicable ? lineTotal : 0;
        const vatAmount = isVatApplicable ? Math.round(taxableAmount * 0.13 * 100) / 100 : 0;
        const grandTotal = Math.round((lineTotal + vatAmount) * 100) / 100;

        const invoiceItem: StockistInvoiceItem = {
          id: `manual-${Date.now()}`,
          medicineName,
          genericName: genericName || medicineName,
          category: formData.category || 'Tablet',
          batchNumber: String(formData.batchNumber).trim(),
          expiryDate: String(formData.expiryDate).trim(),
          packQty: openingPacks,
          looseUnits: 0,
          freePacks: openingFreePacks,
          unitsPerPack: unitsPerPackVal,
          costPrice: costPerPack,
          discountPercent: 0,
          isVatApplicable,
          prescriptionRequired: Boolean(formData.prescriptionRequired),
          mrpPrice: mrpPerPack,
          rackLocation: String(formData.rackLocation || 'Unassigned'),
          reorderLevel: reorderLevelVal,
          inventoryNotes: formData.notes?.trim() || undefined,
          lineTotal
        };

        const createdInvoice = await addPurchaseInvoice({
          invoiceNumber: purchaseReference,
          stockistId: supplierId,
          stockistName: supplierName,
          stockistPan: supplierPan,
          date: manualPurchaseDate,
          paymentMode: manualPurchasePaymentMode,
          dueDate: manualPurchasePaymentMode === 'credit' && manualPurchaseDueDate ? manualPurchaseDueDate : undefined,
          items: [invoiceItem],
          subtotal: lineTotal,
          totalDiscount: 0,
          taxableAmount,
          vatAmount,
          grandTotal,
          paidAmount: manualPurchasePaymentMode === 'cash' ? grandTotal : 0,
          paymentStatus: manualPurchasePaymentMode === 'cash' ? 'paid' : 'pending',
          notes: `${supplierInvoiceProvided ? '' : 'NO SUPPLIER BILL PROVIDED; internal reference only. '}Single medicine inventory entry.${formData.notes?.trim() ? ` ${formData.notes.trim()}` : ''}`
        });

        showToast(
          `${supplierInvoiceProvided ? 'Medicine added through Purchase Bill' : 'Medicine added with internal reference'} #${createdInvoice.invoiceNumber}. ${
            manualPurchasePaymentMode === 'credit'
              ? 'Supplier payable balance updated.'
              : 'Cash purchase recorded as fully settled.'
          }`,
          'success',
          'Medicine & Purchase Saved'
        );
      } else {
        // Zero stock catalog registration
        addMedicine({
          name: medicineName,
          medicineBrand: medicineName,
          genericName,
          category: formData.category,
          categoryName: formData.category,
          batchNumber: String(formData.batchNumber).trim(),
          expiryDate: String(formData.expiryDate).trim(),
          stockPacks: 0,
          freePacks: 0,
          stockLooseUnits: 0,
          unitsPerPack: unitsPerPackVal,
          unitPerPack: unitsPerPackVal,
          costPrice: costPriceVal,
          mrpPrice: mrpPriceVal,
          sellingPrice: mrpPriceVal,
          supplierId,
          supplierName,
          reorderLevel: reorderLevelVal,
          packAlertLevel: reorderLevelVal,
          rackLocation: formData.rackLocation,
          rackName: formData.rackLocation,
          isVatApplicable: Boolean(formData.isVatApplicable),
          hasvat: Boolean(formData.isVatApplicable),
          prescriptionRequired: Boolean(formData.prescriptionRequired),
          notes: formData.notes?.trim() || ''
        });

        showToast(`Medicine "${medicineName}" registered to catalog successfully!`, 'success', 'Medicine Added');
      }

      handleResetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to register medicine.', 'error', 'Save Error');
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl max-h-[calc(100dvh-1rem)] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col">
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-500/20 text-teal-400 rounded-lg">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base">Register New Medicine to Inventory</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Medicine Brand Name: *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Augmentin 625 Duo, Cetip 500mg, Pan 40"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="col-span-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Generic Salt / Molecule:
              </label>
              <input
                type="text"
                placeholder="e.g. Amoxicillin + Clavulanic Acid, Paracetamol 500mg"
                value={formData.genericName}
                onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            {/* Wholesaler Selection */}
            <div className="col-span-full bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-teal-600" />
                  <span>Distributor / Wholesaler:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setManualDistributorMode(manualDistributorMode === 'select' ? 'new' : 'select')}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-800 cursor-pointer"
                >
                  {manualDistributorMode === 'select' ? '+ Register New Distributor' : '← Pick Existing'}
                </button>
              </div>

              {manualDistributorMode === 'select' ? (
                <select
                  value={formData.supplierId}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = stockists.find(s => s.id === val || String((s as any).distributorId) === String(val));
                    setFormData({
                      ...formData,
                      supplierId: found ? found.id : val,
                      supplierName: found ? found.name : ''
                    });
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden"
                >
                  <option value="">Unassigned (No Distributor Selected)</option>
                  {stockists.map(s => {
                    const isInactive = Boolean(s.status && s.status.toLowerCase() !== 'active');
                    return (
                      <option key={s.id} value={s.id} disabled={isInactive}>
                        {s.name} {s.panNumber ? `(PAN: ${s.panNumber})` : ''} - Balance: Rs. {s.currentBalance.toLocaleString()} {isInactive ? ' • [Inactive]' : ' • [Active]'}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Distributor Name: *</label>
                    <input
                      type="text"
                      placeholder="e.g. Nepal Drug House"
                      value={manualNewDistributorName}
                      onChange={(e) => setManualNewDistributorName(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Phone:</label>
                    <input
                      type="text"
                      placeholder="98xxxxxxxx"
                      value={manualNewDistributorPhone}
                      onChange={(e) => setManualNewDistributorPhone(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 col-span-full">
                    <div>
                      <label className="block text-[10px] font-bold text-teal-800 mb-0.5">Credit Limit (NPR):</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="e.g. 200000"
                        value={manualNewDistributorCreditLimit}
                        onChange={(e) => setManualNewDistributorCreditLimit(e.target.value)}
                        className="w-full border border-teal-300 bg-teal-50/40 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Depot Address:</label>
                      <input
                        type="text"
                        placeholder="e.g. Hetauda-5, Makwanpur"
                        value={manualNewDistributorAddress}
                        onChange={(e) => setManualNewDistributorAddress(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Opening Stock Purchase Accounting */}
            <div className="col-span-full bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
              <div>
                <div className="text-xs font-bold text-amber-900">
                  Opening Stock Purchase Accounting
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  Used when opening stock is greater than zero. Credit increases wholesaler payable balance; cash is recorded as fully settled.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                    Wholesaler Invoice / Bill No (optional):
                  </label>
                  <input
                    type="text"
                    placeholder="Blank = internal reference"
                    value={manualPurchaseInvoiceNumber}
                    onChange={(e) => setManualPurchaseInvoiceNumber(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                    Purchase Date:
                  </label>
                  <input
                    type="date"
                    value={manualPurchaseDate}
                    onChange={(e) => setManualPurchaseDate(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                  Payment Mode:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualPurchasePaymentMode('credit')}
                    className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                      manualPurchasePaymentMode === 'credit'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    Credit (Udharo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualPurchasePaymentMode('cash')}
                    className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                      manualPurchasePaymentMode === 'cash'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    Cash (Nagadi)
                  </button>
                </div>
              </div>

              {manualPurchasePaymentMode === 'credit' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                    Due Date (optional):
                  </label>
                  <input
                    type="date"
                    value={manualPurchaseDueDate}
                    onChange={(e) => setManualPurchaseDueDate(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category:</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as MedicineCategory })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-hidden"
              >
                {MEDICINE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Number: *</label>
              <input
                type="text"
                required
                placeholder="e.g. BATCH-001"
                value={formData.batchNumber}
                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Doctor Prescription Required:
              </label>
              <select
                value={formData.prescriptionRequired ? 'yes' : 'no'}
                onChange={(e) => setFormData({ ...formData, prescriptionRequired: e.target.value === 'yes' })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date: *</label>
              <input
                type="date"
                required
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Units Per Pack (Strip Size): *</label>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                required
                value={formData.unitsPerPack || ''}
                onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                onChange={(e) => setFormData({ ...formData, unitsPerPack: parseIntegerInput(e.target.value, 6) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Packs In Stock:</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={formData.stockPacks ?? ''}
                onKeyDown={(event) => preventInvalidNumberKeys(event, true)}
                onChange={(e) => setFormData({ ...formData, stockPacks: parseDecimalInput(e.target.value, 2) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Free / Bonus (Packs):</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={formData.freePacks ?? ''}
                onKeyDown={(event) => preventInvalidNumberKeys(event, true)}
                onChange={(e) => setFormData({ ...formData, freePacks: parseDecimalInput(e.target.value, 2) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Cost / Pack (NPR): *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.costPrice || ''}
                onKeyDown={(event) => preventInvalidNumberKeys(event, true)}
                onChange={(e) => setFormData({ ...formData, costPrice: parseDecimalInput(e.target.value, 2) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price / MRP (NPR): *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.mrpPrice || ''}
                onKeyDown={(event) => preventInvalidNumberKeys(event, true)}
                onChange={(e) => setFormData({ ...formData, mrpPrice: parseDecimalInput(e.target.value, 2) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rack / Shelf Location:</label>
              <select
                value={formData.rackLocation || 'Unassigned'}
                onChange={(e) => setFormData({ ...formData, rackLocation: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
              >
                <option value="Unassigned">Unassigned (No rack allocated)</option>
                {racks.map(r => (
                  <option key={r.id} value={r.name}>{r.name} {r.description ? `(${r.description})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Alert Level (Packs): *</label>
              <input
                type="number"
                min="0"
                required
                value={formData.reorderLevel ?? ''}
                onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                onChange={(e) => setFormData({ ...formData, reorderLevel: parseIntegerInput(e.target.value, 6) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* VAT Classification Toggle */}
            <div className="col-span-full p-3 bg-slate-100 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="font-bold text-xs text-slate-800 block">
                  Statutory VAT Classification (Nepal IRD):
                </span>
                <span className="text-[11px] text-slate-500">
                  Essential medicines are 0% VAT Free. Antiseptic solutions, gels &amp; cosmetics are 13% VAT.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isVatApplicable: false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !formData.isVatApplicable
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-300'
                  }`}
                >
                  VAT Free (0%)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isVatApplicable: true })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    formData.isVatApplicable
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-300'
                  }`}
                >
                  13% VAT
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Medicine...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Register Medicine</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
