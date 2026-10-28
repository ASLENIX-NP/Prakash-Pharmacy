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

  const totalStockAtCost = categorySummary.reduce((total, [, stats]) => total + stats.costVal, 0);
  const totalStockAtMrp = categorySummary.reduce((total, [, stats]) => total + stats.mrpVal, 0);
  const maxCategoryValuation = Math.max(
    1,
    ...categorySummary.flatMap(([, stats]) => [stats.costVal, stats.mrpVal])
  );
  const formatCurrency = (value: number) =>
    `Rs. ${value.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5 pb-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
              <BarChart3 className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                Accounting, VAT &amp; Stock Valuation
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                Statutory statements for Prakash Pharmacy, IRD Nepal VAT return and stock analytics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportInventoryToExcel(medicines, settings.storeName)}
            className="flex items-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Stock Valuation (.xlsx)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Net sales', value: vatSummary.netSales, detail: `After ${formatCurrency(vatSummary.totalDiscounts)} discounts`, highlight: false },
          { label: 'Output VAT', value: vatSummary.outputVat13, detail: '13% on taxable sales', highlight: false },
          { label: 'Input VAT claimable', value: vatSummary.inputVat13, detail: `On ${formatCurrency(vatSummary.purchaseTaxableBase)} purchases`, highlight: false },
          { label: 'Net VAT payable', value: vatSummary.netVatPayable, detail: 'Due to IRD Nepal', highlight: true },
          { label: 'Stock at cost', value: totalStockAtCost, detail: `${medicines.reduce((total, medicine) => total + medicine.stockPacks, 0).toLocaleString()} packs in stock`, highlight: false }
        ].map((metric) => (
          <div
            key={metric.label}
            className={`flex min-h-[150px] flex-col justify-between rounded-[20px] border p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              metric.highlight
                ? 'border-emerald-200 bg-emerald-50/80'
                : 'border-slate-200 bg-slate-50/80'
            }`}
          >
            <span className={`text-sm font-medium ${metric.highlight ? 'text-emerald-700' : 'text-slate-500'}`}>
              {metric.label}
            </span>
            <div>
              <strong className={`mt-2 block whitespace-nowrap font-sans text-[1.9rem] font-extrabold leading-none tracking-[-0.06em] tabular-nums ${
                metric.highlight ? 'text-emerald-800' : 'text-slate-900'
              }`}>
                {formatCurrency(metric.value)}
              </strong>
              <span className={`mt-2 block text-[11px] leading-relaxed ${metric.highlight ? 'text-emerald-700' : 'text-slate-500'}`}>
                {metric.detail}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Statutory IRD VAT Return Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">Nepal IRD VAT Reconciliation Return</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {settings.storeName} · PAN: {settings.panNumber || 'Not set'} · Fiscal year: {settings.fiscalYear || 'Not set'}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-[11px] font-bold text-teal-800">
            VAT Act 2052
          </span>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-200 p-4 sm:p-5 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {/* Sales Output VAT */}
          <div className="space-y-3 pb-5 lg:pb-0 lg:pr-5">
            <h4 className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-[11px] font-black text-teal-800 ring-1 ring-teal-100">A</span>
              <span>Sales &amp; Output VAT <span className="font-semibold normal-case tracking-normal text-slate-700">(बिक्री तथा कर)</span></span>
            </h4>
            <div className="space-y-0 text-xs">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5">
                <span className="text-slate-600">Total Gross Retail Sales:</span>
                <span className="whitespace-nowrap font-mono font-bold text-slate-900">Rs. {vatSummary.totalSalesGross.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5">
                <span>VAT Exempt / Free Sales (0% Essential Medicines):</span>
                <span className="whitespace-nowrap font-mono font-medium text-slate-800">Rs. {vatSummary.vatExemptSales.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5">
                <span>Taxable Base Sales (Antiseptic/Gel/Cosmetics):</span>
                <span className="whitespace-nowrap font-mono font-medium text-slate-800">Rs. {vatSummary.taxableBaseSales.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-teal-50/60 px-2.5 py-2.5 font-bold text-teal-900">
                <span>Output 13% VAT Collected from Patients:</span>
                <span className="whitespace-nowrap font-mono text-sm">Rs. {vatSummary.outputVat13.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5 text-slate-600">
                <span>Total Bill Discounts Given:</span>
                <span className="whitespace-nowrap font-mono">- Rs. {vatSummary.totalDiscounts.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 px-2.5 pt-3 font-extrabold text-slate-900">
                <span>Net Sales Realized:</span>
                <span className="whitespace-nowrap font-mono text-sm">Rs. {vatSummary.netSales.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Purchases Input VAT & Net Liability */}
          <div className="space-y-3 pt-5 lg:pt-0 lg:pl-5">
            <h4 className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-[11px] font-black text-teal-800 ring-1 ring-teal-100">B</span>
              <span>Purchases &amp; Net Liability <span className="font-semibold normal-case tracking-normal text-slate-700">(खरिद तथा खुद कर दायित्व)</span></span>
            </h4>
            <div className="space-y-0 text-xs">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5">
                <span className="text-slate-600">Total Sourced from Wholesalers:</span>
                <span className="whitespace-nowrap font-mono font-bold text-slate-900">Rs. {vatSummary.totalPurchasesGross.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5">
                <span>Taxable Purchases Base:</span>
                <span className="whitespace-nowrap font-mono font-bold">Rs. {vatSummary.purchaseTaxableBase.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-teal-50/60 px-2.5 py-2.5 font-bold text-teal-900">
                <span>Input 13% VAT Claimable:</span>
                <span className="whitespace-nowrap font-mono text-sm">Rs. {vatSummary.inputVat13.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <div className={`space-y-1.5 rounded-xl border p-4 ${
                  vatSummary.netVatPayable > 0
                    ? 'border-rose-200 bg-rose-50/70'
                    : 'border-teal-200 bg-teal-50/70'
                }`}>
                  <span className={`block text-[10px] font-bold uppercase tracking-[0.08em] ${
                    vatSummary.netVatPayable > 0 ? 'text-rose-700' : 'text-teal-700'
                  }`}>
                    Net 13% VAT Payable to IRD Nepal:
                  </span>
                  <div className={`font-mono text-2xl font-black tracking-tight ${
                    vatSummary.netVatPayable > 0 ? 'text-rose-800' : 'text-teal-800'
                  }`}>
                    Rs. {vatSummary.netVatPayable.toFixed(2)}
                  </div>
                  <span className="block text-[10px] leading-relaxed text-slate-500">
                    (= Output VAT Rs. {vatSummary.outputVat13.toFixed(2)} minus Input VAT Rs. {vatSummary.inputVat13.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Valuation Breakdown by Category */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-800 ring-1 ring-teal-100">
              <Layers className="h-4 w-4" />
            </span>
            <span>Category-Wise Inventory Valuation &amp; Stock Count</span>
          </h3>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
            Total Categories: <strong>{categorySummary.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Category Formulation</th>
                <th className="px-3 py-3.5 text-center">Medicines</th>
                <th className="px-3 py-3.5 text-center">Packs Stock</th>
                <th className="px-3 py-3.5 text-center">Cost vs MRP</th>
                <th className="px-3 py-3.5 text-right">Cost Valuation (NPR)</th>
                <th className="px-3 py-3.5 text-right">Selling MRP Valuation (NPR)</th>
                <th className="px-4 py-3.5 text-right">Estimated Gross Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categorySummary.map(([cat, stats]) => {
                const margin = stats.mrpVal > 0 ? ((stats.mrpVal - stats.costVal) / stats.mrpVal) * 100 : 0;

                return (
                  <tr key={cat} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-4 font-bold text-slate-900">{cat}</td>
                    <td className="px-3 py-4 text-center font-mono tabular-nums text-slate-600">{stats.count}</td>
                    <td className="px-3 py-4 text-center font-mono font-bold tabular-nums text-teal-800">{stats.packs} pk</td>
                    <td className="px-3 py-4">
                      <div className="mx-auto grid max-w-36 gap-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-slate-400" style={{ width: `${(stats.costVal / maxCategoryValuation) * 100}%` }} />
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-teal-600" style={{ width: `${(stats.mrpVal / maxCategoryValuation) * 100}%` }} />
                        </div>
                        <span className="sr-only">Stock valuation comparison: cost and MRP</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right font-mono tabular-nums text-slate-600">{formatCurrency(stats.costVal)}</td>
                    <td className="px-3 py-4 text-right font-mono font-bold tabular-nums text-slate-900">{formatCurrency(stats.mrpVal)}</td>
                    <td className="px-4 py-4 text-right">
                      <span className={`inline-flex rounded-md border px-2.5 py-1 font-mono font-bold ${
                        margin < 0
                          ? 'border-rose-200 bg-rose-50 text-rose-800'
                          : 'border-teal-200 bg-teal-50 text-teal-800'
                      }`}>
                        {margin > 0 ? '+' : ''}{margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 font-extrabold text-slate-900">
              <tr>
                <td className="px-4 py-4">Total</td>
                <td className="px-3 py-4 text-center font-mono tabular-nums">{medicines.length}</td>
                <td className="px-3 py-4 text-center font-mono tabular-nums text-teal-800">
                  {medicines.reduce((total, medicine) => total + medicine.stockPacks, 0)} pk
                </td>
                <td className="px-3 py-4"></td>
                <td className="px-3 py-4 text-right font-mono tabular-nums">{formatCurrency(totalStockAtCost)}</td>
                <td className="px-3 py-4 text-right font-mono tabular-nums">{formatCurrency(totalStockAtMrp)}</td>
                <td className="px-4 py-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
