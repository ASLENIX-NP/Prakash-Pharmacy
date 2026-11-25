import React, { useState, useRef, useMemo } from 'react';
import { X, Building, Plus, Receipt, PlusCircle, Gift, CheckCircle2 } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { useDialog } from '../context/DialogContext';
import { Medicine, MedicineCategory, StockistInvoiceItem } from '../types/pharmacy';
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
  const { stockists, addStockist, addPurchaseInvoice, addMedicine, racks, isAdmin, medicines } = usePharmacy();

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
  const [billDiscountValue, setBillDiscountValue] = useState<string>('');
  const [customChargeValue, setCustomChargeValue] = useState<string>('');

  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [highlightedNameIndex, setHighlightedNameIndex] = useState(-1);

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
    setBillDiscountValue('');
    setCustomChargeValue('');
    setShowNameSuggestions(false);
    setHighlightedNameIndex(-1);
  };

  // Case-insensitive medicine suggestions (only when user has typed at least 1 character)
  const getNameSuggestions = (query: string): Medicine[] => {
    const q = (query || '').trim().toLowerCase();
    if (!q || q.length < 1) {
      return [];
    }
    return (medicines || []).filter(m => {
      const name = (m.name || '').toLowerCase();
      const generic = (m.genericName || '').toLowerCase();
      return name.includes(q) || generic.includes(q);
    }).slice(0, 8);
  };

  // Pre-fill form when user explicitly selects an existing medicine (catalog identity only)
  const handleSelectSuggestedMedicine = (med: Medicine) => {
    setFormData(prev => ({
      ...prev,
      name: med.name,
      genericName: med.genericName || '',
      category: med.category || prev.category,
      unitsPerPack: med.unitsPerPack || prev.unitsPerPack || 10,
      costPrice: 0,
      mrpPrice: 0,
      stockPacks: 0,
      freePacks: 0,
      batchNumber: '',
      expiryDate: '',
      rackLocation: med.rackLocation || prev.rackLocation,
      reorderLevel: med.reorderLevel !== undefined ? med.reorderLevel : prev.reorderLevel,
      isVatApplicable: med.isVatApplicable !== undefined ? Boolean(med.isVatApplicable) : prev.isVatApplicable,
      prescriptionRequired: med.prescriptionRequired !== undefined ? Boolean(med.prescriptionRequired) : prev.prescriptionRequired,
    }));
    setShowNameSuggestions(false);
    setHighlightedNameIndex(-1);
  };

  // Check if current name matches an existing inventory medicine (case-insensitive)
  const matchedInventoryMed = useMemo(() => {
    const q = formData.name.trim().toLowerCase();
    if (!q) return null;
    return (medicines || []).find(m => (m.name || '').trim().toLowerCase() === q) || null;
  }, [formData.name, medicines]);

  // Financial computations for opening stock purchase
  const openingStockCalculations = useMemo(() => {
    const openingPacks = Math.max(0, Number(formData.stockPacks) || 0);
    const freePacks = Math.max(0, Number(formData.freePacks) || 0);
    const costPerPack = Math.max(0, Number(formData.costPrice) || 0);

    const baseAmount = Math.round(openingPacks * costPerPack * 100) / 100;

    // Flat Discount in Rs. (No percentage)
    const rawDisc = parseFloat(billDiscountValue) || 0;
    const discountAmt = Math.min(baseAmount, Math.max(0, rawDisc));
    const discountedBase = Math.max(0, baseAmount - discountAmt);

    // Custom / Additional Charge in Rs.
    const customChargeAmt = Math.max(0, parseFloat(customChargeValue) || 0);

    // 13% VAT (Nepal IRD)
    const isVatApplicable = Boolean(formData.isVatApplicable);
    const taxableAmount = isVatApplicable ? discountedBase : 0;
    const vatAmount = isVatApplicable ? Math.round(taxableAmount * 0.13 * 100) / 100 : 0;

    // Final Amount (Grand Total)
    const grandTotal = Math.round((discountedBase + customChargeAmt + vatAmount) * 100) / 100;

    const freeBonusProfitCost = Math.round(freePacks * costPerPack * 100) / 100;

    return {
      openingPacks,
      freePacks,
      costPerPack,
      baseAmount,
      discountAmt,
      customChargeAmt,
      taxableAmount,
      vatAmount,
      grandTotal,
      freeBonusProfitCost
    };
  }, [formData.stockPacks, formData.freePacks, formData.costPrice, formData.isVatApplicable, billDiscountValue, customChargeValue]);

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
        const lineTotal = openingStockCalculations.baseAmount;

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
          isVatApplicable: Boolean(formData.isVatApplicable),
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
          subtotal: openingStockCalculations.baseAmount,
          totalDiscount: openingStockCalculations.discountAmt,
          billDiscount: openingStockCalculations.discountAmt > 0 ? openingStockCalculations.discountAmt : undefined,
          billDiscountType: openingStockCalculations.discountAmt > 0 ? 'amount' : undefined,
          customCharge: openingStockCalculations.customChargeAmt > 0 ? openingStockCalculations.customChargeAmt : undefined,
          taxableAmount: openingStockCalculations.taxableAmount,
          vatAmount: openingStockCalculations.vatAmount,
          grandTotal: openingStockCalculations.grandTotal,
          paidAmount: manualPurchasePaymentMode === 'cash' ? openingStockCalculations.grandTotal : 0,
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

  if (!isOpen) return null;

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
            <div className="col-span-full relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Medicine Brand Name: *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="e.g. Augmentin 625 Duo, Cetip 500mg, Pan 40"
                  value={formData.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, name: val });
                    setShowNameSuggestions(val.trim().length > 0);
                    setHighlightedNameIndex(-1);
                  }}
                  onFocus={() => {
                    if (formData.name.trim().length > 0) {
                      setShowNameSuggestions(true);
                    }
                    setHighlightedNameIndex(-1);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowNameSuggestions(false), 200);
                  }}
                  onKeyDown={(e) => {
                    const currentSuggestions = getNameSuggestions(formData.name);
                    if (showNameSuggestions && currentSuggestions.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightedNameIndex(prev => (prev < currentSuggestions.length - 1 ? prev + 1 : 0));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightedNameIndex(prev => (prev > 0 ? prev - 1 : -1));
                      } else if (e.key === 'Enter') {
                        if (highlightedNameIndex >= 0 && currentSuggestions[highlightedNameIndex]) {
                          e.preventDefault();
                          handleSelectSuggestedMedicine(currentSuggestions[highlightedNameIndex]);
                        } else {
                          setShowNameSuggestions(false);
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowNameSuggestions(false);
                        setHighlightedNameIndex(-1);
                      }
                    }
                  }}
                  className={`w-full border rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 transition-colors focus:outline-hidden ${
                    matchedInventoryMed
                      ? 'border-teal-500 bg-teal-50/20 focus:bg-white focus:ring-2 focus:ring-teal-500'
                      : 'border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500'
                  }`}
                />

                {matchedInventoryMed ? (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-teal-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>Auto-linked to existing catalog: <strong>{matchedInventoryMed.name}</strong></span>
                    {matchedInventoryMed.genericName && (
                      <span className="text-slate-400 font-normal truncate">• {matchedInventoryMed.genericName}</span>
                    )}
                  </div>
                ) : formData.name.trim() ? (
                  <div className="mt-1 text-[10px] text-slate-400">
                    Suggests existing medicines as you type (case-insensitive)
                  </div>
                ) : null}
              </div>

              {/* Autocomplete Suggestion Dropdown */}
              {showNameSuggestions && formData.name.trim().length > 0 && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute left-0 right-0 top-[calc(100%+2px)] bg-white border border-slate-300 rounded-xl shadow-2xl z-50 divide-y divide-slate-100 overflow-hidden"
                >
                  <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                    <span>
                      {formData.name.trim()
                        ? `Matching Medicines (${getNameSuggestions(formData.name).length})`
                        : `Existing Inventory Catalog (${getNameSuggestions(formData.name).length})`}
                    </span>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowNameSuggestions(false);
                      }}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {getNameSuggestions(formData.name).length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        <p className="font-medium text-slate-700">No existing medicine matching "{formData.name}".</p>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          Continue typing to register this as a brand new medicine.
                        </p>
                      </div>
                    ) : (
                      getNameSuggestions(formData.name).map((m, sIdx) => {
                        const isHighlighted = highlightedNameIndex === sIdx;
                        return (
                          <div
                            key={m.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectSuggestedMedicine(m);
                            }}
                            onMouseEnter={() => setHighlightedNameIndex(sIdx)}
                            className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 text-left ${
                              isHighlighted ? 'bg-teal-50 border-l-4 border-teal-600' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs truncate">{m.name}</span>
                                {m.category && (
                                  <span className="text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                                    {m.category}
                                  </span>
                                )}
                              </div>
                              {m.genericName && (
                                <p className="text-[11px] text-slate-500 italic truncate">{m.genericName}</p>
                              )}
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span>Strip: {m.unitsPerPack || 10} units</span>
                                {m.rackLocation && m.rackLocation !== 'Unassigned' && (
                                  <span>• Rack: {m.rackLocation}</span>
                                )}
                                <span>• Stock: {m.stockPacks || 0} pk</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 text-xs font-mono">
                              {m.mrpPrice > 0 && (
                                <div className="font-bold text-slate-800">MRP: Rs. {m.mrpPrice}</div>
                              )}
                              {m.costPrice > 0 && (
                                <div className="text-[10px] text-slate-500">Cost: Rs. {m.costPrice}</div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
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
                    type={manualPurchaseDueDate ? "date" : "text"}
                    placeholder="YYYY-MM-DD"
                    value={manualPurchaseDueDate}
                    onFocus={(e) => { e.target.type = 'date'; try { e.target.showPicker?.(); } catch {} }}
                    onClick={(e) => { e.currentTarget.type = 'date'; try { e.currentTarget.showPicker?.(); } catch {} }}
                    onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                    onChange={(e) => setManualPurchaseDueDate(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden placeholder:text-slate-400"
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
                type={formData.expiryDate ? "date" : "text"}
                placeholder="YYYY-MM-DD"
                required
                value={formData.expiryDate}
                onFocus={(e) => { e.target.type = 'date'; try { e.target.showPicker?.(); } catch {} }}
                onClick={(e) => { e.currentTarget.type = 'date'; try { e.currentTarget.showPicker?.(); } catch {} }}
                onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden placeholder:text-slate-400"
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

            {/* Purchase Bill Discount & Custom Charge (Always Visible) */}
            <div className="col-span-full border border-amber-200 bg-amber-50/60 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-amber-700" />
                  <span>Purchase Discount &amp; Custom Charge</span>
                </span>
                <span className="text-[11px] text-amber-700 font-medium">Opening Stock Payable</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Flat Bill Discount (Rs.) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Discount (Rs.)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Flat amount</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Rs.
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={billDiscountValue}
                        onChange={(e) => setBillDiscountValue(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    {billDiscountValue && Number(billDiscountValue) > 0 && (
                      <button
                        type="button"
                        onClick={() => setBillDiscountValue('')}
                        className="text-[11px] text-rose-600 hover:underline px-1 py-1 font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {billDiscountValue && Number(billDiscountValue) > 0
                      ? `Applied: Flat Rs. ${billDiscountValue} discount on the purchase bill.`
                      : 'Enter flat discount in Rs. (if any).'}
                  </p>
                </div>

                {/* Custom / Additional Charge */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Custom Charge (Rs.)</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Freight / duty</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Rs.
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={customChargeValue}
                        onChange={(e) => setCustomChargeValue(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    {customChargeValue && Number(customChargeValue) > 0 && (
                      <button
                        type="button"
                        onClick={() => setCustomChargeValue('')}
                        className="text-[11px] text-rose-600 hover:underline px-1 py-1 font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500">
                    Applied to total bill (e.g. transport, delivery, handling).
                  </p>
                </div>
              </div>

              {/* Final Amount Financial Calculation */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-xs space-y-1.5 text-right">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Subtotal ({openingStockCalculations.openingPacks} pk × Rs. {openingStockCalculations.costPerPack.toFixed(2)}):</span>
                  <span>Rs. {openingStockCalculations.baseAmount.toFixed(2)}</span>
                </div>
                {openingStockCalculations.discountAmt > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold text-[11px]">
                    <span>Discount:</span>
                    <span>- Rs. {openingStockCalculations.discountAmt.toFixed(2)}</span>
                  </div>
                )}
                {openingStockCalculations.customChargeAmt > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold text-[11px]">
                    <span>Custom Charge:</span>
                    <span>+ Rs. {openingStockCalculations.customChargeAmt.toFixed(2)}</span>
                  </div>
                )}
                {openingStockCalculations.vatAmount > 0 && (
                  <div className="flex justify-between text-blue-700">
                    <span>13% VAT Portion:</span>
                    <span>+ Rs. {openingStockCalculations.vatAmount.toFixed(2)}</span>
                  </div>
                )}
                {openingStockCalculations.freeBonusProfitCost > 0 && (
                  <div className="flex justify-between text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-emerald-900 font-sans">
                      <Gift className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Free Scheme Profit:</span>
                    </span>
                    <span>+ Rs. {openingStockCalculations.freeBonusProfitCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-300">
                  <span>Final Amount:</span>
                  <span className="text-teal-900 text-base font-black">Rs. {openingStockCalculations.grandTotal.toFixed(2)}</span>
                </div>
                {openingStockCalculations.freePacks > 0 && (
                  <p className="text-[10px] text-emerald-700 text-right font-sans font-medium">
                    Includes {openingStockCalculations.freePacks} free pack(s) received @ Rs. 0 cost
                  </p>
                )}
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
