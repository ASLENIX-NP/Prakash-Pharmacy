import React, { useMemo } from 'react';
import { 
  DollarSign, 
  Package, 
  AlertTriangle, 
  Clock, 
  ShoppingCart, 
  Truck, 
  ClipboardCheck, 
  Layers, 
  ArrowUpRight, 
  TrendingUp, 
  FileText, 
  ShieldAlert, 
  Calendar,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { ActiveTab } from './Header';

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
      {/* Top Welcome & Quick Actions Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-teal-400 text-xs font-bold uppercase tracking-wider">
            Pharmacy Real-Time Operations Overview
          </span>
          <h2 className="text-2xl font-black tracking-tight mt-1">
            {settings.storeName} Dashboard
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Hetauda-5, Sanopokhara • Makwanpur • Nepal • Reg DDA: {settings.ddaLicenceNumber}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setActiveTab('physical_audit')}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl text-xs font-bold backdrop-blur-xs transition-colors"
          >
            <ClipboardCheck className="w-4 h-4 text-teal-300" />
            <span>Physical Stock Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('stockists')}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl text-xs font-bold backdrop-blur-xs transition-colors"
          >
            <Truck className="w-4 h-4 text-amber-300" />
            <span>Stockist Bills &amp; Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98]"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>New Counter Bill (POS)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Today's Counter Revenue</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-2xl font-black text-slate-900">
            Rs. {todayRevenue.toFixed(2)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Bills: <strong>{todaySales.length}</strong></span>
            <span>Avg Bill: <strong>Rs. {avgBillValue.toFixed(0)}</strong></span>
          </div>
        </div>

        {/* Stock Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Inventory Stock Valuation</span>
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-2xl font-black text-teal-800">
            Rs. {valuationMRP.toFixed(0)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Cost Basis: <strong className="font-mono">Rs. {valuationCost.toFixed(0)}</strong></span>
            <span className="text-emerald-700 font-semibold">Margin ~{valuationMRP > 0 ? (((valuationMRP - valuationCost)/valuationMRP)*100).toFixed(0) : 0}%</span>
          </div>
        </div>

        {/* Total Physical Stock Quantities */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Active Stock Quantities</span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-2xl font-black text-slate-900">
            {totalPacks} <span className="text-sm font-semibold text-slate-500">Packs</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Medicines: <strong>{medicines.length}</strong></span>
            <span>Loose: <strong>+{totalLooseUnits} tabs</strong></span>
          </div>
        </div>

        {/* Wholesaler Payables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Stockist Payables Balance</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-2xl font-black text-rose-700">
            Rs. {totalPayableToStockists.toFixed(0)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Stockists: <strong>{stockists.length}</strong></span>
            <button 
              onClick={() => setActiveTab('stockists')}
              className="text-teal-700 font-bold hover:underline"
            >
              View Ledger &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Main Dual Grid: Low Stock Alert & Near Expiry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Low Stock Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 bg-amber-50/60 border-b border-amber-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-amber-900">
                Low Stock Critical Alerts ({lowStockMedicines.length})
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 hover:underline"
            >
              Open Inventory &rarr;
            </button>
          </div>

          <div className="p-4 divide-y divide-slate-100 flex-1 overflow-y-auto max-h-72">
            {lowStockMedicines.slice(0, 6).map(m => (
              <div key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900">{m.name}</div>
                  <div className="text-[11px] text-slate-500">{m.genericName} • Location: <strong className="text-slate-700">{m.rackLocation}</strong></div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-rose-600">
                    {m.stockPacks} packs left
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Reorder at &le; {m.reorderLevel}
                  </div>
                </div>

                <button
                  onClick={() => setActiveAuditMedicine(m)}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-[11px] transition-colors"
                  title="Audit or adjust stock"
                >
                  Count Stock
                </button>
              </div>
            ))}

            {lowStockMedicines.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                All medicine stock levels are currently above reorder thresholds!
              </div>
            )}
          </div>
        </div>

        {/* 2. Expiry Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 bg-rose-50/60 border-b border-rose-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-rose-900">
                Near-Expiry &amp; Expired Alert List ({expiryAlertMedicines.length})
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('stockists')}
              className="text-xs font-bold text-rose-800 hover:text-rose-900 hover:underline"
              title="Return expired items to wholesaler"
            >
              Wholesaler Return &rarr;
            </button>
          </div>

          <div className="p-4 divide-y divide-slate-100 flex-1 overflow-y-auto max-h-72">
            {expiryAlertMedicines.slice(0, 6).map(m => {
              const expTime = new Date(m.expiryDate).getTime();
              const nowTime = new Date().getTime();
              const isExpired = expTime < nowTime;

              return (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{m.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Batch: {m.batchNumber} • Stock: {m.stockPacks} pk
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                      isExpired ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isExpired ? 'EXPIRED' : `Expires: ${m.expiryDate}`}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {m.supplierName}
                    </span>
                  </div>

                  <button
                    onClick={() => setActiveAuditMedicine(m)}
                    className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold rounded-lg text-[11px] transition-colors"
                  >
                    Deduce Stock
                  </button>
                </div>
              );
            })}

            {expiryAlertMedicines.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                No items are expiring within the next 6 months. Shelf is clean!
              </div>
            )}
          </div>
        </div>
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
