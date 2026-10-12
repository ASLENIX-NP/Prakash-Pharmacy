import React, { useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  BarChart3, 
  PieChart, 
  ShieldCheck, 
  Layers, 
  DollarSign, 
  AlertTriangle,
  Building2,
  Package
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { exportSalesBookToExcel, exportInventoryToExcel } from '../utils/excelUtils';

export const ReportsView: React.FC = () => {
  const { medicines, salesInvoices, purchaseInvoices, stockAdjustments, settings } = usePharmacy();

  // Category breakdown
  const categorySummary = useMemo(() => {
    const map: { [cat: string]: { count: number; packs: number; costVal: number; mrpVal: number } } = {};
    medicines.forEach(m => {
      const cat = m.category;
      if (!map[cat]) map[cat] = { count: 0, packs: 0, costVal: 0, mrpVal: 0 };
      const looseCost = m.unitsPerPack > 1 ? (m.costPrice / m.unitsPerPack) : m.costPrice;
      const looseMrp = m.unitsPerPack > 1 ? (m.mrpPrice / m.unitsPerPack) : m.mrpPrice;

      map[cat].count += 1;
      map[cat].packs += m.stockPacks;
      map[cat].costVal += (m.stockPacks * m.costPrice) + (m.stockLooseUnits * looseCost);
      map[cat].mrpVal += (m.stockPacks * m.mrpPrice) + (m.stockLooseUnits * looseMrp);
    });
    return Object.entries(map).sort((a, b) => b[1].mrpVal - a[1].mrpVal);
  }, [medicines]);

  // VAT Tax Summary for Inland Revenue Department (IRD) Nepal
  const vatSummary = useMemo(() => {
    const totalSalesGross = salesInvoices.reduce((acc, s) => acc + s.grossSubtotal, 0);
    const vatExemptSales = salesInvoices.reduce((acc, s) => acc + s.vatExemptSubtotal, 0);
    const taxableBaseSales = salesInvoices.reduce((acc, s) => acc + s.taxableBaseSubtotal, 0);
    const outputVat13 = salesInvoices.reduce((acc, s) => acc + s.vatAmount, 0);
    const totalDiscounts = salesInvoices.reduce((acc, s) => acc + s.discountAmount, 0);
    const netSales = salesInvoices.reduce((acc, s) => acc + s.grandTotal, 0);

    // Purchases input tax
    const totalPurchasesGross = purchaseInvoices.reduce((acc, p) => acc + p.subtotal, 0);
    const purchaseTaxableBase = purchaseInvoices.reduce((acc, p) => acc + p.taxableAmount, 0);
    const inputVat13 = purchaseInvoices.reduce((acc, p) => acc + p.vatAmount, 0);

    const netVatPayable = Math.max(0, outputVat13 - inputVat13);

    return {
      totalSalesGross,
      vatExemptSales,
      taxableBaseSales,
      outputVat13,
      totalDiscounts,
      netSales,
      totalPurchasesGross,
      purchaseTaxableBase,
      inputVat13,
      netVatPayable
    };
  }, [salesInvoices, purchaseInvoices]);

  // Damage & Expiry write-off analysis
  const lossSummary = useMemo(() => {
    const damagedLogs = stockAdjustments.filter(
      l => l.reason === 'Damaged / Broken Strip' || 
           l.reason === 'Expired Medicine Disposal' || 
           l.reason === 'Theft / Shrinkage Loss' ||
           l.reason === 'Breakage in Transit'
    );
    const totalLossUnits = Math.abs(damagedLogs.reduce((acc, l) => acc + l.netVarianceUnits, 0));
    return {
      count: damagedLogs.length,
      totalLossUnits
    };
  }, [stockAdjustments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Pharmacy Accounting, VAT &amp; Stock Valuation Reports
              </h2>
              <p className="text-xs text-slate-500">
                Statutory audit statements for Prakash Pharmacy, IRD Nepal VAT returns, and stock category analytics
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportInventoryToExcel(medicines, settings.storeName)}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Stock Valuation (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Statutory IRD VAT Return Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">Nepal IRD Statutory VAT Reconciliation Return</h3>
              <p className="text-[11px] text-slate-300">
                Prakash Pharmacy • PAN: {settings.panNumber} • Fiscal Year: {settings.fiscalYear}
              </p>
            </div>
          </div>
          <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
            VAT Act 2052 Compliant
          </span>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Sales Output VAT */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">
              A. Sales &amp; Output VAT (बिक्री तथा कर)
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Gross Retail Sales:</span>
                <span className="font-mono font-bold">Rs. {vatSummary.totalSalesGross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-800 bg-emerald-50 px-2 py-1 rounded">
                <span>VAT Exempt / Free Sales (0% Essential Medicines):</span>
                <span className="font-mono font-bold">Rs. {vatSummary.vatExemptSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-blue-900 bg-blue-50 px-2 py-1 rounded">
                <span>Taxable Base Sales (Antiseptic/Gel/Cosmetics):</span>
                <span className="font-mono font-bold">Rs. {vatSummary.taxableBaseSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-indigo-900 font-bold bg-indigo-50 px-2 py-1 rounded">
                <span>Output 13% VAT Collected from Patients:</span>
                <span className="font-mono text-sm">Rs. {vatSummary.outputVat13.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>Total Bill Discounts Given:</span>
                <span className="font-mono">- Rs. {vatSummary.totalDiscounts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Net Sales Realized:</span>
                <span className="font-mono text-sm">Rs. {vatSummary.netSales.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Purchases Input VAT & Net Liability */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">
              B. Purchases Input Tax &amp; Net Liability (खरिद तथा खुद कर दायित्व)
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Sourced from Wholesalers:</span>
                <span className="font-mono font-bold">Rs. {vatSummary.totalPurchasesGross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-blue-900">
                <span>Taxable Purchases Base:</span>
                <span className="font-mono font-bold">Rs. {vatSummary.purchaseTaxableBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-indigo-900 font-bold bg-indigo-50 px-2 py-1 rounded">
                <span>Input 13% VAT Claimable:</span>
                <span className="font-mono text-sm">Rs. {vatSummary.inputVat13.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="bg-white p-3 rounded-lg border-2 border-indigo-600 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 block uppercase">
                    Net 13% VAT Payable to IRD Nepal:
                  </span>
                  <div className="font-mono text-xl font-black text-indigo-800">
                    Rs. {vatSummary.netVatPayable.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    (= Output VAT Rs. {vatSummary.outputVat13.toFixed(2)} minus Input VAT Rs. {vatSummary.inputVat13.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Valuation Breakdown by Category */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-700" />
            <span>Category-Wise Inventory Valuation &amp; Stock Count</span>
          </h3>
          <span className="text-xs text-slate-500">
            Total Categories: <strong>{categorySummary.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4">Category Formulation</th>
                <th className="py-2.5 px-3 text-center">Medicines</th>
                <th className="py-2.5 px-3 text-center">Packs Stock</th>
                <th className="py-2.5 px-3 text-right">Cost Valuation (NPR)</th>
                <th className="py-2.5 px-3 text-right">Selling MRP Valuation (NPR)</th>
                <th className="py-2.5 px-4 text-right">Estimated Gross Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categorySummary.map(([cat, stats]) => {
                const margin = stats.mrpVal > 0 ? (((stats.mrpVal - stats.costVal) / stats.mrpVal) * 100).toFixed(1) : '0';

                return (
                  <tr key={cat} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{cat}</td>
                    <td className="py-3 px-3 text-center font-mono">{stats.count}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-teal-800">{stats.packs} pk</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">Rs. {stats.costVal.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">Rs. {stats.mrpVal.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">+{margin}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
