import React, { useEffect, useMemo, useState } from 'react';
import { 
  Download, 
  BarChart3, 
  ShieldCheck, 
  Layers
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { exportSalesBookToExcel, exportInventoryToExcel } from '../utils/excelUtils';
import { apiRequest } from '../services/api';

type VatReportSummary = {
  sales: {
    totalGross: number;
    discounts: number;
    netSales: number;
    withoutVat: number;
    taxableBase: number;
    withVat: number;
    outputVat: number;
  };
  purchases: {
    totalGross: number;
    discounts: number;
    totalPurchases: number;
    withoutVat: number;
    taxableBase: number;
    withVat: number;
    inputVat: number;
  };
  vat: {
    outputVat: number;
    inputVat: number;
    netPayable: number;
    credit: number;
  };
  inventory: {
    stockAtCost: number;
    stockAtMrp: number;
    totalPacks: number;
    totalLooseUnits: number;
    medicineRows: number;
  };
};

const EMPTY_VAT_REPORT: VatReportSummary = {
  sales: {
    totalGross: 0,
    discounts: 0,
    netSales: 0,
    withoutVat: 0,
    taxableBase: 0,
    withVat: 0,
    outputVat: 0,
  },
  purchases: {
    totalGross: 0,
    discounts: 0,
    totalPurchases: 0,
    withoutVat: 0,
    taxableBase: 0,
    withVat: 0,
    inputVat: 0,
  },
  vat: {
    outputVat: 0,
    inputVat: 0,
    netPayable: 0,
    credit: 0,
  },
  inventory: {
    stockAtCost: 0,
    stockAtMrp: 0,
    totalPacks: 0,
    totalLooseUnits: 0,
    medicineRows: 0,
  },
};

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

  // VAT / IRD summary is calculated directly from PostgreSQL.
  const [vatReport, setVatReport] =
    useState<VatReportSummary>(
      EMPTY_VAT_REPORT
    );

  const [
    vatReportLoading,
    setVatReportLoading
  ] = useState(true);

  const [
    vatReportError,
    setVatReportError
  ] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadVatReport = async () => {
      try {
        setVatReportLoading(true);

        const response =
          await apiRequest<{
            success: boolean;
            data: VatReportSummary;
          }>('/reports/vat-summary');

        if (!cancelled) {
          setVatReport(
            response.data
          );
          setVatReportError('');
        }

      } catch (error) {
        console.error(
          'Failed to load VAT report:',
          error
        );

        if (!cancelled) {
          setVatReportError(
            error instanceof Error
              ? error.message
              : 'Failed to load VAT report from database.'
          );
        }

      } finally {
        if (!cancelled) {
          setVatReportLoading(false);
        }
      }
    };

    void loadVatReport();

    return () => {
      cancelled = true;
    };
  }, [
    salesInvoices,
    purchaseInvoices,
    medicines
  ]);

  const vatSummary = {
    totalSalesGross:
      vatReport.sales.totalGross,

    vatExemptSales:
      vatReport.sales.withoutVat,

    taxableBaseSales:
      vatReport.sales.taxableBase,

    salesWithVat:
      vatReport.sales.withVat,

    outputVat13:
      vatReport.sales.outputVat,

    totalDiscounts:
      vatReport.sales.discounts,

    netSales:
      vatReport.sales.netSales,

    totalPurchasesGross:
      vatReport.purchases.totalGross,

    purchaseDiscounts:
      vatReport.purchases.discounts,

    totalPurchases:
      vatReport.purchases.totalPurchases,

    purchaseWithoutVat:
      vatReport.purchases.withoutVat,

    purchaseTaxableBase:
      vatReport.purchases.taxableBase,

    purchaseWithVat:
      vatReport.purchases.withVat,

    inputVat13:
      vatReport.purchases.inputVat,

    netVatPayable:
      vatReport.vat.netPayable,

    vatCredit:
      vatReport.vat.credit,

    stockAtCost:
      vatReport.inventory.stockAtCost,

    stockAtMrp:
      vatReport.inventory.stockAtMrp,

    totalPacks:
      vatReport.inventory.totalPacks,

    totalLooseUnits:
      vatReport.inventory.totalLooseUnits
  };

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
    <div className="-mx-4 -my-5 space-y-5 bg-[#eef2f4] p-4 sm:-mx-6 sm:p-6 lg:-mx-7 lg:-my-7 lg:p-7">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-5 rounded-[24px] bg-[#103f4d] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:p-7">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-teal-100 ring-1 ring-white/15">
              <BarChart3 className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                Accounting, VAT &amp; Stock Valuation
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-teal-100/80 sm:text-sm">
                Statutory statements for Prakash Pharmacy, IRD Nepal VAT return and stock analytics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportInventoryToExcel(medicines, settings.storeName)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#103f4d] sm:w-auto"
          >
            <Download className="h-4 w-4" />
            <span>Export Stock Valuation (.xlsx)</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] shadow-sm">
        <span className="font-semibold text-slate-600">
          {vatReportLoading
            ? 'Refreshing report from PostgreSQL...'
            : vatReportError
              ? `Database report error: ${vatReportError}`
              : 'Live PostgreSQL report'}
        </span>

        {!vatReportLoading && !vatReportError && (
          <span className="font-medium text-teal-700">
            Sales, purchases, VAT and stock are database calculated
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Gross sales',
            value: vatSummary.totalSalesGross,
            detail: 'Before bill discounts and VAT',
            highlight: false
          },
          {
            label: 'Net sales',
            value: vatSummary.netSales,
            detail: `After ${formatCurrency(vatSummary.totalDiscounts)} discounts`,
            highlight: false
          },
          {
            label: 'Sales without VAT',
            value: vatSummary.vatExemptSales,
            detail: 'VAT exempt / 0% sales',
            highlight: false
          },
          {
            label: 'Sales with VAT',
            value: vatSummary.salesWithVat,
            detail: `Taxable base ${formatCurrency(vatSummary.taxableBaseSales)} + VAT`,
            highlight: false
          },
          {
            label: 'Total sales VAT',
            value: vatSummary.outputVat13,
            detail: 'Output VAT collected on taxable sales',
            highlight: false
          },

          {
            label: 'Gross purchases',
            value: vatSummary.totalPurchasesGross,
            detail: 'Before invoice discounts and VAT',
            highlight: false
          },
          {
            label: 'Purchase without VAT',
            value: vatSummary.purchaseWithoutVat,
            detail: 'VAT exempt / 0% purchases',
            highlight: false
          },
          {
            label: 'Purchase with VAT',
            value: vatSummary.purchaseWithVat,
            detail: `Taxable base ${formatCurrency(vatSummary.purchaseTaxableBase)} + VAT`,
            highlight: false
          },
          {
            label: 'Total purchase VAT',
            value: vatSummary.inputVat13,
            detail: 'Input VAT claimable on taxable purchases',
            highlight: false
          },

          {
            label: 'Net VAT payable',
            value: vatSummary.netVatPayable,
            detail: vatSummary.vatCredit > 0
              ? `VAT credit ${formatCurrency(vatSummary.vatCredit)}`
              : 'Output VAT minus Input VAT',
            highlight: true
          },

          {
            label: 'Stock at cost',
            value: vatSummary.stockAtCost,
            detail: `${vatSummary.totalPacks.toLocaleString()} packs + ${vatSummary.totalLooseUnits.toLocaleString()} loose units`,
            highlight: false
          },
          {
            label: 'Stock at MRP',
            value: vatSummary.stockAtMrp,
            detail: 'Current selling-price valuation',
            highlight: false
          }
        ].map((metric) => (
          <div
            key={metric.label}
            className={`flex min-h-[150px] flex-col justify-between rounded-[20px] border p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              metric.highlight
                ? 'border-[#103f4d] bg-[#103f4d]'
                : 'border-slate-200 bg-white'
            }`}
          >
            <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${metric.highlight ? 'text-teal-100/80' : 'text-slate-500'}`}>
              {metric.label}
            </span>
            <div>
              <strong className={`mt-3 block whitespace-nowrap font-mono text-[1.55rem] font-extrabold leading-none tracking-tight tabular-nums sm:text-[1.7rem] ${
                metric.highlight ? 'text-white' : 'text-slate-900'
              }`}>
                {formatCurrency(metric.value)}
              </strong>
              <span className={`mt-2 block text-[11px] leading-relaxed ${metric.highlight ? 'text-teal-100/75' : 'text-slate-500'}`}>
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
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5">
                <span>Taxable Sales Including 13% VAT:</span>
                <span className="whitespace-nowrap font-mono font-bold text-slate-900">Rs. {vatSummary.salesWithVat.toFixed(2)}</span>
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
                <span>VAT Exempt / 0% Purchases:</span>
                <span className="whitespace-nowrap font-mono font-medium text-slate-800">Rs. {vatSummary.purchaseWithoutVat.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5">
                <span>Taxable Purchases Base:</span>
                <span className="whitespace-nowrap font-mono font-bold">Rs. {vatSummary.purchaseTaxableBase.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5">
                <span>Taxable Purchases Including 13% VAT:</span>
                <span className="whitespace-nowrap font-mono font-bold text-slate-900">Rs. {vatSummary.purchaseWithVat.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-teal-50/60 px-2.5 py-2.5 font-bold text-teal-900">
                <span>Input 13% VAT Claimable:</span>
                <span className="whitespace-nowrap font-mono text-sm">Rs. {vatSummary.inputVat13.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5 text-slate-600">
                <span>Total Purchase Discounts:</span>
                <span className="whitespace-nowrap font-mono">- Rs. {vatSummary.purchaseDiscounts.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-2.5 py-2.5 font-extrabold text-slate-900">
                <span>Total Purchases Realized:</span>
                <span className="whitespace-nowrap font-mono text-sm">Rs. {vatSummary.totalPurchases.toFixed(2)}</span>
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
                    {vatSummary.vatCredit > 0 && (
                      <span className="mt-1 block font-semibold text-teal-700">
                        VAT Credit Carried Forward: Rs. {vatSummary.vatCredit.toFixed(2)}
                      </span>
                    )}
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
