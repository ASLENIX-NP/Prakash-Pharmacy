import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Printer, 
  FileDown, 
  TrendingUp 
} from 'lucide-react';
import { SaleInvoice } from '../types/pharmacy';
import { usePharmacy } from '../context/PharmacyContext';
import NepaliDate from 'nepali-date-converter';
import prakashLogo from '../assets/pharmacy-login-logo.png';

interface TaxInvoiceModalProps {
  invoice: SaleInvoice | null;
  onClose: () => void;
}

// Convert numbers to Nepali / English words for statutory bills
function numberToWords(num: number): string {
  const rounded = Math.round(num);
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  if (rounded === 0) return 'Zero Rupees Only';

  function convertHelper(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
    if (n < 1000) {
      const rem = n % 100;
      return `${ones[Math.floor(n / 100)]} Hundred${
        rem > 0 ? ` ${convertHelper(rem)}` : ''
      }`.trim();
    }
    if (n < 100000) {
      const rem = n % 1000;
      return `${convertHelper(Math.floor(n / 1000))} Thousand${
        rem > 0 ? ` ${convertHelper(rem)}` : ''
      }`.trim();
    }
    if (n < 10000000) {
      const rem = n % 100000;
      return `${convertHelper(Math.floor(n / 100000))} Lakh${
        rem > 0 ? ` ${convertHelper(rem)}` : ''
      }`.trim();
    }
    return `${convertHelper(Math.floor(n / 10000000))} Crore${
      n % 10000000 > 0 ? ` ${convertHelper(n % 10000000)}` : ''
    }`.trim();
  }

  return `${convertHelper(rounded)} Rupees Only`;
}

export const TaxInvoiceModal: React.FC<TaxInvoiceModalProps> = ({ invoice, onClose }) => {
  const { settings, isAdmin, medicines } = usePharmacy();
  const [format, setFormat] = useState<'a5' | 'thermal'>(
    settings.defaultInvoiceSize === 'Thermal' ? 'thermal' : 'a5'
  );

  const profitAudit = useMemo(() => {
    if (!invoice || !isAdmin) return null;
    const cogs = (invoice.items || []).reduce((acc, it) => {
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
      return acc + lineCost;
    }, 0);
    const subtotalRev = (invoice.taxableBaseSubtotal || 0) + (invoice.vatExemptSubtotal || 0);
    const netRevenueExVat = subtotalRev > 0
      ? subtotalRev
      : Math.max(0, (invoice.grandTotal || 0) - (invoice.vatAmount || 0));
    const grossProfit = Math.round((netRevenueExVat - cogs) * 100) / 100;
    const marginPct = netRevenueExVat > 0 ? (grossProfit / netRevenueExVat) * 100 : 0;
    return { cogs, netRevenueExVat, grossProfit, marginPct };
  }, [invoice, isAdmin, medicines]);

  useEffect(() => {
    setFormat(settings.defaultInvoiceSize === 'Thermal' ? 'thermal' : 'a5');
  }, [settings.defaultInvoiceSize]);

  // ESC Key listener to easily skip / close from printing bill
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!invoice) return null;

  const [year, month, day] = invoice.date.split('-').map(Number);
  const invoiceDate = new Date(year, month - 1, day);
  const isValidInvoiceDate =
    Number.isFinite(invoiceDate.getTime()) &&
    invoiceDate.getFullYear() === year &&
    invoiceDate.getMonth() === month - 1 &&
    invoiceDate.getDate() === day;
  const displayInvoiceDate = isValidInvoiceDate
    ? settings.invoiceDateFormat === 'BS'
      ? new NepaliDate(invoiceDate).format('DD MMMM YYYY', 'en')
      : invoiceDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
    : invoice.date;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:items-start print:overflow-visible print:p-0 print:bg-white print:fixed print:inset-0">
      <div 
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 transition-all flex flex-col max-h-[calc(100dvh-1rem)] print:border-none print:shadow-none print:w-full print:m-0 print:max-h-none ${
          format === 'thermal' ? 'w-full max-w-sm' : 'w-full max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Minimal Info Header (print:hidden) */}
        <div className="bg-slate-900 text-white px-5 py-2.5 flex items-center justify-between text-xs print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-bold text-slate-200 uppercase tracking-wider">
              Bill Preview: {invoice.invoiceNumber}
            </span>
          </div>

          {/* Format selection toggle */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-0.5 rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => setFormat('a5')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                format === 'a5' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              A5 Size Bill
            </button>
            <button
              type="button"
              onClick={() => setFormat('thermal')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                format === 'thermal' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              80mm Thermal
            </button>
          </div>
        </div>

        {/* Admin Confidential Margin Audit Banner (Never printed) */}
        {profitAudit && (
          <div className="bg-emerald-950 text-emerald-200 border-b border-emerald-800 px-5 py-2 text-xs flex flex-wrap items-center justify-between gap-2 print:hidden shrink-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-emerald-800 text-emerald-100 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                <TrendingUp className="w-3 h-3 text-emerald-300" />
                Admin Audit
              </span>
              <span className="text-emerald-300">
                COGS: <strong className="font-mono text-white">Rs. {profitAudit.cogs.toFixed(2)}</strong>
              </span>
              <span className="text-emerald-600">•</span>
              <span className="text-emerald-300">
                Net Sales (ex-VAT): <strong className="font-mono text-white">Rs. {profitAudit.netRevenueExVat.toFixed(2)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-300">Gross Profit:</span>
              <strong className="font-mono text-xs text-emerald-100 bg-emerald-900/90 px-2.5 py-0.5 rounded border border-emerald-700">
                + Rs. {profitAudit.grossProfit.toFixed(2)} ({profitAudit.marginPct.toFixed(1)}% margin)
              </strong>
            </div>
          </div>
        )}

        {/* Scrollable Printable Bill Container */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-6 print:p-0 print:overflow-visible">
          {format === 'thermal' ? (
            /* ============================================================ */
            /* 80mm POS Thermal Receipt Layout                              */
            /* Tailored specifically for 76-80mm thermal receipt paper      */
            /* ============================================================ */
            <div
              id="printable-bill-thermal"
              className="bg-white text-slate-900 font-sans mx-auto max-w-[76mm] text-[10.5px] leading-tight space-y-2"
            >
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-900 pb-2 space-y-0.5">
                <img
                  src={settings.storeLogo || prakashLogo}
                  alt={`${settings.storeName || 'Pharmacy'} logo`}
                  className="mx-auto mb-1 h-12 max-w-24 object-contain"
                />
                <h2 className="text-[10px] font-black tracking-wide uppercase text-slate-700">
                  TAX INVOICE / VAT BILL (कर बीजक)
                </h2>
                <h1 className="text-sm font-black text-slate-900 leading-tight">
                  {settings.storeName}
                </h1>
                <p className="text-[9.5px] text-slate-700 font-medium">
                  {settings.address}
                </p>
                <p className="text-[9px] text-slate-600">
                  Phone: {settings.phoneNumber}
                  {settings.emailId && ` | Email: ${settings.emailId}`}
                </p>
                <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold pt-0.5">
                  <span className="border border-slate-300 px-1 py-0.5 rounded bg-slate-50">
                    PAN: {settings.panNumber}
                  </span>
                  {settings.ddaLicenceNumber && (
                    <span className="border border-slate-300 px-1 py-0.5 rounded bg-slate-50">
                      DDA: {settings.ddaLicenceNumber}
                    </span>
                  )}
                  <span className="border border-slate-300 px-1 py-0.5 rounded bg-slate-50">
                    {settings.vatRegistered ? 'VAT Registered' : 'Not VAT Registered'}
                  </span>
                </div>
                {(settings.pharmacistName || settings.pharmacistCouncilRegNumber) && (
                  <p className="text-[9px] text-slate-600">
                    Pharmacist: {settings.pharmacistName}
                    {settings.pharmacistCouncilRegNumber && ` · NPC: ${settings.pharmacistCouncilRegNumber}`}
                  </p>
                )}
              </div>

              {/* Metadata Block */}
              <div className="py-1 border-b border-dashed border-slate-400 text-[10px] space-y-1">
                <div className="flex justify-between items-baseline">
                  <span>
                    Bill No: <strong className="font-mono text-slate-900">{invoice.invoiceNumber}</strong>
                  </span>
                  <span className="font-mono text-[9.5px] text-slate-800">
                    {displayInvoiceDate}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-[9px] text-slate-600">
                  <span>
                    FY: <strong className="font-mono text-slate-900">{invoice.fiscalYear}</strong>
                  </span>
                  <span>{invoice.time}</span>
                </div>

                <div className="border-t border-dotted border-slate-300 pt-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">
                      {invoice.customerName}
                    </span>
                    {invoice.customerPhone && (
                      <span className="font-mono text-[9.5px] text-slate-700">
                        {invoice.customerPhone}
                      </span>
                    )}
                  </div>
                  {(invoice.customerAddress || invoice.customerPan) && (
                    <div className="flex justify-between text-[9px] text-slate-600">
                      <span>{invoice.customerAddress || ''}</span>
                      {invoice.customerPan && <span>PAN: {invoice.customerPan}</span>}
                    </div>
                  )}
                </div>

                <div className="border-t border-dotted border-slate-300 pt-1 flex justify-between items-baseline text-[9px]">
                  <span>
                    Payment:{' '}
                    <strong className="font-semibold uppercase text-slate-900">
                      {invoice.paymentMode === 'credit'
                        ? `CREDIT (${invoice.paymentStatus === 'paid' ? 'SETTLED' : 'DUE'})`
                        : invoice.paymentMode.replace('_', ' ')}
                    </strong>
                  </span>
                  {invoice.cashierName && (
                    <span>
                      Cashier: <strong className="text-teal-900">{invoice.cashierName}</strong>
                    </span>
                  )}
                </div>
                {invoice.doctorName && (
                  <div className="text-[9px] text-slate-600">
                    Dr: <span className="font-medium text-slate-800">{invoice.doctorName}</span>
                  </div>
                )}
              </div>

              {/* Line Items Table: 4 clean columns */}
              <div className="py-0.5">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 font-bold uppercase text-[9px] text-slate-800">
                      <th className="py-1 px-0.5">Medicine / Batch</th>
                      <th className="py-1 px-0.5 text-center w-10">Qty</th>
                      <th className="py-1 px-0.5 text-right w-12">Rate</th>
                      <th className="py-1 px-0.5 text-right w-16">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoice.items.map((it, idx) => (
                      <tr key={idx} className="py-0.5">
                        <td className="py-1 px-0.5">
                          <div className="font-bold text-slate-900 leading-tight">{it.medicineName}</div>
                          <div className="text-[8.5px] text-slate-500 font-mono">
                            B: {it.batchNumber} · E: {it.expiryDate}
                          </div>
                        </td>
                        <td className="py-1 px-0.5 text-center font-mono whitespace-nowrap">
                          {it.quantity} {it.isLooseUnit ? 'tab' : 'pk'}
                        </td>
                        <td className="py-1 px-0.5 text-right font-mono whitespace-nowrap">
                          {it.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-1 px-0.5 text-right font-mono font-bold whitespace-nowrap">
                          {it.lineTotal.toFixed(2)}
                          {it.isVatApplicable && <span className="text-[8px] font-normal text-blue-700 ml-0.5">*</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Section: Full Width */}
              <div className="border-t-2 border-slate-800 pt-1.5 space-y-1">
                <div className="w-full space-y-0.5 text-right font-mono text-[10px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Gross Subtotal:</span>
                    <span className="whitespace-nowrap">Rs. {invoice.grossSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800">
                    <span>0% VAT Free:</span>
                    <span className="whitespace-nowrap">Rs. {invoice.vatExemptSubtotal.toFixed(2)}</span>
                  </div>
                  {invoice.taxableBaseSubtotal > 0 && (
                    <div className="flex justify-between text-blue-900">
                      <span>Taxable Base:</span>
                      <span className="whitespace-nowrap">Rs. {invoice.taxableBaseSubtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.vatAmount > 0 && (
                    <div className="flex justify-between text-blue-900 font-bold">
                      <span>13% VAT:</span>
                      <span className="whitespace-nowrap">Rs. {invoice.vatAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Discount:</span>
                      <span className="whitespace-nowrap">- Rs. {invoice.discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Grand Total */}
                  <div className="flex justify-between border-t-2 border-b-2 border-slate-900 font-black text-slate-900 py-1 text-[11px]">
                    <span className="whitespace-nowrap">GRAND TOTAL:</span>
                    <span className="whitespace-nowrap">Rs. {invoice.grandTotal.toFixed(2)}</span>
                  </div>

                  {invoice.paymentMode === 'credit' && (() => {
                    const returnsTotal = (invoice.salesReturns || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
                    const netCreditDue = Math.max(0, invoice.grandTotal - returnsTotal - (invoice.cashTendered || 0));
                    return (
                      <div className="text-[9.5px] space-y-0.5 pt-0.5">
                        {returnsTotal > 0 && (
                          <div className="flex justify-between text-rose-700 font-semibold">
                            <span>Returns Deducted:</span>
                            <span className="whitespace-nowrap">- Rs. {returnsTotal.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-amber-900 border-t border-slate-200 pt-0.5">
                          <span>Balance Due:</span>
                          <span className="whitespace-nowrap">
                            {invoice.paymentStatus === 'paid' || netCreditDue <= 0.001 ? 'PAID / CLEARED' : `Rs. ${netCreditDue.toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {invoice.paymentMode === 'cash' && (
                    <div className="text-[9.5px] text-slate-600 space-y-0.5 pt-0.5">
                      <div className="flex justify-between">
                        <span>Tendered:</span>
                        <span className="whitespace-nowrap">Rs. {invoice.cashTendered.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>Change:</span>
                        <span className="text-emerald-700 whitespace-nowrap">Rs. {invoice.changeGiven.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* In Words - Full Width */}
                <div className="pt-1.5 border-t border-dashed border-slate-300 text-[9.5px] leading-tight">
                  <span className="text-slate-500">In Words: </span>
                  <strong className="text-slate-900 italic font-semibold block sm:inline">
                    {numberToWords(invoice.grandTotal)}
                  </strong>
                </div>

                {/* Statutory Notes */}
                <div className="text-[8.5px] text-slate-500 pt-1 border-t border-slate-200 space-y-0.5">
                  <p>• Statutory 0% VAT on essential oral medications (VAT Act 2052).</p>
                  <p>• {settings.receiptFooterNote}</p>
                  <p className="font-semibold text-emerald-800">• Get well soon! (स्वास्थ्य लाभको शुभकामना!)</p>
                </div>

                {/* Staff / Billed Info (No signature line) */}
                <div className="pt-2 text-[9px] text-slate-500">
                  <span>Billed By: </span>
                  <strong className="text-slate-800">{invoice.cashierName || 'Cashier'}</strong>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* A5 Size Standard Bill Layout                                 */
            /* Spacious 148mm width format for half-sheet / laser printer   */
            /* ============================================================ */
            <div 
              id="printable-bill-a5"
              className="bg-white text-slate-900 font-sans mx-auto max-w-[148mm] text-xs leading-normal space-y-3"
            >
              {/* Pharmacy Branding Header */}
              <div className="text-center border-b-2 border-slate-900 pb-2.5 space-y-1">
                <img
                  src={settings.storeLogo || prakashLogo}
                  alt={`${settings.storeName || 'Pharmacy'} logo`}
                  className="mx-auto mb-1 h-40 max-w-64 scale-110 object-contain"
                />
                <h2 className="text-xs font-black tracking-wider uppercase text-slate-800">
                  TAX INVOICE / VAT BILL (कर बीजक)
                </h2>
                <h1 className="text-lg font-black text-slate-900 leading-tight">
                  {settings.storeName}
                </h1>
                <p className="text-[11px] text-slate-700 font-medium">
                  {settings.address}
                </p>
                <p className="text-[10px] text-slate-600">
                  Phone: {settings.phoneNumber} | Email: {settings.emailId}
                </p>
                
                {/* Statutory Numbers */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono font-bold pt-0.5">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                    PAN: {settings.panNumber}
                  </span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                    DDA: {settings.ddaLicenceNumber}
                  </span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                    {settings.vatRegistered ? 'VAT Registered' : 'Not VAT Registered'}
                  </span>
                </div>
                {(settings.pharmacistName || settings.pharmacistCouncilRegNumber) && (
                  <p className="text-[10px] text-slate-600">
                    Pharmacist: {settings.pharmacistName}
                    {settings.pharmacistCouncilRegNumber && ` · NPC Reg. No: ${settings.pharmacistCouncilRegNumber}`}
                  </p>
                )}
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 gap-3 py-2 border-b border-slate-300 text-[11px]">
                <div className="space-y-0.5">
                  <div>
                    <span className="text-slate-500">Bill No:</span>{' '}
                    <strong className="font-mono text-slate-900">{invoice.invoiceNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">FY:</span>{' '}
                    <strong className="font-mono text-slate-900">{invoice.fiscalYear}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Date/Time:</span>{' '}
                    <span className="font-mono text-slate-800">{displayInvoiceDate} {invoice.time}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Payment:</span>{' '}
                    <strong className="font-semibold uppercase text-slate-900">
                      {invoice.paymentMode === 'credit'
                        ? `CREDIT (${invoice.paymentStatus === 'paid' ? 'SETTLED' : 'DUE'})`
                        : invoice.paymentMode.replace('_', ' ')}
                    </strong>
                  </div>
                  {invoice.cashierName && (
                    <div>
                      <span className="text-slate-500">Cashier:</span>{' '}
                      <strong className="text-teal-800">{invoice.cashierName}</strong>
                    </div>
                  )}
                </div>

                <div className="space-y-0.5 text-right">
                  <div>
                    <span className="text-slate-500">Customer:</span>{' '}
                    <strong className="text-slate-900">{invoice.customerName}</strong>
                  </div>
                  {invoice.customerPhone && (
                    <div>
                      <span className="text-slate-500">Phone:</span>{' '}
                      <span className="font-mono text-slate-800">{invoice.customerPhone}</span>
                    </div>
                  )}
                  {invoice.customerAddress && (
                    <div>
                      <span className="text-slate-500">Address:</span>{' '}
                      <span className="text-slate-800">{invoice.customerAddress}</span>
                    </div>
                  )}
                  {invoice.customerPan && (
                    <div>
                      <span className="text-slate-500">Buyer PAN:</span>{' '}
                      <span className="font-mono font-bold text-slate-900">{invoice.customerPan}</span>
                    </div>
                  )}
                  {invoice.doctorName && (
                    <div>
                      <span className="text-slate-500">Dr:</span>{' '}
                      <span className="text-slate-800 font-medium">{invoice.doctorName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table: 8 columns */}
              <div className="py-1">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 font-bold text-slate-900 uppercase">
                      <th className="py-1 px-1 text-center w-6">#</th>
                      <th className="py-1 px-1">Medicine / Molecule</th>
                      <th className="py-1 px-1 text-center">Batch</th>
                      <th className="py-1 px-1 text-center">Exp</th>
                      <th className="py-1 px-1 text-center">Qty</th>
                      <th className="py-1 px-1 text-right">Rate</th>
                      <th className="py-1 px-1 text-center">Tax</th>
                      <th className="py-1 px-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoice.items.map((it, idx) => (
                      <tr key={idx} className="py-0.5">
                        <td className="py-1 px-1 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-1 px-1">
                          <div className="font-bold text-slate-900">{it.medicineName}</div>
                          <div className="text-[9px] text-slate-500 truncate max-w-[130px]">{it.genericName}</div>
                        </td>
                        <td className="py-1 px-1 text-center font-mono text-[10px]">{it.batchNumber}</td>
                        <td className="py-1 px-1 text-center font-mono text-[10px] text-slate-600">{it.expiryDate}</td>
                        <td className="py-1 px-1 text-center font-mono font-bold">
                          {it.quantity} {it.isLooseUnit ? 'tab' : 'pk'}
                        </td>
                        <td className="py-1 px-1 text-right font-mono">
                          {it.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-1 px-1 text-center font-semibold text-[9px]">
                          {it.isVatApplicable ? '13%' : '0%'}
                        </td>
                        <td className="py-1 px-1 text-right font-mono font-bold">
                          {it.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Statutory Nepal VAT Breakdown Box */}
              <div className="border-t-2 border-slate-800 pt-2 space-y-2">
                <div className="flex items-start justify-between gap-4 text-[11px]">
                  {/* Left Column: In Words + Statutory Notes */}
                  <div className="flex-1 min-w-0 max-w-[50%] space-y-1">
                    <div>
                      <span className="text-slate-500 block text-[10px]">In Words:</span>
                      <strong className="text-slate-900 italic font-semibold leading-tight block break-words text-[11px]">
                        {numberToWords(invoice.grandTotal)}
                      </strong>
                    </div>
                    <div className="text-slate-500 pt-1 border-t border-slate-200 text-[9px] space-y-0.5">
                      <p>• Statutory 0% VAT on essential oral medications (VAT Act 2052).</p>
                      <p>• {settings.receiptFooterNote}</p>
                      <p className="font-medium text-emerald-800">• Get well soon! (स्वास्थ्य लाभको शुभकामना!)</p>
                    </div>
                  </div>

                  {/* Right Column: Totals Table */}
                  <div className="w-60 shrink-0 pr-1 text-[11px] ml-auto space-y-0.5 text-right font-mono">
                    <div className="flex justify-between text-slate-600 gap-2">
                      <span className="whitespace-nowrap">Gross Subtotal:</span>
                      <span className="whitespace-nowrap">Rs. {invoice.grossSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 gap-2">
                      <span className="whitespace-nowrap">0% VAT Free:</span>
                      <span className="whitespace-nowrap">Rs. {invoice.vatExemptSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-blue-900 gap-2">
                      <span className="whitespace-nowrap">Taxable Base:</span>
                      <span className="whitespace-nowrap">Rs. {invoice.taxableBaseSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-blue-900 font-bold gap-2">
                      <span className="whitespace-nowrap">13% VAT:</span>
                      <span className="whitespace-nowrap">Rs. {invoice.vatAmount.toFixed(2)}</span>
                    </div>
                    {invoice.discountAmount > 0 && (
                      <div className="flex justify-between text-rose-700 gap-2">
                        <span className="whitespace-nowrap">Discount:</span>
                        <span className="whitespace-nowrap">- Rs. {invoice.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t-2 border-b-2 border-slate-900 font-black text-slate-900 gap-2 py-1 text-xs">
                      <span className="whitespace-nowrap">Grand Total:</span>
                      <span className="whitespace-nowrap">Rs. {invoice.grandTotal.toFixed(2)}</span>
                    </div>
                    {invoice.paymentMode === 'credit' && (() => {
                      const returnsTotal = (invoice.salesReturns || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
                      const netCreditDue = Math.max(0, invoice.grandTotal - returnsTotal - (invoice.cashTendered || 0));
                      return (
                        <div className="text-[10px] space-y-0.5 pt-1">
                          {returnsTotal > 0 && (
                            <div className="flex justify-between text-rose-700 font-semibold gap-2">
                              <span className="whitespace-nowrap">Returns Deducted:</span>
                              <span className="whitespace-nowrap">- Rs. {returnsTotal.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-amber-900 border-t border-slate-200 pt-0.5 gap-2">
                            <span className="whitespace-nowrap">Balance Due:</span>
                            <span className="whitespace-nowrap">{invoice.paymentStatus === 'paid' || netCreditDue <= 0.001 ? 'PAID / CLEARED' : `Rs. ${netCreditDue.toFixed(2)}`}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {invoice.paymentMode === 'cash' && (
                      <div className="text-[10px] text-slate-500 space-y-0.5 pt-0.5">
                        <div className="flex justify-between gap-2">
                          <span className="whitespace-nowrap">Tendered:</span>
                          <span className="whitespace-nowrap">Rs. {invoice.cashTendered.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-800 gap-2">
                          <span className="whitespace-nowrap">Change:</span>
                          <span className="text-emerald-700 whitespace-nowrap">Rs. {invoice.changeGiven.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Staff / Billed Info (No signature line) */}
                <div className="pt-3 text-[10px] text-slate-500">
                  <span>Billed By: </span>
                  <strong className="text-slate-800">{invoice.cashierName || 'Cashier'}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-slate-100 border-t border-slate-300 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="hidden sm:inline">Format:</span>
            <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded border border-slate-300">
              {format === 'a5' ? 'A5 Half Sheet' : '80mm Thermal Roll'}
            </span>
            <span className="text-[11px] text-slate-400">
              (Press <strong>Esc</strong> to skip)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Close / Skip Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Close bill preview (or press Esc key)"
            >
              <X className="w-4 h-4 text-slate-500" />
              <span>Close (Esc)</span>
            </button>

            {/* Save as PDF Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Save as PDF using browser print dialog"
            >
              <FileDown className="w-4 h-4 text-indigo-600" />
              <span>Save as PDF</span>
            </button>

            {/* Print Bill Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20 flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              title="Print bill now"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bill ({format === 'a5' ? 'A5' : 'Thermal'})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
