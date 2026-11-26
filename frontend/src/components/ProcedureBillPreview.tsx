import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileDown, Printer, X } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import prakashLogo from '../assets/pharmacy-login-logo.png';
import NepaliDate from 'nepali-date-converter';

/** This is the persisted bill representation returned by /clinic-procedures. */
export type ProcedureInvoice = {
  id: number;
  invoiceNumber: string;
  patientId: number | null;
  clinicNumber: string | null;
  patientName: string;
  patientPhone: string | null;
  paymentMethod: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  createdBy: { name: string; username: string } | null;
  items: Array<{
    serviceId: number | null;
    serviceName: string;
    quantity: number;
    unitFee: number;
    lineTotal: number;
  }>;
};

type BillFormat = 'a5' | 'thermal';

type Props = {
  invoice: ProcedureInvoice | null;
  onClose: () => void;
};

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const currency = (amount: number): string =>
  `Rs. ${Number(amount).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Only use safe image URL schemes in HTML attributes inside the print frame. */
const safeLogoUrl = (value: string, fallback: string): string => {
  const url = value.trim();
  if (/^(https?:\/\/|\/[^/]|data:image\/(?:png|jpe?g|webp|gif);base64,)/i.test(url)) return url;
  return fallback;
};

const paymentName = (method: string): string => {
  if (method === 'fonepay_qr') return 'Fonepay QR';
  if (method === 'card') return 'Card';
  if (method === 'cash') return 'Cash';
  return method.replace(/_/g, ' ');
};

type BrandSettings = {
  storeName: string;
  address: string;
  phoneNumber: string;
  emailId: string;
  panNumber: string;
  ddaLicenceNumber: string;
  storeLogo: string;
  vatRegistered: boolean;
  invoiceDateFormat: 'BS' | 'AD';
};

/** POS-style procedure bill, without medicine-specific tax calculations. */
const buildBillDocument = (
  invoice: ProcedureInvoice,
  settings: BrandSettings,
  format: BillFormat
): string => {
  const thermal = format === 'thermal';
  const timestamp = new Date(invoice.createdAt);

  const localParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp);

  const part = (name: string) =>
    Number(localParts.find(p => p.type === name)?.value || 0);

  const localDate = new Date(
    part('year'),
    part('month') - 1,
    part('day')
  );

  const displayDate = settings.invoiceDateFormat === 'BS'
    ? new NepaliDate(localDate).format('DD MMMM YYYY', 'en')
    : timestamp.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kathmandu',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  const displayTime = timestamp.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kathmandu',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const storeName = escapeHtml(settings.storeName || 'Prakash Pharmacy');
  const logoUrl = escapeHtml(
    safeLogoUrl(settings.storeLogo || '', prakashLogo)
  );

  const labelValue = (
    label: string,
    value: unknown,
    strong = false
  ) => `
    <div class="entry">
      <span class="muted">${label}:</span>
      <span class="${strong ? 'emphasis' : ''}">${escapeHtml(value)}</span>
    </div>`;

  const left = [
    labelValue('Bill No', invoice.invoiceNumber, true),
    labelValue('Date/Time', `${displayDate} ${displayTime}`),
    labelValue('Payment', paymentName(invoice.paymentMethod).toUpperCase(), true),
    labelValue(
      'Cashier',
      invoice.createdBy?.name || invoice.createdBy?.username || 'Staff',
      true
    ),
  ].join('');

  const right = [
    labelValue('Patient', invoice.patientName, true),
    ...(invoice.patientPhone
      ? [labelValue('Phone', invoice.patientPhone)]
      : []),
    ...(invoice.clinicNumber
      ? [labelValue('Patient ID', invoice.clinicNumber)]
      : []),
  ].join('');

  const rows = invoice.items.map((item, index) => `
    <tr>
      <td class="idx">${index + 1}</td>
      <td class="procedure">${escapeHtml(item.serviceName)}</td>
      <td class="amount">${escapeHtml(currency(item.lineTotal))}</td>
    </tr>
  `).join('');

  const under1000 = (n: number): string => {
    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five',
      'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
      'Fifteen', 'Sixteen', 'Seventeen',
      'Eighteen', 'Nineteen'
    ];

    const tens = [
      '', '', 'Twenty', 'Thirty', 'Forty',
      'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    if (n < 20) return ones[n];

    if (n < 100) {
      return [tens[Math.floor(n / 10)], ones[n % 10]]
        .filter(Boolean)
        .join(' ');
    }

    return [
      ones[Math.floor(n / 100)],
      'Hundred',
      under1000(n % 100)
    ].filter(Boolean).join(' ');
  };

  const toWords = (amount: number): string => {
    let n = Math.floor(Math.max(0, amount));

    if (!n) return 'Zero Rupees Only';

    const sections: string[] = [];

    for (const [divisor, label] of [
      [10000000, 'Crore'],
      [100000, 'Lakh'],
      [1000, 'Thousand']
    ] as const) {
      if (n >= divisor) {
        sections.push(
          `${under1000(Math.floor(n / divisor))} ${label}`
        );
        n %= divisor;
      }
    }

    if (n) sections.push(under1000(n));

    return `${sections.join(' ')} Rupees Only`;
  };

  const paperHeight = Math.min(
    650,
    Math.max(
      105,
      98 + invoice.items.reduce(
        (sum, item) =>
          sum + 8 + Math.ceil(item.serviceName.length / 24) * 4,
        0
      ) + (
        invoice.notes
          ? 12 + Math.ceil(invoice.notes.length / 24) * 4
          : 0
      )
    )
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Procedure Bill ${escapeHtml(invoice.invoiceNumber)}</title>

<style>
@page {
  size: ${thermal ? `80mm ${paperHeight}mm` : 'A5 portrait'};
  margin: ${thermal ? '3mm' : '7mm'};
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
}

body {
  color: #0f172a;
  background: #eef2f7;
  font-family: Arial, Helvetica, sans-serif;
  font-size: ${thermal ? '10px' : '11px'};
}

.sheet {
  width: ${thermal ? '80mm' : '148mm'};
  max-width: 100%;
  margin: 12px auto;
  padding: ${thermal ? '4mm' : '9mm'};
  background: white;
  box-shadow: 0 6px 20px #0f172a14;
  overflow-wrap: anywhere;
}

.brand {
  text-align: center;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 10px;
}

.brand img {
  display: block;
  width: ${thermal ? '58px' : '150px'};
  height: ${thermal ? '56px' : '155px'};
  max-width: 100%;
  object-fit: contain;
  margin: 0 auto 5px;
}

.bill-kind {
  font-weight: 900;
  letter-spacing: .07em;
  font-size: ${thermal ? '10px' : '12px'};
  margin-bottom: 5px;
}

h1 {
  font-size: ${thermal ? '16px' : '20px'};
  margin: 3px 0 6px;
  font-weight: 900;
}

.brand p {
  margin: 4px 0;
  color: #475569;
  font-size: ${thermal ? '9px' : '10px'};
}

.reg {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  padding-top: 6px;
}

.reg span {
  border: 1px solid #cbd5e1;
  background: #f1f5f9;
  border-radius: 4px;
  padding: 4px 7px;
  font-size: ${thermal ? '8px' : '9px'};
  font-weight: 700;
}

.meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 13px 0 11px;
  border-bottom: 1px solid #cbd5e1;
  line-height: 1.65;
}

.meta-right { text-align: right; }

.entry {
  margin: 1px 0;
  overflow-wrap: anywhere;
}

.muted { color: #64748b; }
.emphasis { font-weight: 700; }

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: ${thermal ? '9px' : '11px'};
  margin-top: 12px;
}

thead { display: table-header-group; }

th {
  padding: 6px 4px;
  border-bottom: 1px solid #0f172a;
  text-align: left;
  font-weight: 800;
}

td {
  padding: 9px 4px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

tr { break-inside: avoid; }

.idx {
  width: ${thermal ? '19px' : '24px'};
  color: #64748b;
  text-align: center;
}

.procedure { font-weight: 700; }

.amount {
  width: ${thermal ? '85px' : '125px'};
  text-align: right;
  font-weight: 700;
  white-space: nowrap;
}

.summary {
  display: grid;
  grid-template-columns: ${thermal ? '1fr' : '1fr 1fr'};
  gap: 12px;
  margin-top: 15px;
  padding-top: 10px;
  border-top: 2px solid #0f172a;
}

.words {
  font-size: ${thermal ? '9px' : '10px'};
  color: #64748b;
}

.words strong {
  color: #0f172a;
  display: block;
  margin-top: 3px;
  font-style: italic;
}

.total-row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 0;
}

.total-row.major {
  border-top: 1px solid #0f172a;
  border-bottom: 1px solid #0f172a;
  font-weight: 900;
  font-size: ${thermal ? '11px' : '12px'};
}

.total-row.paid {
  color: #047857;
  font-weight: 800;
}

.notes {
  font-size: 10px;
  white-space: pre-wrap;
  margin-top: 13px;
}

.footer {
  margin-top: 24px;
  text-align: center;
  font-size: 10px;
  color: #64748b;
}

@media print {
  body { background: white; }

  .sheet {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }

  .reg span {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
</head>

<body>
<main class="sheet">

<header class="brand">
  <img src="${logoUrl}" alt="Prakash Pharmacy logo">

  <div class="bill-kind">PROCEDURE BILL</div>

  <h1>${storeName}</h1>

  ${settings.address
    ? `<p>${escapeHtml(settings.address)}</p>`
    : ''}

  ${settings.phoneNumber || settings.emailId
    ? `<p>${settings.phoneNumber
        ? `Phone: ${escapeHtml(settings.phoneNumber)}`
        : ''}${settings.phoneNumber && settings.emailId
        ? ' | '
        : ''}${settings.emailId
        ? `Email: ${escapeHtml(settings.emailId)}`
        : ''}</p>`
    : ''}

  <div class="reg">
    ${settings.panNumber
      ? `<span>PAN: ${escapeHtml(settings.panNumber)}</span>`
      : ''}

    ${settings.ddaLicenceNumber
      ? `<span>DDA: ${escapeHtml(settings.ddaLicenceNumber)}</span>`
      : ''}

    <span>${settings.vatRegistered
      ? 'VAT Registered'
      : 'Not VAT Registered'}</span>
  </div>
</header>

<section class="meta">
  <div class="meta-left">${left}</div>
  <div class="meta-right">${right}</div>
</section>

<table>
  <thead>
    <tr>
      <th class="idx">#</th>
      <th>PROCEDURE</th>
      <th class="amount">TOTAL</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<section class="summary">
  <div class="words">
    <span>In Words:</span>
    <strong>${escapeHtml(toWords(invoice.totalAmount))}</strong>
  </div>

  <div class="totals">
    <div class="total-row">
      <span>Procedure Charges:</span>
      <span>${escapeHtml(currency(invoice.totalAmount))}</span>
    </div>

    <div class="total-row major">
      <span>Grand Total:</span>
      <span>${escapeHtml(currency(invoice.totalAmount))}</span>
    </div>

    <div class="total-row paid">
      <span>Paid:</span>
      <span>${escapeHtml(currency(invoice.totalAmount))}</span>
    </div>

    <div class="total-row">
      <span>Balance Due:</span>
      <span>Rs. 0.00</span>
    </div>
  </div>
</section>

${invoice.notes
  ? `<p class="notes"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>`
  : ''}

<div class="footer">Thank you for your visit.</div>

</main>
</body>
</html>`;
};

export const ProcedureBillPreview: React.FC<Props> = ({ invoice, onClose }) => {
  const { settings } = usePharmacy();
  const [format, setFormat] = useState<BillFormat>(settings.defaultInvoiceSize === 'Thermal' ? 'thermal' : 'a5');
  const [frameReady, setFrameReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () => invoice ? buildBillDocument(invoice, settings, format) : '',
    [invoice, settings, format],
  );

  useEffect(() => {
    if (!invoice) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [invoice, onClose]);

  useEffect(() => { setFrameReady(false); }, [html]);

  if (!invoice) return null;

  const printBill = () => {
    if (!frameReady || !frameRef.current?.contentWindow) return;
    const printableWindow = frameRef.current.contentWindow;
    printableWindow.focus();
    printableWindow.print();
  };

  return (
    <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={`Procedure bill ${invoice.invoiceNumber}`}>
      <div className={`flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${format === 'thermal' ? 'max-w-sm' : 'max-w-2xl'}`}>
        <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white sm:px-6">
          <div className="flex items-center gap-2 text-xs font-extrabold tracking-wide">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>BILL PREVIEW: {invoice.invoiceNumber}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1 text-xs">
            <button type="button" onClick={() => setFormat('a5')} className={`rounded-md px-3 py-1.5 font-semibold ${format === 'a5' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}>A5 Size Bill</button>
            <button type="button" onClick={() => setFormat('thermal')} className={`rounded-md px-3 py-1.5 font-semibold ${format === 'thermal' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}>80mm Thermal</button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 px-2 py-3 sm:px-4">
          <iframe
            ref={frameRef}
            key={`${invoice.id}-${format}`}
            srcDoc={html}
            onLoad={() => setFrameReady(true)}
            title={`Procedure payment bill ${invoice.invoiceNumber}`}
            className="h-[67dvh] min-h-[300px] w-full rounded-lg border border-slate-200 bg-white"
          />
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-100 px-4 py-3 sm:px-6">
          <div className="text-xs font-semibold text-slate-600">Format: {format === 'a5' ? 'A5 Half Sheet' : '80mm Thermal Roll'}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800"><X className="h-4 w-4" /> Close (Esc)</button>
            <button type="button" disabled={!frameReady} onClick={printBill} title="Choose Save as PDF in the print dialog" className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-800 disabled:opacity-40"><FileDown className="h-4 w-4" /> Save as PDF</button>
            <button type="button" disabled={!frameReady} onClick={printBill} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Printer className="h-4 w-4" /> Print Bill ({format === 'a5' ? 'A5' : 'Thermal'})</button>
          </div>
        </footer>
      </div>
    </div>
  );
};
