import React, { useMemo } from 'react';
import {
  AlertTriangle,
  FileText,
  ShieldAlert,
  CreditCard,
  Users,
  ArrowUpRight,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { ActiveTab } from './Sidebar';
import { localDateString } from '../utils/date';
import { SaleInvoice } from '../types/pharmacy';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const { 
    medicines, 
    salesInvoices, 
    customerSalesReturns,
    stockists, 
    settings, 
    setActiveAuditMedicine, 
    setActiveInvoiceToPrint,
    isAdmin
  } = usePharmacy();

  const todayStr = localDateString();

  // Helper to get total returns recorded against a sale invoice
  const getInvoiceReturns = (s: SaleInvoice): number => {
    if (s.salesReturns && s.salesReturns.length > 0) {
      return (s.salesReturns as Array<{ refundAmount: number }>).reduce(
        (sum: number, r: { refundAmount: number }) => sum + (r.refundAmount || 0),
        0
      );
    }
    return (customerSalesReturns || [])
      .filter((r) => r.invoiceNumber === s.invoiceNumber || String(r.invoiceId) === String(s.id))
      .reduce((sum: number, r: { refundAmount: number }) => sum + (r.refundAmount || 0), 0);
  };

  // Daily Sales & Returns KPI
  const todaySales = useMemo(() => {
    return salesInvoices.filter(s => s.date === todayStr);
  }, [salesInvoices, todayStr]);

  const todayReturns = useMemo(() => {
    return (customerSalesReturns || []).filter(r => {
      const returnDateStr = r.returnDate ? (r.returnDate.includes('T') ? r.returnDate.split('T')[0] : r.returnDate) : '';
      return returnDateStr === todayStr;
    });
  }, [customerSalesReturns, todayStr]);

  // Distinguish cash refunds from credit returns:
  // When a customer bought on credit and has not paid yet, returning items reduces their credit debt.
  // It does NOT reduce counter revenue (since no cash was ever collected).
  const { todayCashRefunds, todayCreditDebtReductions } = useMemo(() => {
    let cashRefunds = 0;
    let creditReductions = 0;

    todayReturns.forEach(r => {
      const origInv = salesInvoices.find(
        s => s.invoiceNumber === r.invoiceNumber || String(s.id) === String(r.invoiceId)
      );
      const isUnpaidCredit = origInv
        ? origInv.paymentMode === 'credit' && origInv.paymentStatus !== 'paid'
        : ((r.invoice?.paymentMethod || r.invoice?.paymentMode || '').toLowerCase() === 'credit' &&
           r.invoice?.paymentStatus !== 'paid');

      const amount = Number(r.refundAmount || 0);
      if (isUnpaidCredit) {
        creditReductions += amount;
      } else {
        cashRefunds += amount;
      }
    });

    return { todayCashRefunds: cashRefunds, todayCreditDebtReductions: creditReductions };
  }, [todayReturns, salesInvoices]);

  // Received Sales (Cash, Fonepay QR, Card, or Settled Credit)
  const todayPaidSales = useMemo(() => {
    return todaySales.filter(s => s.paymentMode !== 'credit' || s.paymentStatus === 'paid');
  }, [todaySales]);

  // Unpaid Credit Sales Today
  const todayCreditSales = useMemo(() => {
    return todaySales.filter(s => s.paymentMode === 'credit' && s.paymentStatus !== 'paid');
  }, [todaySales]);

  const todayGrossRevenue = todaySales.reduce((acc, s) => acc + s.grandTotal, 0);
  const todayGrossReceived = todayPaidSales.reduce((acc, s) => acc + s.grandTotal, 0);
  
  // Net cash counter revenue only subtracts actual cash refunds given from the drawer:
  const todayNetRevenue = Math.max(0, todayGrossReceived - todayCashRefunds);
  
  // Today's credit sales minus today's credit returns (debt reductions):
  const todayGrossCreditAmount = todayCreditSales.reduce((acc, s) => acc + s.grandTotal, 0);
  const todayCreditAmount = Math.max(0, todayGrossCreditAmount - todayCreditDebtReductions);
  const avgBillValue = todayPaidSales.length > 0 ? todayGrossReceived / todayPaidSales.length : 0;

  // All-time Outstanding Customer Credit (accounting for returns)
  const allUnpaidCreditBills = useMemo(() => {
    return salesInvoices.filter(s => s.paymentMode === 'credit' && s.paymentStatus !== 'paid');
  }, [salesInvoices]);

  const totalOutstandingCredit = useMemo(() => {
    return allUnpaidCreditBills.reduce((acc, s) => {
      const returnsTotal = getInvoiceReturns(s);
      const netDue = Math.max(0, s.grandTotal - returnsTotal - (s.cashTendered || 0));
      return acc + netDue;
    }, 0);
  }, [allUnpaidCreditBills, customerSalesReturns]);

  const activeCreditDueBills = useMemo(() => {
    return allUnpaidCreditBills.filter(s => {
      const returnsTotal = getInvoiceReturns(s);
      const netDue = Math.max(0, s.grandTotal - returnsTotal - (s.cashTendered || 0));
      return netDue > 0.01;
    });
  }, [allUnpaidCreditBills, customerSalesReturns]);

  const uniqueCreditCustomersCount = useMemo(() => {
    const names = new Set(activeCreditDueBills.map(b => (b.customerPhone || b.customerName).toLowerCase()));
    return names.size;
  }, [activeCreditDueBills]);

  // Today's Gross Profit (Admin only)
  const todayProfitData = useMemo(() => {
    let salesRevenueExVat = 0;
    let salesCogs = 0;

    todaySales.forEach(inv => {
      const subtotalRev = (inv.taxableBaseSubtotal || 0) + (inv.vatExemptSubtotal || 0);
      const revExVat = subtotalRev > 0 
        ? subtotalRev 
        : Math.max(0, (inv.grandTotal || 0) - (inv.vatAmount || 0));
      salesRevenueExVat += revExVat;

      (inv.items || []).forEach(it => {
        let cost = Number(it.costPrice) || 0;
        if (cost <= 0 && it.medicineName) {
          const match = (medicines || []).find(m => 
            m.name.toLowerCase() === it.medicineName.toLowerCase() ||
            m.id === it.medicineId
          );
          if (match) {
            cost = Number(match.costPrice) || 0;
          }
        }
        const qty = Number(it.quantity) || 0;
        const unitsPerPack = Number(it.unitsPerPack) || 1;
        const lineCost = it.isLooseUnit ? (cost / unitsPerPack) * qty : cost * qty;
        salesCogs += lineCost;
      });
    });

    // When medicines are returned, they are restocked into inventory!
    // Therefore, the cost of goods of returned items must be deducted from COGS,
    // so the business is NOT charged for the cost of restocked medicines.
    let returnedCogs = 0;
    let returnedRevenue = 0;

    todayReturns.forEach(ret => {
      // Find original invoice to check if it was an unpaid credit sale
      const origInv = salesInvoices.find(
        s => s.invoiceNumber === ret.invoiceNumber || String(s.id) === String(ret.invoiceId)
      );
      const isUnpaidCredit = origInv
        ? origInv.paymentMode === 'credit' && origInv.paymentStatus !== 'paid'
        : ((ret.invoice?.paymentMethod || ret.invoice?.paymentMode || '').toLowerCase() === 'credit' &&
           ret.invoice?.paymentStatus !== 'paid');

      // Unpaid credit returns do not affect counter cash sales/profit (they only reduce receivables)
      if (!isUnpaidCredit) {
        const refundAmt = Number(ret.refundAmount || 0);
        returnedRevenue += refundAmt;

        let retItemsCost = 0;
        (ret.items || []).forEach(it => {
          let cost = 0;
          let upp = 1;

          // 1. Match from inventory/medicines
          const match = (medicines || []).find(m => 
            m.name.toLowerCase() === (it.medicineName || '').toLowerCase() ||
            (it.inventory?.brandName && m.name.toLowerCase() === it.inventory.brandName.toLowerCase())
          );
          if (match) {
            cost = Number(match.costPrice) || 0;
            upp = Number(match.unitsPerPack) || 1;
          } else if (origInv) {
            // 2. Match from original invoice line item
            const origItem = (origInv.items || []).find(oi => 
              oi.medicineName.toLowerCase() === (it.medicineName || '').toLowerCase()
            );
            if (origItem) {
              cost = Number(origItem.costPrice) || 0;
              upp = Number(origItem.unitsPerPack) || 1;
            }
          }

          const qPack = Number(it.quantityInPack) || 0;
          const qUnit = Number(it.quantityInUnit) || 0;
          retItemsCost += (qPack * cost) + (qUnit * (cost / Math.max(1, upp)));
        });

        // Fallback: If individual batch cost is missing, estimate cost at typical cost ratio
        if (retItemsCost <= 0 && refundAmt > 0) {
          const costRatio = salesRevenueExVat > 0 ? (salesCogs / salesRevenueExVat) : 0.70;
          retItemsCost = refundAmt * costRatio;
        }

        returnedCogs += retItemsCost;
      }
    });

    const netSalesExVat = Math.max(0, salesRevenueExVat - returnedRevenue);
    const netCogs = Math.max(0, salesCogs - returnedCogs);
    const grossProfit = Math.max(0, netSalesExVat - netCogs);
    const marginPct = netSalesExVat > 0 ? (grossProfit / netSalesExVat) * 100 : 0;

    return { 
      todayCogs: netCogs, 
      grossProfit: Math.round(grossProfit * 100) / 100, 
      marginPct: Math.round(marginPct * 10) / 10 
    };
  }, [todaySales, todayReturns, salesInvoices, medicines]);

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

  // Credit Limit Alerts
  const creditAlerts = useMemo(() => {
    return stockists
      .filter(s => s.creditLimit > 0 && s.currentBalance > 0)
      .map(s => {
        const pct = (s.currentBalance / s.creditLimit) * 100;
        return { ...s, usagePct: pct };
      })
      .filter(s => s.usagePct >= 80)
      .sort((a, b) => b.usagePct - a.usagePct);
  }, [stockists]);

  return (
    <div className="space-y-6">


      {/* KPI Stats Grid */}
      <div className="dashboard-premium-kpis grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

        {/* Today's Received Counter Revenue */}
        <div className="premium-kpi-card premium-kpi-revenue rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_3px_14px_rgba(15,23,42,0.05)]">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold text-slate-600">
                Today's Counter Revenue
              </p>
              {todayCashRefunds > 0 ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">
                  Net after cash refunds
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                  Received Cash/QR
                </span>
              )}
            </div>

            <p className="mt-3 font-mono text-[28px] font-black leading-none tracking-tight text-slate-950">
              Rs. {todayNetRevenue.toFixed(2)}
            </p>

            {isAdmin && (
              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-1.5 text-xs ring-1 ring-emerald-200">
                <span className="font-semibold text-emerald-800">Today's Profit:</span>
                <span className="font-mono font-extrabold text-emerald-700">
                  + Rs. {todayProfitData.grossProfit.toFixed(2)} ({todayProfitData.marginPct.toFixed(0)}%)
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-500">
                <span>
                  Received ({todayPaidSales.length} bills):
                </span>
                <span className="font-mono font-semibold text-slate-800">Rs. {todayGrossReceived.toFixed(2)}</span>
              </div>
              {todayCashRefunds > 0 && (
                <div className="flex items-center justify-between font-medium text-rose-600">
                  <span>Cash Refunds:</span>
                  <span className="font-mono font-bold">- Rs. {todayCashRefunds.toFixed(2)}</span>
                </div>
              )}
              {todayCreditDebtReductions > 0 && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>Credit Returns (Debt Reduced):</span>
                  <span className="font-mono text-slate-700">Rs. {todayCreditDebtReductions.toFixed(2)}</span>
                </div>
              )}
              {todayCreditSales.length > 0 && (
                <div className="flex items-center justify-between text-amber-700 font-semibold pt-0.5">
                  <span>Today's Credit Pending:</span>
                  <span className="font-mono">Rs. {todayCreditAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Credit (Udhaaro) Container */}
        <div 
          onClick={() => setActiveTab('customer_credit')}
          className="premium-kpi-card group cursor-pointer rounded-2xl border border-amber-200 bg-gradient-to-br from-white via-white to-amber-50/50 px-6 py-5 shadow-[0_3px_14px_rgba(245,158,11,0.06)] transition-all hover:border-amber-400 hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold text-amber-900">
                Customer Credit (Udhaaro)
              </p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-300">
                {activeCreditDueBills.length} Due
              </span>
            </div>

            <p className="mt-3 font-mono text-[28px] font-black leading-none tracking-tight text-amber-900">
              Rs. {totalOutstandingCredit.toFixed(2)}
            </p>

            <div className="mt-2.5 flex items-center justify-between rounded-xl bg-amber-100/70 px-3 py-1.5 text-xs text-amber-900">
              <span className="font-semibold">Today's Credit:</span>
              <span className="font-mono font-extrabold text-amber-950">
                Rs. {todayCreditAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-4 border-t border-amber-200/60 pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-800/80 font-medium">
                {uniqueCreditCustomersCount} Customers
              </span>
              <span className="font-bold text-amber-900 group-hover:underline flex items-center gap-0.5">
                View Report <ArrowUpRight className="h-3 w-3 inline" />
              </span>
            </div>
          </div>
        </div>


        {/* Inventory Valuation */}
        <div className="premium-kpi-card premium-kpi-inventory rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_3px_14px_rgba(15,23,42,0.05)]">
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
        <div className="premium-kpi-card premium-kpi-stock rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_3px_14px_rgba(15,23,42,0.05)]">
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
        <div className="premium-kpi-card premium-kpi-payables rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_3px_14px_rgba(15,23,42,0.05)]">
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

      {/* Credit Limit Alerts */}
      {creditAlerts.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-rose-600" />
              <div>
                <h3 className="text-[15px] font-extrabold text-rose-900">
                  Distributor Credit Alerts
                </h3>
                <p className="mt-0.5 text-[11px] font-medium text-rose-600">
                  {creditAlerts.filter(s => s.usagePct >= 100).length} exceeded limit ·{' '}
                  {creditAlerts.filter(s => s.usagePct >= 80 && s.usagePct < 100).length} near limit
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('stockists')}
              className="text-[12px] font-bold text-rose-700 hover:text-rose-900"
            >
              View Ledger →
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {creditAlerts.map(s => {
              const exceeded = s.usagePct >= 100;
              const barColor = exceeded ? 'bg-rose-500' : 'bg-amber-400';
              const barWidth = `${Math.min(s.usagePct, 100).toFixed(0)}%`;
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[minmax(0,1fr)_200px_120px] items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60"
                >
                  {/* Distributor name */}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-slate-900">
                      {s.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {s.phone || s.contactPerson || '—'}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="min-w-0">
                    <div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>Rs. {s.currentBalance.toLocaleString()}</span>
                      <span>Limit: Rs. {s.creditLimit.toLocaleString()}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: barWidth }}
                      />
                    </div>
                  </div>

                  {/* Badge */}
                  <div className="text-right">
                    {exceeded ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                        <AlertTriangle className="h-3 w-3" />
                        Limit Exceeded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                        <ShieldAlert className="h-3 w-3" />
                        {s.usagePct.toFixed(0)}% Used
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Dual Grid: Stock & Expiry Alerts */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-stretch">

        {/* LOW STOCK */}
        <section className="premium-dashboard-panel premium-low-stock-panel flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:h-[365px]">
          <div className="premium-panel-header flex items-center justify-between border-b border-slate-200 px-5 py-4">
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
                className="premium-alert-row grid grid-cols-[minmax(0,1fr)_120px] items-center gap-5 px-5 py-4 hover:bg-slate-50/60"
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
        <section className="premium-dashboard-panel premium-expiry-panel flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:h-[365px]">
          <div className="premium-panel-header flex items-center justify-between border-b border-slate-200 px-5 py-4">
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
                  className="premium-alert-row grid grid-cols-[minmax(0,1fr)_190px_108px] items-center gap-5 px-5 py-4 hover:bg-slate-50/60"
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
      <div className="premium-bills-panel bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="premium-bills-header p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
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
          <table className="premium-bills-table w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Medicines</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-4 text-right">Grand Total</th>
                {isAdmin && <th className="py-2.5 px-3 text-right text-emerald-800">Gross Profit</th>}
                <th className="py-2.5 px-3 text-right">Reprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesInvoices.slice(0, 5).map(sale => (
                <tr key={sale.id} className="premium-bill-row hover:bg-slate-50/70">
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
                  {isAdmin && (() => {
                    const cogs = (sale.items || []).reduce((acc, it) => {
                      let cost = Number(it.costPrice) || 0;
                      if (cost <= 0 && it.medicineName) {
                        const match = (medicines || []).find(m => 
                          m.name.toLowerCase() === it.medicineName.toLowerCase() ||
                          m.id === it.medicineId
                        );
                        if (match) {
                          cost = Number(match.costPrice) || 0;
                        }
                      }
                      const qty = Number(it.quantity) || 0;
                      const unitsPerPack = Number(it.unitsPerPack) || 1;
                      return acc + (it.isLooseUnit ? (cost / unitsPerPack) * qty : cost * qty);
                    }, 0);
                    const subtotalRev = (sale.taxableBaseSubtotal || 0) + (sale.vatExemptSubtotal || 0);
                    const netRev = subtotalRev > 0 
                      ? subtotalRev 
                      : Math.max(0, (sale.grandTotal || 0) - (sale.vatAmount || 0));
                    const profit = Math.round((netRev - cogs) * 100) / 100;
                    return (
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        + Rs. {profit.toFixed(2)}
                      </td>
                    );
                  })()}
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
                  <td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-slate-400">
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
