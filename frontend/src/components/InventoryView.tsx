import React, { useState, useMemo, useRef } from 'react';
import { 
  Layers, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Info, 
  ClipboardCheck, 
  AlertTriangle, 
  Calendar, 
  Edit3, 
  Trash2, 
  Filter, 
  Check, 
  AlertCircle,
  Tag,
  DollarSign,
  Package,
  Layers2,
  X,
  Building,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { useDialog } from '../context/DialogContext';
import { Medicine, MedicineCategory, StockistInvoiceItem } from '../types/pharmacy';
import { 
  downloadMedicineExcelTemplate, 
  parseMedicinesFromExcel, 
  exportInventoryToExcel 
} from '../utils/excelUtils';
import { decimalInputValue, digitsOnlyUpTo, parseDecimalInput, parseIntegerInput, preventInvalidNumberKeys } from '../utils/inputValidation';
import { RacksManagerModal } from './RacksManagerModal';
import { localDateString } from '../utils/date';

const MEDICINE_CATEGORIES: MedicineCategory[] = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Ointment',
  'Cream',
  'Drops',
  'Inhaler',
  'Antiseptic Solution',
  'Medicated Gel',
  'Device / Surgical',
  'OTC Cosmetic',
  'Other'
];

export const InventoryView: React.FC = () => {
  const { showToast, confirmDialog, alertDialog } = useDialog();
  const { 
    medicines, 
    addMedicine, 
    updateMedicine, 
    deleteMedicine, 
    bulkImportMedicines,
    settings,
    setActiveVatInfoMedicine,
    setActiveAuditMedicine,
    isAdmin,
    racks,
    stockists,
    addPurchaseInvoice,
    addStockist
  } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'vat13' | 'vatFree' | 'lowStock' | 'nearExpiry'>('all');
  const [viewMode, setViewMode] = useState<'generic' | 'list'>('generic');
  const [selectedRack, setSelectedRack] = useState<string>('All');
  const [showRacksModal, setShowRacksModal] = useState<boolean>(false);

  // Excel Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wholesaler Bill Import Configuration
  const [importType, setImportType] = useState<'bill' | 'catalog'>('catalog');
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

  // Add / Edit Medicine Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [manualDistributorMode, setManualDistributorMode] = useState<'select' | 'new'>('select');
  const [manualNewDistributorName, setManualNewDistributorName] = useState('');
  const [manualNewDistributorPhone, setManualNewDistributorPhone] = useState('');
  const [manualNewDistributorPan, setManualNewDistributorPan] = useState('');
  const [manualNewDistributorCreditLimit, setManualNewDistributorCreditLimit] = useState<number | string>(200000);
  const [manualNewDistributorAddress, setManualNewDistributorAddress] = useState('Hetauda, Makwanpur');
  const [formData, setFormData] = useState<Partial<Medicine>>({
    name: '',
    genericName: '',
    category: 'Tablet',
    batchNumber: '',
    expiryDate: '',
    stockPacks: undefined,
    stockLooseUnits: undefined,
    unitsPerPack: undefined,
    costPrice: undefined,
    mrpPrice: undefined,
    supplierId: '',
    supplierName: '',
    reorderLevel: undefined,
    rackLocation: 'Rack A-1',
    isVatApplicable: false,
    barcode: '',
    notes: ''
  });

  // Calculate bill totals dynamically (factoring in both full packs and loose tabs)
  const billCalculations = useMemo(() => {
    let subtotal = 0;
    let taxableAmount = 0;
    let totalPacks = 0;
    let totalLooseTabs = 0;

    parsedImportItems.forEach(item => {
      const packs = Number(item.stockPacks) || 0;
      const loose = Number(item.stockLooseUnits) || 0;
      const upp = Number(item.unitsPerPack) > 0 ? Number(item.unitsPerPack) : 10;
      const cost = item.costPrice > 0 ? item.costPrice : (item.mrpPrice > 0 ? item.mrpPrice : 0);
      
      const packCost = packs * cost;
      const looseCost = upp > 1 ? (cost / upp) : cost;
      const tabsCost = loose * looseCost;
      const line = Math.round((packCost + tabsCost) * 100) / 100;

      subtotal += line;
      totalPacks += packs;
      totalLooseTabs += loose;
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
      totalLooseTabs
    };
  }, [parsedImportItems]);

  const detectedSuppliersInImport = useMemo(() => {
    return Array.from(new Set(parsedImportItems.map(item => item.supplierName?.trim()).filter(Boolean) as string[]));
  }, [parsedImportItems]);

  // Calculate all active racks (from racks list + medicines)
  const uniqueRacks = useMemo(() => {
    const set = new Set<string>();
    racks.forEach(r => {
      if (r.name) set.add(r.name);
    });
    medicines.forEach(m => {
      if (m.rackLocation) set.add(m.rackLocation);
    });
    return Array.from(set).sort();
  }, [racks, medicines]);

  // Filter medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.batchNumber.toLowerCase().includes(q) ||
        m.rackLocation.toLowerCase().includes(q) ||
        m.supplierName.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Rack filter
      if (selectedRack !== 'All' && m.rackLocation !== selectedRack) {
        return false;
      }

      // Quick filter
      if (activeFilter === 'vat13') return m.isVatApplicable;
      if (activeFilter === 'vatFree') return !m.isVatApplicable;
      if (activeFilter === 'lowStock') return m.stockPacks <= m.reorderLevel;
      if (activeFilter === 'nearExpiry') {
        const exp = new Date(m.expiryDate).getTime();
        const now = new Date().getTime();
        const diffMonths = (exp - now) / (1000 * 60 * 60 * 24 * 30.4);
        return diffMonths <= 6;
      }

      return true;
    });
  }, [medicines, searchQuery, selectedRack, activeFilter]);

  // Group by Generic Molecule
  const genericGroups = useMemo(() => {
    const groups: { [generic: string]: Medicine[] } = {};
    filteredMedicines.forEach(m => {
      const key = m.genericName.trim() || 'General Formulations';
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return groups;
  }, [filteredMedicines]);

  // Handle open Add Modal
  const handleOpenAdd = () => {
    setEditingMedicine(null);
    setManualDistributorMode('select');
    setManualNewDistributorName('');
    setManualNewDistributorPhone('');
    setManualNewDistributorPan('');
    setFormData({
      name: '',
      genericName: '',
      category: 'Tablet',
      batchNumber: '',
      expiryDate: '',
      stockPacks: undefined,
      stockLooseUnits: undefined,
      unitsPerPack: undefined,
      costPrice: undefined,
      mrpPrice: undefined,
      supplierId: stockists[0]?.id || '',
      supplierName: stockists[0]?.name || '',
      reorderLevel: undefined,
      rackLocation: 'Rack A-1',
      isVatApplicable: false,
      barcode: '',
      notes: ''
    });
    setShowEditModal(true);
  };

  // Handle open Edit Modal
  const handleOpenEdit = (m: Medicine) => {
    setEditingMedicine(m);
    setManualDistributorMode('select');
    setManualNewDistributorName('');
    setManualNewDistributorPhone('');
    setManualNewDistributorPan('');
    setFormData({ ...m });
    setShowEditModal(true);
  };

  // Save Add/Edit
  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();

    const medicineName =
      formData.name?.trim() || '';

    const genericName =
      formData.genericName?.trim() || '';

    if (!medicineName) return;

    // Medicine/brand name and generic/salt name are allowed to be
    // identical (for example: Paracetamol / Paracetamol).
    // Warn the user, but preserve both values when confirmed.
    const normalizeName = (value: string) =>
      value
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase();

    if (
      genericName &&
      normalizeName(medicineName) === normalizeName(genericName)
    ) {
      const confirmed = await confirmDialog({
        title: 'Similar Names',
        message: `Medicine name and Generic / Salt name are both "${medicineName}".\n\nThis can be valid for generic medicines. Do you want to continue and save both names as entered?`,
        confirmLabel: 'Save As Entered',
        cancelLabel: 'Review Names',
        type: 'warning',
      });

      if (!confirmed) {
        return;
      }
    }

    if (!String(formData.batchNumber || '').trim()) {
      showToast('Batch Number is required. It will not be auto-generated.', 'warning', 'Validation');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(formData.expiryDate || '').trim())) {
      showToast('A valid Expiry Date is required.', 'warning', 'Validation');
      return;
    }

    const normalizedFormData = {
      ...formData,
      name: medicineName,
      genericName,
      batchNumber: String(formData.batchNumber).trim(),
      expiryDate: String(formData.expiryDate).trim()
    };

    const requiredNumbers = [
      formData.unitsPerPack,
      formData.stockPacks,
      formData.stockLooseUnits,
      formData.costPrice,
      formData.mrpPrice,
      formData.reorderLevel,
    ];
    if (
      requiredNumbers.some(value => value === undefined || !Number.isFinite(value)) ||
      formData.unitsPerPack! < 1 ||
      formData.stockPacks! < 0 ||
      formData.stockLooseUnits! < 0 ||
      formData.costPrice! < 0 ||
      formData.mrpPrice! < 0 ||
      formData.reorderLevel! < 1
    ) {
      return;
    }

    let supplierId = formData.supplierId || '';
    let supplierName = formData.supplierName || '';

    if (manualDistributorMode === 'new' && manualNewDistributorName.trim()) {
      try {
        const parsedCreditLimit = Number(manualNewDistributorCreditLimit);
        const finalCreditLimit = !isNaN(parsedCreditLimit) && parsedCreditLimit >= 0 ? parsedCreditLimit : 200000;
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
      } catch (err: any) {
        showToast(err.message || 'Failed to create new distributor', 'error', 'Distributor Error');
        return;
      }
    }

    const finalPayload = {
      ...normalizedFormData,
      supplierId,
      supplierName
    };

    if (editingMedicine) {
      updateMedicine(
        editingMedicine.id,
        finalPayload
      );
    } else {
      addMedicine(
        finalPayload as Omit<Medicine, 'id'>
      );
    }

    setShowEditModal(false);
  };

  // Handle Excel file selection
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

        // Auto-detect supplier from sheet if present
        const sheetSuppliers = Array.from(new Set(res.success.map(item => item.supplierName?.trim()).filter(Boolean) as string[]));
        if (sheetSuppliers.length > 1) {
          // If sheet contains medicines from multiple distributors, switch to catalog mode so individual distributors are preserved
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
          setSelectedDistributorId(stockists[0].id);
        }
      }
    } catch (err: any) {
      setImportErrors([{ row: 0, reason: err.message || 'Failed to parse Excel file' }]);
    } finally {
      setIsImporting(false);
    }
  };

  // Confirm Import (Saves directly into PostgreSQL via backend API)
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
          const existing = stockists.find(s => s.id === selectedDistributorId) || stockists[0];
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
          const loose = Number(item.stockLooseUnits) || 0;
          const upp = Number(item.unitsPerPack) > 0 ? Number(item.unitsPerPack) : 10;
          const cost = item.costPrice > 0 ? item.costPrice : (item.mrpPrice > 0 ? item.mrpPrice : 0);
          const looseCost = upp > 1 ? (cost / upp) : cost;
          const lineTotal = Math.round(((packs * cost) + (loose * looseCost)) * 100) / 100;

          return {
            id: `row-${Date.now()}-${idx}`,
            medicineName: item.name,
            genericName: item.genericName || '',
            category: item.category || 'Tablet',
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate || '',
            packQty: packs,
            looseUnits: loose,
            freePacks: 0,
            unitsPerPack: upp,
            costPrice: cost,
            discountPercent: 0,
            isVatApplicable: Boolean(item.isVatApplicable),
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
      } else {
        const res = await bulkImportMedicines(parsedImportItems, importMode);
        setImportResult({
          message: res.message,
          summary: res.summary,
          errors: res.data?.errors || [],
        });
        setParsedImportItems([]);
        setImportErrors([]);
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
    <div className="space-y-5">
      {/* Top Banner Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Inventory &amp; Generic Drug Catalog
              </h2>
              <p className="text-xs text-slate-500">
                Manage all registered medicines, stock levels, generic equivalents, and statutory VAT classifications
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => downloadMedicineExcelTemplate()}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
            title="Download pre-formatted Excel template for batch import"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel Template</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => exportInventoryToExcel(medicines, settings.storeName)}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Stock (.xlsx)</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowRacksModal(true)}
              className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Admin: Add new racks or deduce unused shelves from inventory"
            >
              <Layers className="w-3.5 h-3.5 text-purple-700" />
              <span>Admin: Add / Deduce Racks</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveFilter('all')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items ({medicines.length})
            </button>
            <button
              onClick={() => setActiveFilter('vat13')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                activeFilter === 'vat13'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <span>13% VAT Products</span>
              <span className="text-[11px] opacity-80">
                ({medicines.filter(m => m.isVatApplicable).length})
              </span>
            </button>
            <button
              onClick={() => setActiveFilter('vatFree')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                activeFilter === 'vatFree'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span>VAT Free Medicines (0%)</span>
              <span className="text-[11px] opacity-80">
                ({medicines.filter(m => !m.isVatApplicable).length})
              </span>
            </button>
            <button
              onClick={() => setActiveFilter('lowStock')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                activeFilter === 'lowStock'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span>Low Stock</span>
              <span className="text-[11px] opacity-80">
                ({medicines.filter(m => m.stockPacks <= m.reorderLevel).length})
              </span>
            </button>
            <button
              onClick={() => setActiveFilter('nearExpiry')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                activeFilter === 'nearExpiry'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span>Near Expiry</span>
              <span className="text-[11px] opacity-80">
                ({medicines.filter(m => {
                  const exp = new Date(m.expiryDate).getTime();
                  const now = new Date().getTime();
                  return (exp - now) / (1000 * 60 * 60 * 24 * 30.4) <= 6;
                }).length})
              </span>
            </button>
          </div>

          {/* View Mode Toggle: Generic grouping vs Flat List */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold">
              <button
                onClick={() => setViewMode('generic')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'generic'
                    ? 'bg-white text-teal-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Group medicines by active generic salt molecule"
              >
                <Layers2 className="w-3.5 h-3.5" />
                <span>Group by Generic</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Flat List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search & Rack Location Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by brand name, generic molecule (e.g. Paracetamol, Augmentin), batch #, or supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Rack / Shelf:</span>
            <select
              value={selectedRack}
              onChange={(e) => setSelectedRack(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="All">All Shelves ({medicines.length})</option>
              {uniqueRacks.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowRacksModal(true)}
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-1.5 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                title="Admin: Add or deduce racks"
              >
                + Racks
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table / Group Display */}
      {viewMode === 'generic' ? (
        /* GENERIC GROUP VIEW */
        <div className="space-y-4">
          {Object.entries(genericGroups).map(([genericSalt, groupMeds]) => (
            <div key={genericSalt} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Group Header */}
              <div className="bg-slate-50/90 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>{genericSalt}</span>
                      <span className="bg-teal-50 text-teal-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-teal-200">
                        {groupMeds.length} Brand{groupMeds.length > 1 ? 's' : ''} in Stock
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Alternative brands with identical therapeutic composition for clinical substitution
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500">
                  Total Available: <strong className="text-slate-900 font-mono">
                    {groupMeds.reduce((acc, curr) => acc + curr.stockPacks, 0)} packs
                  </strong>
                </div>
              </div>

              {/* Group Table */}
              <MedicineTable 
                medicines={groupMeds}
                onEdit={handleOpenEdit}
                onDelete={deleteMedicine}
                onOpenAudit={setActiveAuditMedicine}
                onOpenVatInfo={setActiveVatInfoMedicine}
              />
            </div>
          ))}

          {Object.keys(genericGroups).length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
              No medicines found matching the active search or filters.
            </div>
          )}
        </div>
      ) : (
        /* FLAT LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <MedicineTable 
            medicines={filteredMedicines}
            onEdit={handleOpenEdit}
            onDelete={deleteMedicine}
            onOpenAudit={setActiveAuditMedicine}
            onOpenVatInfo={setActiveVatInfoMedicine}
          />
          {filteredMedicines.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              No medicines found matching the active search or filters.
            </div>
          )}
        </div>
      )}

      {/* Excel Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="font-bold text-base">Bulk Medicine Excel (.xlsx / .csv) Import</h3>
                  <p className="text-[11px] text-slate-300">Import wholesaler purchase invoices or catalog stock directly into PostgreSQL</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowImportModal(false); setParsedImportItems([]); setImportErrors([]); setImportResult(null); }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* When Import is Successfully Finished */}
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

                {/* Summary stat cards */}
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

                {/* Errors if any occurred */}
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
                    onClick={() => { setShowImportModal(false); setImportResult(null); }}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Done &amp; View Updated Inventory
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
                    className={`flex-1 py-2 px-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${
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
                    className={`flex-1 py-2 px-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${
                      importType === 'catalog'
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Catalog / Opening Stock (No Ledger Debt)</span>
                  </button>
                </div>

                {/* Wholesaler & Bill Details (Shown if importType === 'bill') */}
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
                          {stockists.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} {s.panNumber ? `(PAN: ${s.panNumber})` : ''} - Balance: Rs. {s.currentBalance.toLocaleString()}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const selectedStockist = stockists.find(s => s.id === selectedDistributorId) || stockists[0];
                          if (!selectedStockist) return null;
                          const availableCredit = Math.max(0, selectedStockist.creditLimit - selectedStockist.currentBalance);
                          const isOverCredit = billPaymentMode === 'credit' && parsedImportItems.length > 0 && selectedStockist.creditLimit > 0 && billCalculations.grandTotal > availableCredit;
                          return (
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
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Depot Address / Location:</label>
                            <input
                              type="text"
                              placeholder="e.g. Hetauda-5, Makwanpur"
                              value={newDistributorAddress}
                              onChange={(e) => setNewDistributorAddress(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Contact Person / Rep:</label>
                            <input
                              type="text"
                              placeholder="e.g. Ram Shrestha"
                              value={newDistributorContactPerson}
                              onChange={(e) => setNewDistributorContactPerson(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                            />
                          </div>
                        </div>

                        {billPaymentMode === 'credit' && (
                          <div className="flex flex-wrap items-center justify-between gap-1 p-2 rounded bg-teal-50/80 border border-teal-200 text-[11px] text-teal-900">
                            <span>
                              Distributor will be registered with a credit limit of <strong>Rs. {Number(newDistributorCreditLimit || 0).toLocaleString()}</strong>.
                            </span>
                            {parsedImportItems.length > 0 && billCalculations.grandTotal > Number(newDistributorCreditLimit || 0) && (
                              <span className="text-rose-700 font-bold">
                                ⚠️ Bill (Rs. {billCalculations.grandTotal.toLocaleString()}) exceeds initial limit!
                              </span>
                            )}
                          </div>
                        )}
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

                {/* Parsing status */}
                {isImporting && (
                  <div className="text-center py-4 text-xs font-semibold text-teal-700">
                    Parsing and validating spreadsheet rows...
                  </div>
                )}

                {/* Parsed summary & Live Financial Calculation */}
                {parsedImportItems.length > 0 && (
                  <div className="space-y-3">
                    {importType === 'bill' ? (
                      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 p-4 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-teal-900 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-teal-700" />
                            <span>
                              Parsed {parsedImportItems.length} Bill Items ({billCalculations.totalPacks} Packs
                              {billCalculations.totalLooseTabs > 0 ? ` + ${billCalculations.totalLooseTabs} Tabs` : ''})
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
                        <div className="text-[11px] text-teal-900 flex items-center justify-between pt-1 border-t border-teal-100">
                          <span>Posting: <strong>{billPaymentMode === 'credit' ? 'Credit Purchase (Increases Distributor Payable)' : 'Cash Purchase (Immediate Settlement)'}</strong></span>
                          <span className="text-[10px] text-slate-500 italic">Bill value will be recorded in stockist ledger</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs text-emerald-900 space-y-3">
                        <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                          <Check className="w-4 h-4 text-emerald-700" />
                          <span>Successfully parsed {parsedImportItems.length} medicine records ready to import!</span>
                        </div>

                        {/* Import Mode Selector for Catalog */}
                        <div className="bg-white p-3 rounded-lg border border-emerald-200">
                          <label className="block text-[11px] font-bold text-slate-800 mb-1.5">
                            Duplicate Batch Handling Mode:
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setImportMode('merge')}
                              className={`p-2 rounded-lg text-left border transition-all text-[11px] ${
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
                              className={`p-2 rounded-lg text-left border transition-all text-[11px] ${
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
                              className={`p-2 rounded-lg text-left border transition-all text-[11px] ${
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
                      </div>
                    )}

                    {/* Preview Table of First Few Items */}
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
                                <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1 py-0.2 rounded ml-1 font-medium" title={`Supplier: ${item.supplierName}`}>
                                  🏢 {item.supplierName}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-right">
                              <span className="text-slate-700">
                                {item.stockPacks} pk
                                {item.stockLooseUnits && item.stockLooseUnits > 0 ? ` + ${item.stockLooseUnits} tabs` : ''}
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

                {/* Errors report */}
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
                  onClick={() => { setShowImportModal(false); setParsedImportItems([]); setImportErrors([]); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  disabled={isSubmittingImport}
                >
                  Cancel
                </button>
                <button
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
      )}

      {/* Add / Edit Medicine Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingMedicine ? 'Edit Medicine Details' : 'Register New Medicine to Inventory'}
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedicine} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
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

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Generic Salt / Molecule:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Amoxicillin + Clavulanic Acid, Paracetamol 500mg (leave blank if unassigned)"
                    value={formData.genericName}
                    onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                {/* Distributor / Wholesaler Selection */}
                <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
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
                      value={formData.supplierId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = stockists.find(s => s.id === val);
                        setFormData({
                          ...formData,
                          supplierId: val,
                          supplierName: found ? found.name : ''
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                    >
                      <option value="">Unassigned (No Distributor Selected)</option>
                      {stockists.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.panNumber ? `(PAN: ${s.panNumber})` : ''} - Balance: Rs. {s.currentBalance.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="grid grid-cols-3 gap-2">
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
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">PAN:</label>
                          <input
                            type="text"
                            placeholder="PAN Number"
                            value={manualNewDistributorPan}
                            onChange={(e) => setManualNewDistributorPan(e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Number:</label>
                  <input
                    type="text"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode / EAN:</label>
                  <input
                    type="text"
                    placeholder="e.g. 8901083001234"
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date:</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Units Per Pack (Strip Size):</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    required
                    value={formData.unitsPerPack ?? ''}
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
                    step="1"
                    inputMode="numeric"
                    required
                    value={formData.stockPacks ?? ''}
                    onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                    onChange={(e) => setFormData({ ...formData, stockPacks: parseIntegerInput(e.target.value, 6) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Loose Tablets / Units:</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    required
                    value={formData.stockLooseUnits ?? ''}
                    onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                    onChange={(e) => setFormData({ ...formData, stockLooseUnits: parseIntegerInput(e.target.value, 6) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Cost / Pack (NPR):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.costPrice ?? ''}
                    onKeyDown={(event) => preventInvalidNumberKeys(event, true)}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseDecimalInput(e.target.value, 2) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price / MRP (NPR):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.mrpPrice ?? ''}
                    onKeyDown={(event) => preventInvalidNumberKeys(event, true)}
                    onChange={(e) => setFormData({ ...formData, mrpPrice: parseDecimalInput(e.target.value, 2) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rack / Shelf Location:</label>
                  <div className="flex gap-1.5">
                    <select
                      value={formData.rackLocation || 'Unassigned'}
                      onChange={(e) => setFormData({ ...formData, rackLocation: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
                    >
                      <option value="Unassigned">Unassigned (No rack allocated)</option>
                      {racks.map(r => (
                        <option key={r.id} value={r.name}>{r.name} {r.description ? `(${r.description})` : ''}</option>
                      ))}
                      {!racks.some(r => r.name === formData.rackLocation) && formData.rackLocation && formData.rackLocation !== 'Unassigned' && (
                        <option value={formData.rackLocation}>{formData.rackLocation}</option>
                      )}
                    </select>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowRacksModal(true)}
                        className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-900 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
                        title="Admin: Add or deduce racks"
                      >
                        + Racks
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Alert Level (Packs):</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.reorderLevel ?? ''}
                    onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: parseIntegerInput(e.target.value, 6) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>

                {/* Statutory VAT Classification Toggle */}
                <div className="col-span-2 p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">
                      Statutory VAT Classification (Nepal IRD):
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Essential medicines are 0% VAT Free. Antiseptic solutions, gels &amp; cosmetics are 13% VAT.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isVatApplicable: false })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  {editingMedicine ? 'Update Medicine' : 'Save to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Racks & Shelves Manager Modal */}
      <RacksManagerModal
        isOpen={showRacksModal}
        onClose={() => setShowRacksModal(false)}
      />
    </div>
  );
};

// Sub-component: Medicine Table (Reusable for both generic groups and flat view)
interface MedicineTableProps {
  medicines: Medicine[];
  onEdit: (m: Medicine) => void;
  onDelete: (id: string) => void;
  onOpenAudit: (m: Medicine) => void;
  onOpenVatInfo: (m: Medicine) => void;
}

const MedicineTable: React.FC<MedicineTableProps> = ({
  medicines,
  onEdit,
  onDelete,
  onOpenAudit,
  onOpenVatInfo
}) => {
  const { confirmDialog } = useDialog();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
          <tr>
            <th className="py-2.5 px-4">Brand &amp; Molecule</th>
            <th className="py-2.5 px-3">Batch &amp; Expiry</th>
            <th className="py-2.5 px-3">Rack</th>
            <th className="py-2.5 px-3">Stock Available</th>
            <th className="py-2.5 px-3 text-right">Cost (NPR)</th>
            <th className="py-2.5 px-3 text-right">MRP (NPR)</th>
            <th className="py-2.5 px-3 text-center">VAT Classification</th>
            <th className="py-2.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {medicines.map(m => {
            const isLowStock = m.stockPacks <= m.reorderLevel;
            const expTime = new Date(m.expiryDate).getTime();
            const nowTime = new Date().getTime();
            const isNearExpiry = (expTime - nowTime) / (1000 * 60 * 60 * 24 * 30.4) <= 6;
            const isExpired = expTime < nowTime;
            const loosePrice = m.unitsPerPack > 1 ? (m.mrpPrice / m.unitsPerPack).toFixed(2) : m.mrpPrice.toFixed(2);

            return (
              <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900">{m.name}</div>
                  {m.genericName ? (
                    <div className="text-[11px] text-slate-500">{m.genericName}</div>
                  ) : (
                    <div className="text-[10px] text-amber-600 font-medium italic">Generic not assigned</div>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded inline-block">
                      {m.category} • {m.unitsPerPack} u/pack
                    </span>
                    {m.supplierName && (
                      <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 font-medium" title={`Distributor: ${m.supplierName}`}>
                        🏢 {m.supplierName}
                      </span>
                    )}
                  </div>
                </td>

                <td className="py-3 px-3 font-mono text-[11px]">
                  <div className="text-slate-800 font-semibold">{m.batchNumber}</div>
                  <div className={`flex items-center gap-1 ${
                    isExpired ? 'text-rose-600 font-bold' : isNearExpiry ? 'text-amber-600 font-bold' : 'text-slate-400'
                  }`}>
                    {(isExpired || isNearExpiry) && <AlertTriangle className="w-3 h-3" />}
                    <span>{m.expiryDate}</span>
                  </div>
                </td>

                <td className="py-3 px-3">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">
                    {m.rackLocation}
                  </span>
                </td>

                <td className="py-3 px-3 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold text-sm ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>
                      {m.stockPacks}
                    </span>
                    <span className="text-slate-500 text-[11px]">packs</span>
                    {m.stockLooseUnits > 0 && (
                      <span className="text-teal-700 font-bold text-[11px] bg-teal-50 px-1.5 py-0.2 rounded">
                        +{m.stockLooseUnits} tab
                      </span>
                    )}
                  </div>
                  {isLowStock && (
                    <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                      Low Stock (&le; {m.reorderLevel})
                    </span>
                  )}
                </td>

                <td className="py-3 px-3 text-right font-mono text-slate-600">
                  Rs. {m.costPrice.toFixed(2)}
                </td>

                <td className="py-3 px-3 text-right font-mono">
                  <div className="font-bold text-slate-900">Rs. {m.mrpPrice.toFixed(2)}</div>
                  {m.unitsPerPack > 1 && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      (Rs. {loosePrice} /tab)
                    </div>
                  )}
                </td>

                {/* "Click to Know" VAT Feature Badge */}
                <td className="py-3 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => onOpenVatInfo(m)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-transform active:scale-95 ${
                      m.isVatApplicable
                        ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                    title="Click to Know: View detailed VAT breakdown & statutory basis"
                  >
                    <span>{m.isVatApplicable ? '13% VAT' : 'VAT Free'}</span>
                    <Info className="w-3 h-3 text-current opacity-80" />
                  </button>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Physical Stock Count shortcut */}
                    <button
                      type="button"
                      onClick={() => onOpenAudit(m)}
                      className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg border border-teal-200 transition-colors"
                      title="Physical Stock Count: Reconcile, Add (+), or Deduce (-)"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(m)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                      title="Edit medicine details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = await confirmDialog({
                          title: `Delete ${m.name}`,
                          message: `Are you sure you want to permanently delete "${m.name}" (Batch: ${m.batchNumber}) from inventory?`,
                          confirmLabel: 'Delete Medicine',
                          cancelLabel: 'Keep Item',
                          type: 'danger',
                        });
                        if (confirmed) {
                          onDelete(m.id);
                        }
                      }}
                      className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
                      title="Delete medicine"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
