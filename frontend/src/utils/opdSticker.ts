/**
 * OPD arrival sticker: 60 mm wide × 50 mm high (landscape).
 *
 * The large on-screen preview is intentionally scaled up; printed dimensions
 * remain 60 × 50 mm. The printer driver must also have matching paper media
 * (and 100% scale, zero margins, headers/footers disabled) for exact output.
 * No server-side changes or third-party barcode dependencies are required.
 */
export interface OpdStickerVisit {
  opdNumber: string;
  patient: {
    clinicNumber: string;
    name: string;
    phone?: string | null;
    gender?: string | null;
  };
  doctor: {
    name: string;
    speciality?: string | null;
    qualification?: string | null;
    nmcNumber?: string | null;
  };
  visitDateTime: string;
  ageAtVisit: number | null;
  ageMonthsAtVisit?: number | null;
  ageUnitAtVisit?: string | null;
  consultationFee?: number;
  totalCharge: number;
  chargeNote?: string | null;
  createdBy?: {
    name?: string;
    username?: string;
  } | null;
}

export const OPD_STICKER_WIDTH_MM = 60;
export const OPD_STICKER_HEIGHT_MM = 50;

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatAge = (visit: OpdStickerVisit): string => {
  const years = visit.ageAtVisit;
  const months = visit.ageMonthsAtVisit;
  if (visit.ageUnitAtVisit === 'days') {
    const days = months ?? years;
    return days === null || days === undefined ? '-' : `${days} days`;
  }
  if (visit.ageUnitAtVisit === 'months' || (months && (years === 0 || years === null))) {
    return `${months ?? 0} mo`;
  }
  if (years === null || years === undefined) return '-';
  return months && months > 0 ? `${years}y ${months}m` : `${years} yrs`;
};

/** Standard Code 39 patterns: n = narrow, w = wide; bar/space alternating. */
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn',
  'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn',
  'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn', 'K': 'wnnnnnnww',
  'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww',
  'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn',
  'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

/**
 * Include a genuine Code 39 barcode only when the OPD ID can be encoded at a
 * readable size on a 60 mm ticket. Otherwise the human-readable ID remains.
 */
const makeOpdBarcode = (opdNumber: string): string => {
  const value = String(opdNumber || '').trim().toUpperCase();
  if (!value || value.length > 16 || !/^[A-Z0-9. $/+%-]+$/.test(value)) return '';

  let x = 12; // quiet zone
  const bars: string[] = [];
  for (const character of `*${value}*`) {
    const pattern = CODE39[character];
    if (!pattern) return '';
    for (let index = 0; index < pattern.length; index += 1) {
      const width = pattern[index] === 'w' ? 2.5 : 1;
      if (index % 2 === 0) {
        bars.push(`<rect x="${x}" y="0" width="${width}" height="25"/>`);
      }
      x += width;
    }
    x += 1; // inter-character gap
  }
  const width = x + 11;
  return `<svg class="barcode" viewBox="0 0 ${width} 25" role="img" aria-label="OPD number barcode" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><g fill="#000">${bars.join('')}</g></svg>`;
};

/** Print preview HTML is kept in one file so existing OPD screens need no edits. */
export const buildOpdStickerHtml = (
  visit: OpdStickerVisit,
  storeName = 'Clinic / OPD'
): string => {
  const ageSex = [formatAge(visit), visit.patient.gender || '-'].join(' / ');
  const speciality = [visit.doctor.speciality, visit.doctor.qualification]
    .filter(Boolean)
    .join(' · ');
  const enteredBy = visit.createdBy?.name || visit.createdBy?.username || '';
  const feeValue = Number(visit.consultationFee ?? visit.totalCharge ?? 0);
  const fee = Number.isFinite(feeValue) ? feeValue.toFixed(2) : '0.00';
  const barcode = makeOpdBarcode(visit.opdNumber);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OPD Sticker - ${escapeHtml(visit.opdNumber)}</title>
  <style>
    @page { size: ${OPD_STICKER_WIDTH_MM}mm ${OPD_STICKER_HEIGHT_MM}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
    body { background: #f3f5f8; color: #111; }

    .toolbar {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 16px 24px; background: #fff;
      box-shadow: 0 1px 5px rgba(0,0,0,.12); flex-wrap: wrap;
    }
    .toolbar-title { font-size: 17px; font-weight: 800; }
    .toolbar-sub { font-size: 12px; color: #475569; margin-top: 3px; }
    .actions { display: flex; gap: 9px; }
    .actions button {
      border-radius: 8px; border: 1px solid #cbd5e1; background: #fff;
      cursor: pointer; padding: 10px 17px; font: 700 13px Arial, sans-serif;
    }
    .actions .print-btn { background: #0f766e; color: #fff; border-color: #0f766e; }
    .print-btn:hover { background: #115e59; }
    .instructions { font-size: 12px; line-height: 1.55; color: #475569; text-align: center; margin: 16px auto; padding: 0 16px; max-width: 740px; }
    .preview-stage { padding: 18px 14px 30px; overflow-x: auto; }
    .preview-paper { position: relative; width: 132mm; height: 110mm; margin: 0 auto; filter: drop-shadow(0 12px 25px rgba(15,23,42,.22)); }

    .sticker {
      width: ${OPD_STICKER_WIDTH_MM}mm; height: ${OPD_STICKER_HEIGHT_MM}mm;
      padding: 1.8mm 2.1mm 1.5mm; overflow: hidden; background: #fff; color: #000;
      display: flex; flex-direction: column;
      position: absolute; left: 0; top: 0;
      transform: scale(2.2); transform-origin: top left;
    }
    /* Let the entire pharmacy name use the label width, not compete with the date. */
    .head { display: flex; flex-direction: column; gap: .45mm; border-bottom: .35mm solid #000; padding-bottom: .9mm; }
    .brand-name { width: 100%; font-size: 9.3pt; line-height: 1.05; font-weight: 900; white-space: normal; overflow-wrap: anywhere; }
    .head-details { display: flex; align-items: baseline; justify-content: space-between; gap: 1.5mm; min-width: 0; }
    .brand-sub { font-size: 5.3pt; letter-spacing: .08mm; font-weight: 700; white-space: nowrap; }
    .date { text-align: right; font-size: 6.2pt; line-height: 1.15; font-weight: 700; white-space: nowrap; flex-shrink: 0; }

    .identity { display: flex; justify-content: space-between; gap: 1.4mm; padding: 1.2mm 0 1mm; border-bottom: .2mm solid #333; align-items: center; }
    .opd-group { flex: 1; min-width: 0; }
    .eyebrow { font-size: 5.3pt; line-height: 1.12; letter-spacing: .12mm; font-weight: 800; }
    .opd-number { font-size: 9.8pt; line-height: 1.1; font-weight: 900; overflow-wrap: anywhere; max-height: 6.4mm; overflow: hidden; }
    .clinic-no { text-align: right; max-width: 24mm; min-width: 0; font-size: 7.7pt; line-height: 1.13; font-weight: 800; overflow-wrap: anywhere; max-height: 8mm; overflow: hidden; }

    .patient { padding: 1.15mm 0 .8mm; }
    .patient-name { font-size: 10.6pt; font-weight: 900; line-height: 1.12; overflow-wrap: anywhere; max-height: 9mm; overflow: hidden; }
    .metadata { display: grid; grid-template-columns: 1fr 1.15fr; gap: 2mm; border-bottom: .2mm solid #333; padding-bottom: 1.05mm; }
    .field-value { display: block; font-size: 7.4pt; line-height: 1.13; font-weight: 800; overflow-wrap: anywhere; max-height: 6.1mm; overflow: hidden; }

    .doctor { padding: 1mm 0 .8mm; display: flex; align-items: flex-start; justify-content: space-between; gap: 1mm; }
    .doctor-main { flex: 1; min-width: 0; }
    .doctor-name { font-size: 8.1pt; font-weight: 900; line-height: 1.17; overflow-wrap: anywhere; max-height: 7mm; overflow: hidden; }
    .speciality { margin-top: .3mm; font-size: 5.7pt; line-height: 1.12; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .fee-box { border: .25mm solid #000; padding: .7mm 1.1mm; text-align: right; min-width: 18mm; }
    .fee { font-weight: 900; font-size: 8.2pt; line-height: 1.12; white-space: nowrap; }

    .bottom { margin-top: auto; border-top: .3mm solid #000; padding-top: .65mm; display: flex; align-items: flex-end; gap: 1mm; justify-content: space-between; min-height: 5.2mm; }
    .bottom-meta { font-size: 5pt; line-height: 1.15; max-width: 28mm; overflow: hidden; }
    .barcode { display: block; width: 29mm; max-height: 5.2mm; height: 5.2mm; flex-shrink: 0; }
    .without-barcode { text-align: right; font-size: 5.5pt; font-weight: 800; }

    @media screen and (max-width: 560px) {
      .toolbar { padding: 12px 14px; }
      .preview-paper { width: 90mm; height: 75mm; }
      .sticker { transform: scale(1.5); }
      .instructions { font-size: 11px; }
    }
    @media print {
      html, body { width: ${OPD_STICKER_WIDTH_MM}mm !important; height: ${OPD_STICKER_HEIGHT_MM}mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: hidden !important; }
      .toolbar, .instructions { display: none !important; }
      .preview-stage, .preview-paper { width: ${OPD_STICKER_WIDTH_MM}mm !important; height: ${OPD_STICKER_HEIGHT_MM}mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; filter: none !important; }
      .sticker { position: relative !important; left: auto !important; top: auto !important; transform: none !important; margin: 0 !important; box-shadow: none !important; }
      *, *::before, *::after { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <div class="toolbar-title">OPD sticker preview</div>
      <div class="toolbar-sub">Landscape · 60 × 50 mm · Preview enlarged for readability</div>
    </div>
    <div class="actions">
      <button type="button" id="close-sticker">Close</button>
      <button type="button" class="print-btn" id="print-sticker">Print sticker</button>
    </div>
  </div>

  <div class="preview-stage">
    <div class="preview-paper">
      <section class="sticker" aria-label="OPD arrival sticker">
        <div class="head">
          <div class="brand-name">${escapeHtml(storeName)}</div>
          <div class="head-details">
            <div class="brand-sub">OPD VISIT STICKER</div>
            <div class="date">${escapeHtml(formatDateTime(visit.visitDateTime))}</div>
          </div>
        </div>
        <div class="identity">
          <div class="opd-group">
            <div class="eyebrow">OPD / VISIT NO.</div>
            <div class="opd-number">${escapeHtml(visit.opdNumber)}</div>
          </div>
          <div>
            <div class="eyebrow" style="text-align:right">PATIENT ID</div>
            <div class="clinic-no">${escapeHtml(visit.patient.clinicNumber)}</div>
          </div>
        </div>
        <div class="patient">
          <div class="eyebrow">PATIENT NAME</div>
          <div class="patient-name">${escapeHtml(visit.patient.name)}</div>
        </div>
        <div class="metadata">
          <div><div class="eyebrow">AGE / SEX</div><span class="field-value">${escapeHtml(ageSex)}</span></div>
          <div><div class="eyebrow">PHONE</div><span class="field-value">${escapeHtml(visit.patient.phone || '-')}</span></div>
        </div>
        <div class="doctor">
          <div class="doctor-main">
            <div class="eyebrow">CONSULTING DOCTOR</div>
            <div class="doctor-name">${escapeHtml(visit.doctor.name)}</div>
            ${speciality ? `<div class="speciality">${escapeHtml(speciality)}</div>` : ''}
          </div>
          <div class="fee-box"><div class="eyebrow">CONSULTATION</div><div class="fee">Rs. ${escapeHtml(fee)}</div></div>
        </div>
        <div class="bottom">
          <div class="bottom-meta">${enteredBy ? `Registered by: ${escapeHtml(enteredBy)}` : 'Keep this sticker for your visit.'}${visit.doctor.nmcNumber ? `<div>NMC: ${escapeHtml(visit.doctor.nmcNumber)}</div>` : ''}</div>
          ${barcode || `<div class="without-barcode">${escapeHtml(visit.opdNumber)}</div>`}
        </div>
      </section>
    </div>
  </div>

  <div class="instructions">
    This is an <strong>enlarged screen preview</strong>. The printed ticket remains exactly
    <strong>60 × 50 mm</strong>. In the printer dialog choose matching custom paper, 100% scale,
    no margins, and disable browser headers/footers. If A4 is selected, the sticker will
    appear small on an A4 preview — it will not magically fill that sheet.
  </div>
  <script>
    document.getElementById('print-sticker').addEventListener('click', function () {
      window.focus(); window.print();
    });
    document.getElementById('close-sticker').addEventListener('click', function () {
      window.close();
    });
  </script>
</body>
</html>`;
};

export const printOpdSticker = (
  visit: OpdStickerVisit,
  storeName = 'Clinic / OPD'
): void => {
  const popup = window.open('', '_blank', 'width=880,height=760');
  if (!popup) {
    window.alert('The OPD sticker preview was blocked. Allow pop-ups for this site and try again.');
    return;
  }
  popup.document.open();
  popup.document.write(buildOpdStickerHtml(visit, storeName));
  popup.document.close();
};
