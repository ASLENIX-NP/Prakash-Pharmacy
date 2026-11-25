import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  FileDown,
  Receipt,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import NepaliDate from 'nepali-date-converter';
import prakashLogo from '../assets/pharmacy-login-logo.png';

export interface OpdBillVisit {
  id: string | number;
  opdNumber: string;
  patient: {
    clinicNumber: string;
    name: string;
    phone?: string | null;
    gender?: string | null;
    ageYears?: number | null;
    ageMonths?: number | null;
    ageUnit?: string | null;
    address?: string | null;
  };
  doctor: {
    id?: string | number;
    doctorCode?: string;
    name: string;
    speciality?: string | null;
    qualification?: string | null;
    nmcNumber?: string | null;
  };
  visitDateTime: string;
  ageAtVisit?: number | null;
  ageMonthsAtVisit?: number | null;
  ageUnitAtVisit?: string | null;
  consultationFee: number;
  additionalCharge: number;
  additionalChargeNote?: string | null;
  totalCharge: number;
  paymentMethod?: string | null;
  paymentMode?: string | null;
  chargeNote?: string | null;
  status: 'open' | 'completed' | 'cancelled' | 'voided';
  completedAt?: string | null;
  createdBy?: {
    id?: string;
    username?: string;
    name?: string;
  } | null;
}

interface OpdInvoiceModalProps {
  visit: OpdBillVisit | null;
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

const formatAge = (visit: OpdBillVisit): string => {
  const years = visit.ageAtVisit ?? visit.patient.ageYears;
  const months = visit.ageMonthsAtVisit ?? visit.patient.ageMonths;
  if (visit.ageUnitAtVisit === 'days' || visit.patient.ageUnit === 'days') {
    const days = months ?? years;
    return days === null || days === undefined ? '—' : `${days} days`;
  }
  if (
    visit.ageUnitAtVisit === 'months' ||
    visit.patient.ageUnit === 'months' ||
    (months && (years === 0 || years === null))
  ) {
    return `${months ?? 0} mo`;
  }
  if (years === null || years === undefined) return '—';
  return months && months > 0 ? `${years}y ${months}m` : `${years} yrs`;
};

export const OpdInvoiceModal: React.FC<OpdInvoiceModalProps> = ({
  visit,
  onClose,
}) => {
  const { settings } = usePharmacy();
  const [format, setFormat] = useState<'a5' | 'thermal'>(
    settings.defaultInvoiceSize === 'Thermal' ? 'thermal' : 'a5'
  );

  useEffect(() => {
    setFormat(settings.defaultInvoiceSize === 'Thermal' ? 'thermal' : 'a5');
  }, [settings.defaultInvoiceSize]);

  // ESC Key listener to close modal easily
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!visit) return null;

  const visitDateObj = new Date(visit.visitDateTime);
  const isValidDate = !Number.isNaN(visitDateObj.getTime());

  // English Date string
  const englishDateStr = isValidDate
    ? visitDateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : visit.visitDateTime;

  // Time string
  const timeStr = isValidDate
    ? visitDateObj.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  // Nepali BS Miti string
  let nepaliMitiStr = '';
  if (isValidDate) {
    try {
      nepaliMitiStr = new NepaliDate(visitDateObj).format('YYYY-MM-DD', 'en');
    } catch {
      nepaliMitiStr = '';
    }
  }

  const consultationFee = Number(visit.consultationFee ?? 0);
  const additionalCharge = Number(visit.additionalCharge ?? 0);
  const totalCharge =
    visit.totalCharge !== undefined && visit.totalCharge !== null
      ? Number(visit.totalCharge)
      : consultationFee + additionalCharge;

  const handlePrint = () => {
    window.print();
  };

  const billNumber = `OPD-${visit.opdNumber.replace(/^OPD-?/i, '')}`;
  const cashierName =
    visit.createdBy?.name || visit.createdBy?.username || 'Reception';

  const doctorSpeciality = [visit.doctor.speciality, visit.doctor.qualification]
    .filter(Boolean)
    .join(' · ');

  const rawPaymentMethod = String(
    visit.paymentMethod || visit.paymentMode || ''
  ).toLowerCase().trim();

  let paymentModeLabel = 'CASH';
  if (
    rawPaymentMethod.includes('fonepay') ||
    rawPaymentMethod.includes('qr')
  ) {
    paymentModeLabel = 'FONEPAY (QR)';
  } else if (rawPaymentMethod === 'card') {
    paymentModeLabel = 'CARD';
  } else if (rawPaymentMethod === 'cash') {
    paymentModeLabel = 'CASH';
  } else if (rawPaymentMethod) {
    paymentModeLabel = rawPaymentMethod.toUpperCase();
  } else {
    paymentModeLabel = 'CASH';
  }

  const paidLineLabel =
    paymentModeLabel === 'FONEPAY (QR)'
      ? 'Paid (Fonepay):'
      : paymentModeLabel === 'CARD'
      ? 'Paid (Card):'
      : 'Paid (Cash):';

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
              OPD Bill Preview: {billNumber}
            </span>
          </div>

          {/* Format selection toggle */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-0.5 rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => setFormat('a5')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                format === 'a5'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              A5 Size Bill
            </button>
            <button
              type="button"
              onClick={() => setFormat('thermal')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                format === 'thermal'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              80mm Thermal
            </button>
          </div>
        </div>

        {/* Scrollable Printable Bill Container */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-6 print:p-0 print:overflow-visible">
          {format === 'thermal' ? (
            /* ============================================================ */
            /* 80mm POS Thermal Receipt Layout                              */
            /* Tailored specifically for 76-80mm thermal receipt paper      */
            /* ============================================================ */
            <div
              id="printable-opd-bill-thermal"
              className="bg-white text-slate-900 font-sans mx-auto max-w-[76mm] text-[10.5px] leading-tight space-y-2"
            >
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-900 pb-2 space-y-0.5">
                <img
                  src={settings.storeLogo || prakashLogo}
                  alt={`${settings.storeName || 'Clinic'} logo`}
                  className="mx-auto mb-1 h-12 max-w-24 object-contain"
                />
                <h2 className="text-[10px] font-black tracking-wide uppercase text-slate-700">
                  OPD CASH RECEIPT (ओ.पि.डि. रसिद)
                </h2>
                <h1 className="text-sm font-black text-slate-900 leading-tight">
                  {settings.storeName}
                </h1>
                <p className="text-[9.5px] text-slate-700 font-medium">
                  {settings.address}
                </p>
                <p className="text-[9px] text-slate-600">
                  Phone: {settings.phoneNumber}
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
                </div>
              </div>

              {/* Metadata Block */}
              <div className="py-1 border-b border-dashed border-slate-400 text-[10px] space-y-1">
                <div className="flex justify-between items-baseline">
                  <span>
                    Receipt: <strong className="font-mono text-slate-900">{billNumber}</strong>
                  </span>
                  <span className="font-mono text-[9.5px] text-slate-800">
                    {englishDateStr}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-[9px] text-slate-600">
                  <span>
                    OPD No: <strong className="font-mono text-slate-900">{visit.opdNumber}</strong>
                  </span>
                  <span>
                    {nepaliMitiStr ? `${nepaliMitiStr} BS ` : ''}{timeStr}
                  </span>
                </div>

                <div className="border-t border-dotted border-slate-300 pt-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">
                      {visit.patient.name}
                    </span>
                    <span className="font-mono text-[9.5px] text-slate-700">
                      {visit.patient.clinicNumber}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-600">
                    <span>{formatAge(visit)} / {visit.patient.gender || '—'}</span>
                    <span>{visit.patient.phone || ''}</span>
                  </div>
                  {visit.patient.address && (
                    <div className="text-[9px] text-slate-600 truncate">
                      {visit.patient.address}
                    </div>
                  )}
                </div>

                <div className="border-t border-dotted border-slate-300 pt-1">
                  <div className="flex justify-between items-baseline">
                    <span>
                      Dr: <strong className="text-teal-900">{visit.doctor.name}</strong>
                    </span>
                    {visit.doctor.nmcNumber && (
                      <span className="font-mono text-[9px] text-slate-600">
                        NMC: {visit.doctor.nmcNumber}
                      </span>
                    )}
                  </div>
                  {doctorSpeciality && (
                    <div className="text-[8.5px] text-slate-500 truncate">
                      {doctorSpeciality}
                    </div>
                  )}
                </div>

                <div className="border-t border-dotted border-slate-300 pt-1 flex justify-between items-baseline text-[9px]">
                  <span>
                    Payment:{' '}
                    <strong className="font-semibold uppercase text-emerald-800">
                      {paymentModeLabel}
                    </strong>
                  </span>
                  <span>
                    Billed:{' '}
                    <strong className="text-slate-800">{cashierName}</strong>
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-0.5">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 font-bold uppercase text-[9px] text-slate-800">
                      <th className="py-1 px-0.5">Particulars</th>
                      <th className="py-1 px-0.5 text-center w-8">Qty</th>
                      <th className="py-1 px-0.5 text-right w-20">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="py-0.5">
                      <td className="py-1 px-0.5">
                        <div className="font-bold text-slate-900">
                          Doctor Consultation Fee
                        </div>
                        <div className="text-[8.5px] text-slate-500">
                          Dr. {visit.doctor.name}
                        </div>
                      </td>
                      <td className="py-1 px-0.5 text-center font-mono">1</td>
                      <td className="py-1 px-0.5 text-right font-mono font-bold whitespace-nowrap">
                        {consultationFee.toFixed(2)}
                      </td>
                    </tr>
                    {additionalCharge > 0 && (
                      <tr className="py-0.5">
                        <td className="py-1 px-0.5">
                          <div className="font-bold text-slate-900">
                            Clinical Procedure / Service
                          </div>
                          <div className="text-[8.5px] text-slate-600 italic">
                            {visit.additionalChargeNote ||
                              visit.chargeNote ||
                              'Service charge'}
                          </div>
                        </td>
                        <td className="py-1 px-0.5 text-center font-mono">1</td>
                        <td className="py-1 px-0.5 text-right font-mono font-bold whitespace-nowrap">
                          {additionalCharge.toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Section: Full Width to prevent wrapping of numbers */}
              <div className="border-t-2 border-slate-800 pt-1.5 space-y-1">
                <div className="w-full space-y-0.5 text-right font-mono text-[10px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Consultation:</span>
                    <span className="whitespace-nowrap">
                      Rs. {consultationFee.toFixed(2)}
                    </span>
                  </div>
                  {additionalCharge > 0 && (
                    <div className="flex justify-between text-teal-800">
                      <span>Procedure Charge:</span>
                      <span className="whitespace-nowrap">
                        Rs. {additionalCharge.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t-2 border-b-2 border-slate-900 font-black text-slate-900 py-1 text-[11px]">
                    <span className="whitespace-nowrap">TOTAL PAYABLE:</span>
                    <span className="whitespace-nowrap">
                      Rs. {totalCharge.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700 font-semibold pt-0.5">
                    <span>{paidLineLabel}</span>
                    <span className="whitespace-nowrap">
                      Rs. {totalCharge.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Balance Due:</span>
                    <span className="whitespace-nowrap">Rs. 0.00</span>
                  </div>
                </div>

                {/* In Words - Full Width */}
                <div className="pt-1.5 border-t border-dashed border-slate-300 text-[9.5px] leading-tight">
                  <span className="text-slate-500">In Words: </span>
                  <strong className="text-slate-900 italic font-semibold block sm:inline">
                    {numberToWords(totalCharge)}
                  </strong>
                </div>

                {/* Footer Notes */}
                <div className="text-[8.5px] text-slate-500 pt-1 border-t border-slate-200 space-y-0.5">
                  <p>• Valid for consultation on date of issue.</p>
                  <p>• Keep receipt safe for clinical records.</p>
                  <p className="font-semibold text-emerald-800">
                    • Get well soon! (स्वास्थ्य लाभको शुभकामना!)
                  </p>
                </div>

                {/* Staff / Billed Info */}
                <div className="pt-2 text-[9px] text-slate-500">
                  <span>Billed By: </span>
                  <strong className="text-slate-800">{cashierName}</strong>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* A5 Size Standard Slip Layout                                 */
            /* Spacious 148mm width format for half-sheet / laser printer   */
            /* ============================================================ */
            <div
              id="printable-opd-bill-a5"
              className="bg-white text-slate-900 font-sans mx-auto max-w-[148mm] text-xs leading-normal space-y-3"
            >
              {/* Header */}
              <div className="text-center border-b-2 border-slate-900 pb-2.5 space-y-1">
                <img
                  src={settings.storeLogo || prakashLogo}
                  alt={`${settings.storeName || 'Clinic'} logo`}
                  className="mx-auto mb-1 h-40 max-w-64 scale-110 object-contain"
                />
                <h2 className="text-xs font-black tracking-wider uppercase text-slate-800">
                  OPD CASH RECEIPT / CLINIC BILL (ओ.पि.डि. रसिद)
                </h2>
                <h1 className="text-lg font-black text-slate-900 leading-tight">
                  {settings.storeName}
                </h1>
                <p className="text-[11px] text-slate-700 font-medium">
                  {settings.address}
                </p>
                <p className="text-[10px] text-slate-600">
                  Phone: {settings.phoneNumber}
                  {settings.emailId && ` | Email: ${settings.emailId}`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono font-bold pt-0.5">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                    PAN: {settings.panNumber}
                  </span>
                  {settings.ddaLicenceNumber && (
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                      DDA: {settings.ddaLicenceNumber}
                    </span>
                  )}
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                    OPD / CLINICAL SERVICES
                  </span>
                </div>
              </div>

              {/* 2-Column Meta Grid */}
              <div className="grid grid-cols-2 gap-3 py-2 border-b border-slate-300 text-[11px]">
                <div className="space-y-0.5">
                  <div>
                    <span className="text-slate-500">Receipt No:</span>{' '}
                    <strong className="font-mono text-slate-900">
                      {billNumber}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">OPD No:</span>{' '}
                    <span className="font-mono text-slate-800 font-bold">
                      {visit.opdNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Date/Time:</span>{' '}
                    <span className="font-mono text-slate-800">
                      {englishDateStr}
                      {nepaliMitiStr && ` (${nepaliMitiStr} BS)`} {timeStr}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Payment:</span>{' '}
                    <strong className="font-semibold uppercase text-emerald-800">
                      {paymentModeLabel}
                    </strong>
                  </div>
                  {cashierName && (
                    <div>
                      <span className="text-slate-500">Billed By:</span>{' '}
                      <strong className="text-slate-800">{cashierName}</strong>
                    </div>
                  )}
                </div>

                <div className="space-y-0.5 text-right">
                  <div>
                    <span className="text-slate-500">Patient:</span>{' '}
                    <strong className="text-slate-900">
                      {visit.patient.name}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Patient ID:</span>{' '}
                    <span className="font-mono font-bold text-slate-800">
                      {visit.patient.clinicNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Age / Gender:</span>{' '}
                    <span className="font-medium text-slate-800">
                      {formatAge(visit)} / {visit.patient.gender || '—'}
                    </span>
                  </div>
                  {visit.patient.phone && (
                    <div>
                      <span className="text-slate-500">Phone:</span>{' '}
                      <span className="font-mono text-slate-800">
                        {visit.patient.phone}
                      </span>
                    </div>
                  )}
                  {visit.patient.address && (
                    <div>
                      <span className="text-slate-500">Address:</span>{' '}
                      <span className="text-slate-800">
                        {visit.patient.address}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Doctor:</span>{' '}
                    <strong className="text-teal-900">
                      {visit.doctor.name}
                    </strong>
                  </div>
                  {visit.doctor.nmcNumber && (
                    <div>
                      <span className="text-slate-500">NMC Reg:</span>{' '}
                      <span className="font-mono text-slate-700">
                        {visit.doctor.nmcNumber}
                      </span>
                    </div>
                  )}
                  {doctorSpeciality && (
                    <div className="text-[10px] text-slate-500">
                      {doctorSpeciality}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="py-1">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 font-bold text-slate-900 uppercase">
                      <th className="py-1 px-1 text-center w-6">#</th>
                      <th className="py-1 px-1">Particulars / Service Description</th>
                      <th className="py-1 px-1 text-center w-12">Qty</th>
                      <th className="py-1 px-1 text-right w-20">Rate</th>
                      <th className="py-1 px-1 text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="py-0.5">
                      <td className="py-1 px-1 text-center font-mono text-slate-500">
                        1
                      </td>
                      <td className="py-1 px-1">
                        <div className="font-bold text-slate-900">
                          Doctor OPD Consultation Fee
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Consulting: {visit.doctor.name}
                        </div>
                      </td>
                      <td className="py-1 px-1 text-center font-mono">1</td>
                      <td className="py-1 px-1 text-right font-mono">
                        {consultationFee.toFixed(2)}
                      </td>
                      <td className="py-1 px-1 text-right font-mono font-bold">
                        {consultationFee.toFixed(2)}
                      </td>
                    </tr>
                    {additionalCharge > 0 && (
                      <tr className="py-0.5">
                        <td className="py-1 px-1 text-center font-mono text-slate-500">
                          2
                        </td>
                        <td className="py-1 px-1">
                          <div className="font-bold text-slate-900">
                            Clinical Procedure / Additional Service
                          </div>
                          <div className="text-[10px] text-slate-600 italic">
                            {visit.additionalChargeNote ||
                              visit.chargeNote ||
                              'Service charge'}
                          </div>
                        </td>
                        <td className="py-1 px-1 text-center font-mono">1</td>
                        <td className="py-1 px-1 text-right font-mono">
                          {additionalCharge.toFixed(2)}
                        </td>
                        <td className="py-1 px-1 text-right font-mono font-bold">
                          {additionalCharge.toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation & Words Box */}
              <div className="border-t-2 border-slate-800 pt-2 space-y-2">
                <div className="flex items-start justify-between gap-4 text-[11px]">
                  {/* Left: In Words & Notes */}
                  <div className="flex-1 min-w-0 max-w-[50%] space-y-1">
                    <div>
                      <span className="text-slate-500 block text-[10px]">
                        In Words:
                      </span>
                      <strong className="text-slate-900 italic font-semibold leading-tight block break-words text-[11px]">
                        {numberToWords(totalCharge)}
                      </strong>
                    </div>
                    <div className="text-slate-500 pt-1 border-t border-slate-200 text-[9px] space-y-0.5">
                      <p>• Valid for consultation with indicated doctor on date of issue.</p>
                      <p>• Please keep this receipt safe for follow-up and clinical record.</p>
                      <p className="font-medium text-emerald-800">
                        • Get well soon! (स्वास्थ्य लाभको शुभकामना!)
                      </p>
                    </div>
                  </div>

                  {/* Right: Totals Breakdown */}
                  <div className="w-60 shrink-0 pr-1 text-[11px] ml-auto space-y-0.5 text-right font-mono">
                    <div className="flex justify-between text-slate-600 gap-2">
                      <span className="whitespace-nowrap">Consultation:</span>
                      <span className="whitespace-nowrap">
                        Rs. {consultationFee.toFixed(2)}
                      </span>
                    </div>
                    {additionalCharge > 0 && (
                      <div className="flex justify-between text-teal-800 gap-2">
                        <span className="whitespace-nowrap">Procedure Charge:</span>
                        <span className="whitespace-nowrap">
                          Rs. {additionalCharge.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t-2 border-b-2 border-slate-900 font-black text-slate-900 gap-2 py-1 text-xs">
                      <span className="whitespace-nowrap">Total Payable:</span>
                      <span className="whitespace-nowrap">
                        Rs. {totalCharge.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-semibold gap-2 pt-0.5">
                      <span className="whitespace-nowrap">{paidLineLabel}</span>
                      <span className="whitespace-nowrap">
                        Rs. {totalCharge.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-700 gap-2">
                      <span className="whitespace-nowrap">Balance Due:</span>
                      <span className="whitespace-nowrap">Rs. 0.00</span>
                    </div>
                  </div>
                </div>

                {/* Staff / Billed Info */}
                <div className="pt-3 text-[10px] text-slate-500">
                  <span>Billed By: </span>
                  <strong className="text-slate-800">{cashierName}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar (print:hidden) */}
        <div className="bg-slate-100 border-t border-slate-300 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="hidden sm:inline">Format:</span>
            <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded border border-slate-300">
              {format === 'a5' ? 'A5 Half Sheet' : '80mm Thermal Roll'}
            </span>
            <span className="text-[11px] text-slate-400">
              (Press <strong>Esc</strong> to close)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Close Button */}
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
              title="Print OPD Bill now"
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
