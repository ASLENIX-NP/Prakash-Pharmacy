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
  X
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { Medicine, MedicineCategory } from '../types/pharmacy';
import { 
  downloadMedicineExcelTemplate, 
  parseMedicinesFromExcel, 
  exportInventoryToExcel 
} from '../utils/excelUtils';
import { decimalInputValue, digitsOnlyUpTo, preventInvalidNumberKeys } from '../utils/inputValidation';
import { RacksManagerModal } from './RacksManagerModal';

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
    racks
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

  // Add / Edit Medicine Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
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
    setFormData({
      name: '',
      genericName: '',
      category: 'Tablet',
      batchNumber: `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
      expiryDate: '2027-12-31',
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
    setShowEditModal(true);
  };

  // Handle open Edit Modal
  const handleOpenEdit = (m: Medicine) => {
    setEditingMedicine(m);
    setFormData({ ...m });
    setShowEditModal(true);
  };

  // Save Add/Edit
  const handleSaveMedicine = (e: React.FormEvent) => {
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
      const confirmed = window.confirm(
        `Medicine name and Generic / Salt name are both "${medicineName}".\n\n` +
        'This can be valid for generic medicines. Do you want to continue and save both names as entered?'
      );

      if (!confirmed) {
        return;
      }
    }

    const normalizedFormData = {
      ...formData,
      name: medicineName,
      genericName
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

    if (editingMedicine) {
      updateMedicine(
        editingMedicine.id,
        normalizedFormData
      );
    } else {
      addMedicine(
        normalizedFormData as Omit<Medicine, 'id'>
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
      const res = await bulkImportMedicines(parsedImportItems, importMode);
      setImportResult({
        message: res.message,
        summary: res.summary,
        errors: res.data?.errors || [],
      });
      setParsedImportItems([]);
      setImportErrors([]);
    } catch (err: any) {
      alert(
        err instanceof Error
          ? err.message
          : 'Bulk inventory import failed. Please verify admin privileges.'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-base">Bulk Medicine Excel (.xlsx / .csv) Import</h3>
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
                  <p className="text-xs text-emerald-700">
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
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">
                    Select or drag &amp; drop your Excel file here
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Supported formats: Microsoft Excel (.xlsx, .xls) and CSV (.csv)
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
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

                {/* Parsed summary */}
                {parsedImportItems.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs text-emerald-900 space-y-3">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-700" />
                      <span>Successfully parsed {parsedImportItems.length} medicine records ready to import!</span>
                    </div>

                    {/* Import Mode Selector */}
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

                    <div className="max-h-36 overflow-y-auto divide-y divide-emerald-100 text-[11px]">
                      {parsedImportItems.slice(0, 5).map((item, i) => (
                        <div key={i} className="py-1 flex justify-between">
                          <span>{item.name} {item.genericName ? `(${item.genericName})` : ''}</span>
                          <span className="font-mono">{item.stockPacks} packs @ Rs. {item.mrpPrice}</span>
                        </div>
                      ))}
                      {parsedImportItems.length > 5 && (
                        <div className="pt-1 text-slate-500 italic">...and {parsedImportItems.length - 5} more</div>
                      )}
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
                      <span>Saving to PostgreSQL...</span>
                    </>
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
                    onChange={(e) => setFormData({ ...formData, unitsPerPack: e.target.value === '' ? undefined : Number(digitsOnlyUpTo(e.target.value, 6)) || undefined })}
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
                    onChange={(e) => setFormData({ ...formData, stockPacks: e.target.value === '' ? undefined : Number(digitsOnlyUpTo(e.target.value, 6)) || undefined })}
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
                    onChange={(e) => setFormData({ ...formData, stockLooseUnits: e.target.value === '' ? undefined : Number(digitsOnlyUpTo(e.target.value, 6)) || undefined })}
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
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value === '' ? undefined : Number(decimalInputValue(e.target.value, 2)) || undefined })}
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
                    onChange={(e) => setFormData({ ...formData, mrpPrice: e.target.value === '' ? undefined : Number(decimalInputValue(e.target.value, 2)) || undefined })}
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
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value === '' ? undefined : Number(digitsOnlyUpTo(e.target.value, 6)) || undefined })}
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
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                    {m.category} • {m.unitsPerPack} u/pack
                  </span>
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
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${m.name} from inventory?`)) {
                          onDelete(m.id);
                        }
                      }}
                      className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
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
