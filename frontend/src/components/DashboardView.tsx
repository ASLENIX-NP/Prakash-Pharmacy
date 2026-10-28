import React, { useMemo } from 'react';
import {
  AlertTriangle,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { ActiveTab } from './Sidebar';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const { 
    medicines, 
    salesInvoices, 
    stockists, 
    settings, 
    setActiveAuditMedicine, 
    setActiveInvoiceToPrint 
  } = usePharmacy();

  const todayStr = new Date().toISOString().split('T')[0];

  // Daily Sales KPI
  const todaySales = useMemo(() => {
    return salesInvoices.filter(s => s.date === todayStr);
  }, [salesInvoices, todayStr]);

  const todayRevenue = todaySales.reduce((acc, s) => acc + s.grandTotal, 0);
  const avgBillValue = todaySales.length > 0 ? todayRevenue / todaySales.length : 0;

  // Inventory Overview KPIs
  const totalPacks = medicines.reduce((acc, m) => acc + m.stockPacks, 0);
  const totalLooseUnits = medicines.reduce((acc, m) => acc + m.stockLooseUnits, 0);
  
  const valuationCost = medicines.reduce((acc, m) => {
    const looseCost = m.unitsPerPack > 1 ? (m.costPrice / m.unitsPerPack) : m.costPrice;
    return acc + (m.stockPacks * m.costPrice) + (m.stockLooseUnits * looseCost);
  }, 0);

  const valuationMRP = medicines.reduce((acc, m) => {
    const looseMrp = m.unitsPerPack > 1 ? (m.mrpPrice / m.unitsPerPack) : m.mrpPrice;
    return acc + (m.stockPacks * m.mrpPrice) + (m.stockLooseUnits * looseMrp);
  }, 0);

  // Low Stock Medicines
  const lowStockMedicines = useMemo(() => {
    return medicines
      .filter(m => m.stockPacks <= m.reorderLevel)
      .sort((a, b) => a.stockPacks - b.stockPacks);
  }, [medicines]);

  // Near-Expiry & Expired Medicines
  const expiryAlertMedicines = useMemo(() => {
    const nowTime = new Date().getTime();
    return medicines
      .filter(m => {
        const expTime = new Date(m.expiryDate).getTime();
        const diffMonths = (expTime - nowTime) / (1000 * 60 * 60 * 24 * 30.4);
        return diffMonths <= 6;
      })
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [medicines]);

  // Total Outstanding Payables to Stockists
  const totalPayableToStockists = stockists.reduce((acc, s) => acc + Math.max(0, s.currentBalance), 0);

  return (
    <div className="space-y-6">


      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

        {/* Today's Revenue */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_3px_14px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-[12px] font-bold text-slate-600">
              Today's Counter Revenue
            </p>

            <p className="mt-4 font-mono text-[28px] font-black leading-none tracking-tight text-slate-950">
              Rs. {todayRevenue.toFixed(2)}
            </p>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-500">
                Bills
                <strong className="ml-1.5 font-bold text-slate-800">
                  {todaySales.length}
                </strong>
              </span>

              <span className="text-right text-slate-500">
                Avg Bill
                <strong className="ml-1.5 font-bold text-slate-800">
                  Rs. {avgBillValue.toFixed(0)}
                </strong>
              </span>
            </div>
          </div>
        </div>


        {/* Inventory Valuation */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_3px_14px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-[12px] font-bold text-slate-600">
              Inventory Stock Valuation
            </p>

            <p className="mt-4 font-mono text-[28px] font-black leading-none tracking-tight text-teal-700">
              Rs. {valuationMRP.toFixed(0)}
            </p>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-500">
                Cost Basis
                <strong className="ml-1.5 font-mono font-bold text-slate-800">
                  Rs. {valuationCost.toFixed(0)}
                </strong>
              </span>

              <span className="text-right font-bold text-emerald-700">
                Margin ~
                {valuationMRP > 0
                  ? (
                      ((valuationMRP - valuationCost) /
                        valuationMRP) *
                      100
                    ).toFixed(0)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>


        {/* Active Stock */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_3px_14px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-[12px] font-bold text-slate-600">
              Active Stock Quantities
            </p>

            <div className="mt-4 flex items-end gap-2">
              <span className="font-mono text-[28px] font-black leading-none tracking-tight text-slate-950">
                {totalPacks}
              </span>

              <span className="pb-0.5 text-[12px] font-bold text-slate-500">
                Packs
              </span>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-500">
                Medicines
                <strong className="ml-1.5 font-bold text-slate-800">
                  {medicines.length}
                </strong>
              </span>

              <span className="text-right text-slate-500">
                Loose
                <strong className="ml-1.5 font-bold text-slate-800">
                  +{totalLooseUnits} tabs
                </strong>
              </span>
            </div>
          </div>
        </div>


        {/* Payables */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_3px_14px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-[12px] font-bold text-slate-600">
              Stockist Payables Balance
            </p>

            <p className="mt-4 font-mono text-[28px] font-black leading-none tracking-tight text-rose-700">
              Rs. {totalPayableToStockists.toFixed(0)}
            </p>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-500">
                Stockists
                <strong className="ml-1.5 font-bold text-slate-800">
                  {stockists.length}
                </strong>
              </span>

              <button
                type="button"
                onClick={() => setActiveTab('stockists')}
                className="font-bold text-teal-700 transition-colors hover:text-teal-900"
              >
                View Ledger ?
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Main Dual Grid: Stock & Expiry Alerts */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-stretch">

        {/* LOW STOCK */}
        <section className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:h-[365px]">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />

              <div>
                <h3 className="text-[15px] font-extrabold text-slate-900">
                  Low Stock
                </h3>

                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  {lowStockMedicines.length} item{lowStockMedicines.length === 1 ? '' : 's'} below reorder level
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className="text-[12px] font-bold text-teal-700 hover:text-teal-900"
            >
              Open Inventory &rarr;
            </button>
          </div>

          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {lowStockMedicines.slice(0, 6).map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-5 px-5 py-4 hover:bg-slate-50/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-extrabold text-slate-900">
                    {m.name}
                  </p>

                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {m.genericName}
                    <span className="mx-2 text-slate-300">&middot;</span>
                    Rack
                    <span className="ml-1 font-semibold text-slate-700">
                      {m.rackLocation}
                    </span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-mono text-[14px] font-extrabold text-rose-600">
                    {m.stockPacks} packs
                  </p>

                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Reorder at &le; {m.reorderLevel}
                  </p>
                </div>
              </div>
            ))}

            {lowStockMedicines.length === 0 && (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] font-semibold text-slate-600">
                  Stock levels are healthy.
                </p>
              </div>
            )}
          </div>
        </section>


        {/* EXPIRY WATCH */}
        <section className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:h-[365px]">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />

              <div>
                <h3 className="text-[15px] font-extrabold text-slate-900">
                  Expiry Watch
                </h3>

                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  {expiryAlertMedicines.length} item{expiryAlertMedicines.length === 1 ? '' : 's'} require attention
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('stockists')}
              className="text-[12px] font-bold text-teal-700 hover:text-teal-900"
            >
              Wholesaler Return &rarr;
            </button>
          </div>

          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {expiryAlertMedicines.slice(0, 6).map((m) => {
              const expTime = new Date(m.expiryDate).getTime();
              const nowTime = Date.now();
              const isExpired = expTime < nowTime;

              return (
                <div
                  key={m.id}
                  className="grid grid-cols-[minmax(0,1fr)_190px_108px] items-center gap-5 px-5 py-4 hover:bg-slate-50/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-slate-900">
                      {m.name}
                    </p>

                    <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
                      Batch: {m.batchNumber}
                      <span className="mx-2 text-slate-300">&middot;</span>
                      Stock: {m.stockPacks} pk
                    </p>
                  </div>

                  <div className="min-w-0 text-right">
                    <span
                      className={
                        isExpired
                          ? 'inline-flex rounded-md bg-rose-100 px-2.5 py-1 font-mono text-[11px] font-bold text-rose-700'
                          : 'inline-flex rounded-md bg-amber-50 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-700'
                      }
                    >
                      {isExpired
                        ? 'Expired'
                        : 'Expires ' + m.expiryDate}
                    </span>

                    <p
                      title={m.supplierName}
                      className="mt-1.5 truncate text-[10px] text-slate-400"
                    >
                      {m.supplierName}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveAuditMedicine(m)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                  >
                    Deduct
                  </button>
                </div>
              );
            })}

            {expiryAlertMedicines.length === 0 && (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] font-semibold text-slate-600">
                  No medicines currently require expiry attention.
                </p>
              </div>
            )}
          </div>
        </section>

      </div>





      {/* Recent Counter Bills */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-700" />
            <span>Recent Completed Bills (Today)</span>
          </h3>
          <button
            onClick={() => setActiveTab('sales_history')}
            className="text-xs font-bold text-teal-700 hover:underline"
          >
            View Complete Sales Book &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Medicines</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-4 text-right">Grand Total</th>
                <th className="py-2.5 px-3 text-right">Reprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesInvoices.slice(0, 5).map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-mono text-slate-500">{sale.time}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{sale.invoiceNumber}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{sale.customerName}</td>
                  <td className="py-2.5 px-3 text-slate-600">{sale.items.length} items</td>
                  <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-slate-600">
                    {sale.paymentMode.replace('_', ' ')}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-extrabold text-slate-900">
                    Rs. {sale.grandTotal.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setActiveInvoiceToPrint(sale)}
                      className="text-teal-700 font-bold hover:underline"
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))}
              {salesInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No counter sales completed yet today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
