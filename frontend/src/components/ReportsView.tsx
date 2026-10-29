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

      <div className="space-y-7">

        {/* Sales Summary */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-extrabold tracking-tight text-slate-900">
              Sales Summary
            </h3>
            <div className="h-px flex-1 bg-slate-200" />
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
              }
            ].map((metric) => (
              <div
                key={metric.label}
                className="flex min-h-[150px] flex-col justify-between rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  {metric.label}
                </span>

                <div>
                  <strong className="mt-3 block whitespace-nowrap font-mono text-[1.55rem] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums sm:text-[1.7rem]">
                    {formatCurrency(metric.value)}
                  </strong>

                  <span className="mt-2 block text-[11px] leading-relaxed text-slate-500">
                    {metric.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* Purchase Summary */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-extrabold tracking-tight text-slate-900">
              Purchase Summary
            </h3>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Gross purchases',
                value: vatSummary.totalPurchasesGross,
                detail: 'Before invoice discounts and VAT'
              },
              {
                label: 'Purchase without VAT',
                value: vatSummary.purchaseWithoutVat,
                detail: 'VAT exempt / 0% purchases'
              },
              {
                label: 'Purchase with VAT',
                value: vatSummary.purchaseWithVat,
                detail: `Taxable base ${formatCurrency(vatSummary.purchaseTaxableBase)} + VAT`
              },
              {
                label: 'Total purchase VAT',
                value: vatSummary.inputVat13,
                detail: 'Input VAT claimable on taxable purchases'
              }
            ].map((metric) => (
              <div
                key={metric.label}
                className="flex min-h-[150px] flex-col justify-between rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  {metric.label}
                </span>

                <div>
                  <strong className="mt-3 block whitespace-nowrap font-mono text-[1.55rem] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums sm:text-[1.7rem]">
                    {formatCurrency(metric.value)}
                  </strong>

                  <span className="mt-2 block text-[11px] leading-relaxed text-slate-500">
                    {metric.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* VAT Summary */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-extrabold tracking-tight text-slate-900">
              VAT Summary
            </h3>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="flex min-h-[150px] flex-col justify-between rounded-[20px] border border-[#103f4d] bg-[#103f4d] p-5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-100/80">
                Net VAT payable
              </span>

              <div>
                <strong className="mt-3 block whitespace-nowrap font-mono text-[1.55rem] font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-[1.7rem]">
                  {formatCurrency(vatSummary.netVatPayable)}
                </strong>

                <span className="mt-2 block text-[11px] leading-relaxed text-teal-100/75">
                  {vatSummary.vatCredit > 0
                    ? `VAT credit ${formatCurrency(vatSummary.vatCredit)}`
                    : 'Output VAT minus Input VAT'}
                </span>
              </div>
            </div>
          </div>
        </section>


        {/* Inventory Valuation */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-extrabold tracking-tight text-slate-900">
              Inventory Valuation
            </h3>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {[
              {
                label: 'Stock at cost',
                value: vatSummary.stockAtCost,
                detail: `${vatSummary.totalPacks.toLocaleString()} packs + ${vatSummary.totalLooseUnits.toLocaleString()} loose units`
              },
              {
                label: 'Stock at MRP',
                value: vatSummary.stockAtMrp,
                detail: 'Current selling-price valuation'
              }
            ].map((metric) => (
              <div
                key={metric.label}
                className="flex min-h-[150px] flex-col justify-between rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  {metric.label}
                </span>

                <div>
                  <strong className="mt-3 block whitespace-nowrap font-mono text-[1.55rem] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums sm:text-[1.7rem]">
                    {formatCurrency(metric.value)}
                  </strong>

                  <span className="mt-2 block text-[11px] leading-relaxed text-slate-500">
                    {metric.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Statutory IRD VAT Return Card */}
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-[#edf2f2] p-3 shadow-sm sm:p-4">
        <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] sm:p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-[11px] font-black text-teal-800 ring-1 ring-teal-100">A</span>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  Sales &amp; Output VAT
                </h4>
              </div>

              <div className="space-y-2 text-[12px] text-slate-700">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <span>Total Gross Retail Sales:</span>
                  <span className="font-mono font-bold text-slate-900">Rs. {vatSummary.totalSalesGross.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <span>VAT Exempt / Free Sales (0% Essential Medicines):</span>
                  <span className="font-mono">Rs. {vatSummary.vatExemptSales.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <span>Taxable Base Sales (Antiseptic/Gel/Cosmetics):</span>
                  <span className="font-mono">Rs. {vatSummary.taxableBaseSales.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md bg-teal-50 px-2 py-2 font-bold text-teal-900">
                  <span>Output 13% VAT Collected from Patients:</span>
                  <span className="font-mono">Rs. {vatSummary.outputVat13.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 text-slate-600">
                  <span>Total Bill Discounts Given:</span>
                  <span className="font-mono">- Rs. {vatSummary.totalDiscounts.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1 font-extrabold text-slate-900">
                  <span>Net Sales Realized:</span>
                  <span className="font-mono text-sm">Rs. {vatSummary.netSales.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-[11px] font-black text-teal-800 ring-1 ring-teal-100">B</span>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  Purchases &amp; Net Liability
                </h4>
              </div>

              <div className="space-y-2 text-[12px] text-slate-700">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <span>Total Sourced from Wholesalers:</span>
                  <span className="font-mono font-bold text-slate-900">Rs. {vatSummary.totalPurchasesGross.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <span>Taxable Purchases Base:</span>
                  <span className="font-mono">Rs. {vatSummary.purchaseTaxableBase.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md bg-teal-50 px-2 py-2 font-bold text-teal-900">
                  <span>Input 13% VAT Claimable:</span>
                  <span className="font-mono">Rs. {vatSummary.inputVat13.toFixed(2)}</span>
                </div>
                <div className="mt-3 rounded-[12px] border border-rose-200 bg-rose-50/80 p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-700">
                    Net 13% VAT Payable to IRD Nepal:
                  </div>
                  <div className="mt-1 font-mono text-2xl font-black tracking-tight text-rose-800">
                    Rs. {vatSummary.netVatPayable.toFixed(2)}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    (= Output VAT Rs. {vatSummary.outputVat13.toFixed(2)} minus Input VAT Rs. {vatSummary.inputVat13.toFixed(2)})
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Valuation Breakdown by Category */}
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-[#eef3f4] p-3 shadow-sm sm:p-4">
        <div className="rounded-[20px] border border-slate-200 bg-white/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-col items-center justify-center gap-2 rounded-[16px] bg-slate-100/80 px-4 py-5 text-center ring-1 ring-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Stock at cost</span>
            <strong className="font-mono text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              {formatCurrency(totalStockAtCost)}
            </strong>
            <span className="text-sm text-slate-500">
              {medicines.reduce((total, medicine) => total + medicine.stockPacks, 0).toLocaleString()} packs in stock
            </span>
          </div>

          <div className="mt-4 flex justify-center">
            <span className="rounded-full border border-[#aad7d0] bg-[#dfeef0] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0f4f54]">
              VAT Act 2052
            </span>
          </div>

          <div className="mt-4 space-y-2 rounded-[14px] border border-slate-200 bg-slate-50/80 p-3 text-center text-[12px] text-slate-700">
            <div className="font-mono">Output VAT: {formatCurrency(vatSummary.outputVat13)}</div>
            <div className="font-mono">Input VAT: {formatCurrency(vatSummary.inputVat13)}</div>
            <div className="font-mono font-bold text-slate-800">Net VAT: {formatCurrency(vatSummary.netVatPayable)}</div>
          </div>

          <div className="mt-4 flex justify-center">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-[11px] font-bold text-slate-600">
              Total Categories: <strong className="ml-1 text-slate-800">{categorySummary.length}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
