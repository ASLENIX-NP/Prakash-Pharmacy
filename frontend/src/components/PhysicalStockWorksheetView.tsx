import React, { useState, useMemo } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  PlusCircle, 
  MinusCircle, 
  History, 
  Save, 
  RotateCcw,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { exportAuditLogToExcel } from '../utils/excelUtils';
import { AuditReason } from '../types/pharmacy';

export const PhysicalStockWorksheetView: React.FC = () => {
  const { 
    medicines, 
    batchReconcileRack, 
    stockAdjustments, 
    settings,
    setActiveAuditMedicine 
  } = usePharmacy();

  const [activeSubTab, setActiveSubTab] = useState<'worksheet' | 'history'>('worksheet');
  const [selectedRack, setSelectedRack] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Local state for counts in the worksheet: medicineId -> { packs: number, loose: number, notes: string, reason: AuditReason }
  const [worksheetCounts, setWorksheetCounts] = useState<{
    [medicineId: string]: {
      packs: number;
      loose: number;
      notes: string;
      reason: AuditReason;
      isModified: boolean;
    };
  }>({});

  // Unique rack locations
  const rackLocations = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach(m => {
      if (m.rackLocation) set.add(m.rackLocation);
    });
    return Array.from(set).sort();
  }, [medicines]);

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => {
      const matchRack = selectedRack === 'All' || m.rackLocation === selectedRack;
      const matchSearch = !searchQuery || 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.genericName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.batchNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRack && matchSearch;
    });
  }, [medicines, selectedRack, searchQuery]);

  // Handle count change
  const handlePacksChange = (medId: string, val: number, defaultLoose: number) => {
    const current = worksheetCounts[medId] || {
      packs: val,
      loose: defaultLoose,
      notes: '',
      reason: 'Physical Count Audit' as AuditReason,
      isModified: true
    };
    setWorksheetCounts({
      ...worksheetCounts,
      [medId]: {
        ...current,
        packs: Math.max(0, val),
        isModified: true
      }
    });
  };

  const handleLooseChange = (medId: string, val: number, defaultPacks: number) => {
    const current = worksheetCounts[medId] || {
      packs: defaultPacks,
      loose: val,
      notes: '',
      reason: 'Physical Count Audit' as AuditReason,
      isModified: true
    };
    setWorksheetCounts({
      ...worksheetCounts,
      [medId]: {
        ...current,
        loose: Math.max(0, val),
        isModified: true
      }
    });
  };

  const handleNotesChange = (medId: string, notes: string, currentPacks: number, currentLoose: number) => {
    const current = worksheetCounts[medId] || {
      packs: currentPacks,
      loose: currentLoose,
      notes,
      reason: 'Physical Count Audit' as AuditReason,
      isModified: true
    };
    setWorksheetCounts({
      ...worksheetCounts,
      [medId]: {
        ...current,
        notes,
        isModified: true
      }
    });
  };

  const handleReasonChange = (medId: string, reason: AuditReason, currentPacks: number, currentLoose: number) => {
    const current = worksheetCounts[medId] || {
      packs: currentPacks,
      loose: currentLoose,
      notes: '',
      reason,
      isModified: true
    };
    setWorksheetCounts({
      ...worksheetCounts,
      [medId]: {
        ...current,
        reason,
        isModified: true
      }
    });
  };

  // Modified items count
  const modifiedCount = useMemo(() => {
    return Object.values(worksheetCounts).filter(item => item.isModified).length;
  }, [worksheetCounts]);

  // Bulk Apply Reconciliation
  const handleSaveAllReconciliations = () => {
    const itemsToSave: {
      medicineId: string;
      countedPacks: number;
      countedLoose: number;
      notes: string;
      reason: AuditReason;
    }[] = [];

    Object.entries(worksheetCounts).forEach(([medId, data]) => {
      if (data.isModified) {
        itemsToSave.push({
          medicineId: medId,
          countedPacks: data.packs,
          countedLoose: data.loose,
          notes: data.notes || `Shelf Batch Audit (${selectedRack})`,
          reason: data.reason || 'Physical Count Audit'
        });
      }
    });

    if (itemsToSave.length === 0) return;

    batchReconcileRack(itemsToSave);
    setWorksheetCounts({});
  };

  // Reset worksheet changes
  const handleResetWorksheet = () => {
    setWorksheetCounts({});
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Physical Stock Verification &amp; Audit Module
              </h2>
              <p className="text-xs text-slate-500">
                Audit shelf-by-shelf stock, reconcile counted tablets, and maintain IRD &amp; DDA audit trail
              </p>
            </div>
          </div>
        </div>

        {/* Tab & Export buttons */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('worksheet')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'worksheet'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Batch Shelf Worksheet
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeSubTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit History Log ({stockAdjustments.length})</span>
            </button>
          </div>

          <button
            onClick={() => exportAuditLogToExcel(stockAdjustments, settings.storeName)}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
            title="Download reconciliation records to Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit Log (.xlsx)</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'worksheet' ? (
        <div className="space-y-4">
          {/* Rack Selector & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Rack selection pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mr-1">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                Select Rack / Shelf:
              </span>
              <button
                onClick={() => setSelectedRack('All')}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  selectedRack === 'All'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Racks ({medicines.length})
              </button>
              {rackLocations.map(rack => (
                <button
                  key={rack}
                  onClick={() => setSelectedRack(rack)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    selectedRack === rack
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {rack} ({medicines.filter(m => m.rackLocation === rack).length})
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search medicine / batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Worksheet Action Bar */}
          {modifiedCount > 0 && (
            <div className="bg-teal-50 border border-teal-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-teal-900 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse"></span>
                <span>
                  <strong>{modifiedCount}</strong> medicines have modified physical counts pending reconciliation.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetWorksheet}
                  className="px-3 py-1.5 rounded-lg border border-teal-300 text-teal-800 hover:bg-teal-100 font-semibold"
                >
                  Discard Changes
                </button>
                <button
                  onClick={handleSaveAllReconciliations}
                  className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Reconcile All Modified ({modifiedCount})</span>
                </button>
              </div>
            </div>
          )}

          {/* Worksheet Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Medicine &amp; Molecule</th>
                    <th className="py-3 px-3">Batch &amp; Expiry</th>
                    <th className="py-3 px-3">Rack</th>
                    <th className="py-3 px-3">Pack Size</th>
                    <th className="py-3 px-3 bg-slate-100/70">Current System Stock</th>
                    <th className="py-3 px-3 bg-teal-50/70 text-teal-900 font-bold">Physical Count (Packs)</th>
                    <th className="py-3 px-3 bg-teal-50/70 text-teal-900 font-bold">Physical Count (Loose)</th>
                    <th className="py-3 px-3 text-right">Variance</th>
                    <th className="py-3 px-3">Audit Reason</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMedicines.map(m => {
                    const rowEntry = worksheetCounts[m.id];
                    const inputPacks = rowEntry ? rowEntry.packs : m.stockPacks;
                    const inputLoose = rowEntry ? rowEntry.loose : m.stockLooseUnits;
                    
                    const systemTotalUnits = (m.stockPacks * m.unitsPerPack) + m.stockLooseUnits;
                    const physicalTotalUnits = (inputPacks * m.unitsPerPack) + inputLoose;
                    const varianceUnits = physicalTotalUnits - systemTotalUnits;

                    return (
                      <tr 
                        key={m.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          rowEntry?.isModified ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{m.name}</div>
                          <div className="text-[11px] text-slate-500">{m.genericName}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <div>{m.batchNumber}</div>
                          <div className="text-slate-400">{m.expiryDate}</div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono">
                            {m.rackLocation}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono">
                          {m.unitsPerPack} /pk
                        </td>
                        <td className="py-3 px-3 bg-slate-50/60 font-mono">
                          <span className="font-bold text-slate-900">{m.stockPacks}</span> packs
                          {m.stockLooseUnits > 0 && (
                            <span className="text-slate-500 ml-1">+{m.stockLooseUnits} tab</span>
                          )}
                          <div className="text-[10px] text-slate-400">(= {systemTotalUnits} u)</div>
                        </td>

                        {/* Physical Packs Entry */}
                        <td className="py-2 px-3 bg-teal-50/40">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={inputPacks}
                            onChange={(e) => handlePacksChange(m.id, parseInt(e.target.value, 10) || 0, inputLoose)}
                            className="w-20 bg-white border border-teal-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                          />
                        </td>

                        {/* Physical Loose Entry */}
                        <td className="py-2 px-3 bg-teal-50/40">
                          <input
                            type="number"
                            min="0"
                            max={m.unitsPerPack - 1}
                            step="1"
                            value={inputLoose}
                            onChange={(e) => handleLooseChange(m.id, parseInt(e.target.value, 10) || 0, inputPacks)}
                            className="w-16 bg-white border border-teal-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                          />
                        </td>

                        {/* Variance Display */}
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {varianceUnits === 0 ? (
                            <span className="text-slate-400">0</span>
                          ) : varianceUnits > 0 ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              +{varianceUnits} u
                            </span>
                          ) : (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                              {varianceUnits} u
                            </span>
                          )}
                        </td>

                        {/* Reason selector if modified */}
                        <td className="py-2 px-3">
                          {rowEntry?.isModified ? (
                            <select
                              value={rowEntry.reason}
                              onChange={(e) => handleReasonChange(m.id, e.target.value as AuditReason, inputPacks, inputLoose)}
                              className="w-36 bg-white border border-slate-300 rounded text-[11px] p-1 text-slate-800 focus:outline-hidden"
                            >
                              <option value="Physical Count Audit">Physical Count Audit</option>
                              <option value="Found Unrecorded Stock / Bonus">Found Unrecorded Stock</option>
                              <option value="Damaged / Broken Strip">Damaged / Broken Strip</option>
                              <option value="Expired Medicine Disposal">Expired Disposal</option>
                              <option value="Theft / Shrinkage Loss">Theft / Shrinkage</option>
                              <option value="Other Adjustment">Other Adjustment</option>
                            </select>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveAuditMedicine(m)}
                            className="px-2 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 rounded text-[11px] font-semibold border border-slate-200 transition-colors"
                            title="Open detailed physical count modal with Quick Add / Deduce"
                          >
                            Modal View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMedicines.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        No medicines match the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Audit History Log */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-teal-700" />
              <span>Physical Count Audit &amp; Adjustment Historical Log</span>
            </h3>
            <span className="text-xs text-slate-500">
              Total Records: <strong>{stockAdjustments.length}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-3">Medicine</th>
                  <th className="py-3 px-3">Batch</th>
                  <th className="py-3 px-3">Adjustment Type</th>
                  <th className="py-3 px-3">Previous Stock</th>
                  <th className="py-3 px-3">New Stock</th>
                  <th className="py-3 px-3 text-right">Net Variance</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">Notes &amp; Auditor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockAdjustments.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{log.medicineName}</div>
                      <div className="text-[11px] text-slate-500">{log.genericName}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                      {log.batchNumber}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                        log.type === 'reconcile'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : log.type === 'add'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {log.previousPacks} pk {log.previousLoose > 0 && `+ ${log.previousLoose} tab`}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-900 font-bold">
                      {log.newPacks} pk {log.newLoose > 0 && `+ ${log.newLoose} tab`}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {log.netVarianceUnits > 0 ? (
                        <span className="text-emerald-700 font-bold">+{log.netVarianceUnits} u</span>
                      ) : log.netVarianceUnits < 0 ? (
                        <span className="text-rose-700 font-bold">{log.netVarianceUnits} u</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {log.reason}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{log.notes || '—'}</div>
                      <div className="text-[10px] text-slate-400">By: {log.recordedBy}</div>
                    </td>
                  </tr>
                ))}
                {stockAdjustments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No stock count adjustments have been recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
