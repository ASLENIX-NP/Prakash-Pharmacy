import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  FileText,
  FileCheck,
  FileDown
} from 'lucide-react';
import { SaleInvoice } from '../types/pharmacy';
import { usePharmacy } from '../context/PharmacyContext';

interface TaxInvoiceModalProps {
  invoice: SaleInvoice | null;
  onClose: () => void;
}

// Convert numbers to Nepali / English words for statutory bills
function numberToWords(num: number): string {
  const rounded = Math.round(num);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (rounded === 0) return 'Zero Rupees Only';
  if (rounded < 20) return `${ones[rounded]} Rupees Only`;
  if (rounded < 100) return `${tens[Math.floor(rounded / 10)]} ${ones[rounded % 10]} Rupees Only`.trim();
  if (rounded < 1000) {
    return `${ones[Math.floor(rounded / 100)]} Hundred ${numberToWords(rounded % 100).replace(' Rupees Only', '')} Rupees Only`.trim();
  }
  if (rounded < 100000) {
    return `${numberToWords(Math.floor(rounded / 1000)).replace(' Rupees Only', '')} Thousand ${numberToWords(rounded % 1000).replace(' Rupees Only', '')} Rupees Only`.trim();
  }
  if (rounded < 10000000) {
    return `${numberToWords(Math.floor(rounded / 100000)).replace(' Rupees Only', '')} Lakh ${numberToWords(rounded % 100000).replace(' Rupees Only', '')} Rupees Only`.trim();
  }
  return `${rounded} Rupees Only`;
}

export const TaxInvoiceModal: React.FC<TaxInvoiceModalProps> = ({ invoice, onClose }) => {
  const { settings } = usePharmacy();
  // Default to A5 Size as requested ("whole bill to be always printed in a5 size or thermal printer or saved as pdf")
  const [format, setFormat] = useState<'a5' | 'thermal'>('a5');

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

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = () => {
    // Triggers standard print dialog with target set to Save as PDF
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div 
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 transition-all flex flex-col max-h-[92vh] print:border-none print:shadow-none print:w-full print:m-0 print:max-h-none ${
          format === 'thermal' ? 'w-full max-w-sm' : 'w-full max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Minimal Info Header (No primary buttons here - as requested, print and close are at the bottom!) */}
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

        {/* Scrollable Printable Bill Container */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 print:p-0 print:overflow-visible">
          <div 
            id="printable-bill-area"
            className={`bg-white text-slate-900 font-sans mx-auto ${
              format === 'thermal' 
                ? 'max-w-[76mm] text-[11px] leading-tight space-y-2' 
                : 'max-w-[148mm] text-xs leading-normal space-y-3'
            }`}
          >
            {/* Pharmacy Branding Header */}
            <div className="text-center border-b-2 border-slate-900 pb-2.5 space-y-1">
              <h2 className="text-xs font-black tracking-wider uppercase text-slate-800">
                TAX INVOICE / VAT BILL (कर बीजक)
              </h2>
              <h1 className={`${format === 'thermal' ? 'text-base' : 'text-lg'} font-black text-slate-900 leading-tight`}>
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
              </div>
            </div>

            {/* Invoice Meta Grid */}
            <div className="grid grid-cols-2 gap-2 py-2 border-b border-slate-300 text-[11px]">
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
                  <span className="font-mono text-slate-800">{invoice.date} {invoice.time}</span>
                </div>
                <div>
                  <span className="text-slate-500">Payment:</span>{' '}
                  <strong className="font-semibold uppercase text-slate-900">{invoice.paymentMode.replace('_', ' ')}</strong>
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

            {/* Line Items Table */}
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
                        {format !== 'thermal' && (
                          <div className="text-[9px] text-slate-500 truncate max-w-[130px]">{it.genericName}</div>
                        )}
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
              <div className="flex flex-wrap items-start justify-between gap-2 text-[11px]">
                <div className="max-w-[50%] space-y-1">
                  <div>
                    <span className="text-slate-500 block text-[10px]">In Words:</span>
                    <strong className="text-slate-900 italic text-[11px] font-semibold leading-tight block">
                      {numberToWords(invoice.grandTotal)}
                    </strong>
                  </div>
                  <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-200">
                    <p>• Statutory 0% VAT on essential oral medications (VAT Act 2052).</p>
                    <p>• {settings.receiptFooterNote}</p>
                  </div>
                </div>

                {/* Totals Table */}
                <div className="w-48 space-y-0.5 text-right font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span>Gross Subtotal:</span>
                    <span>Rs. {invoice.grossSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800">
                    <span>0% VAT Free:</span>
                    <span>Rs. {invoice.vatExemptSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-900">
                    <span>Taxable Base:</span>
                    <span>Rs. {invoice.taxableBaseSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-900 font-bold">
                    <span>13% VAT:</span>
                    <span>Rs. {invoice.vatAmount.toFixed(2)}</span>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Discount:</span>
                      <span>- Rs. {invoice.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-t-2 border-b-2 border-slate-900 text-xs font-black text-slate-900">
                    <span>Grand Total:</span>
                    <span>Rs. {invoice.grandTotal.toFixed(2)}</span>
                  </div>
                  {invoice.paymentMode === 'cash' && (
                    <div className="text-[10px] text-slate-500 space-y-0.5 pt-0.5">
                      <div className="flex justify-between">
                        <span>Tendered:</span>
                        <span>Rs. {invoice.cashTendered.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>Change:</span>
                        <span className="text-emerald-700">Rs. {invoice.changeGiven.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-4 flex justify-between items-end text-[10px] text-slate-600 border-t border-slate-200">
              <div className="border-t border-slate-400 w-28 pt-1 text-center">
                Customer Sign
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900 text-[10px] mb-2">
                  For {settings.storeName}
                </div>
                <div className="border-t border-slate-400 w-36 pt-1 text-center">
                  Pharmacist Signature
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR - As requested: Easy accessible at the BOTTOM of the screen! */}
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

          {/* Large, Easy-to-Click Bottom Actions */}
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
              onClick={handleSavePdf}
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
