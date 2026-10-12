import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Printer, 
  Download, 
  Calendar, 
  User, 
  Filter, 
  Eye, 
  CheckCircle2, 
  Banknote, 
  QrCode, 
  CreditCard 
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { SaleInvoice } from '../types/pharmacy';
import { exportSalesBookToExcel } from '../utils/excelUtils';

export const SalesHistoryView: React.FC = () => {
  const { salesInvoices, setActiveInvoiceToPrint, settings } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'month'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);

  // Filter sales
  const filteredSales = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    return salesInvoices.filter(inv => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerPhone && inv.customerPhone.includes(q)) ||
        (inv.doctorName && inv.doctorName.toLowerCase().includes(q)) ||
        inv.items.some(it => it.medicineName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Date
      if (dateFilter === 'today') return inv.date === todayStr;
      if (dateFilter === 'yesterday') return inv.date === yesterdayStr;
      if (dateFilter === '7days') return new Date(inv.date) >= sevenDaysAgo;
      if (dateFilter === 'month') return new Date(inv.date) >= firstOfMonth;

      return true;
    });
  }, [salesInvoices, searchQuery, dateFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalVat = filteredSales.reduce((acc, s) => acc + s.vatAmount, 0);
    const totalExempt = filteredSales.reduce((acc, s) => acc + s.vatExemptSubtotal, 0);
    const totalTaxable = filteredSales.reduce((acc, s) => acc + s.taxableBaseSubtotal, 0);
    return { totalRevenue, totalVat, totalExempt, totalTaxable };
  }, [filteredSales]);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Sales Register &amp; Statutory Tax Invoices (बिक्री खाता)
              </h2>
              <p className="text-xs text-slate-500">
                Official billing audit log compliant with Inland Revenue Department (IRD) Nepal tax regulations
              </p>
            </div>
          </div>
        </div>

        {/* Export Sales to Excel */}
        <button
          onClick={() => exportSalesBookToExcel(filteredSales, settings.storeName)}
          className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Sales Book (.xlsx)</span>
        </button>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Total Revenue</span>
          <span className="text-lg font-extrabold font-mono text-teal-800">
            Rs. {stats.totalRevenue.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{filteredSales.length} bills completed</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 block">VAT-Free Essential Sales</span>
          <span className="text-lg font-extrabold font-mono text-emerald-800">
            Rs. {stats.totalExempt.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">0% VAT therapeutic drugs</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-700 block">Taxable Sales (Base)</span>
          <span className="text-lg font-extrabold font-mono text-blue-800">
            Rs. {stats.totalTaxable.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Subject to 13% VAT</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-indigo-700 block">13% VAT Collected</span>
          <span className="text-lg font-extrabold font-mono text-indigo-800">
            Rs. {stats.totalVat.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Payable to IRD Nepal</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Date Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setDateFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
              dateFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Time ({salesInvoices.length})
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
              dateFilter === 'today' ? 'bg-teal-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('yesterday')}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
              dateFilter === 'yesterday' ? 'bg-teal-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setDateFilter('7days')}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
              dateFilter === '7days' ? 'bg-teal-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
              dateFilter === 'month' ? 'bg-teal-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            This Month
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice #, customer, doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-3">Tax Invoice #</th>
                <th className="py-3 px-3">Patient / Customer</th>
                <th className="py-3 px-3">Items Sold</th>
                <th className="py-3 px-3 text-right">0% VAT Exempt</th>
                <th className="py-3 px-3 text-right">Taxable Base</th>
                <th className="py-3 px-3 text-right">13% VAT</th>
                <th className="py-3 px-3 text-center">Payment</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    <div>{inv.date}</div>
                    <div className="text-[10px] text-slate-400">{inv.time}</div>
                  </td>

                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {inv.invoiceNumber}
                  </td>

                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">{inv.customerName}</div>
                    {inv.doctorName && (
                      <div className="text-[10px] text-slate-500">Dr: {inv.doctorName}</div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-slate-600">
                    <div>{inv.items.length} item{inv.items.length > 1 ? 's' : ''}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                      {inv.items.map(it => it.medicineName).join(', ')}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-emerald-700">
                    Rs. {inv.vatExemptSubtotal.toFixed(2)}
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    Rs. {inv.taxableBaseSubtotal.toFixed(2)}
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-blue-700 font-bold">
                    Rs. {inv.vatAmount.toFixed(2)}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {inv.paymentMode.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 text-sm">
                    Rs. {inv.grandTotal.toFixed(2)}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => setActiveInvoiceToPrint(inv)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs ml-auto transition-colors"
                      title="Re-print official VAT Tax Invoice"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No sales invoices found matching the current search / filter criteria.
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
