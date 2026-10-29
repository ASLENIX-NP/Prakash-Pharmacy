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

  ageAtVisit:
    | number
    | null;

  consultationFee?: number;
  totalCharge: number;

  chargeNote?: string | null;

  createdBy?:
    | {
        name?: string;
        username?: string;
      }
    | null;
}


/*
 * Client printer size is approximately 50 x 70 mm.
 * These two constants can be changed later if their
 * physical sticker roll uses a slightly different size.
 */
export const OPD_STICKER_WIDTH_MM = 50;
export const OPD_STICKER_HEIGHT_MM = 70;


const escapeHtml = (
  value: unknown
): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');


const readableDateTime = (
  value: string
): string => {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
};


export const printOpdSticker = (
  visit: OpdStickerVisit,
  storeName = 'Clinic / OPD'
): void => {
  const printWindow =
    window.open(
      '',
      '_blank',
      'width=430,height=620'
    );

  if (!printWindow) {
    window.alert(
      'The sticker print window was blocked. Please allow pop-ups for this application and try again.'
    );

    return;
  }


  const ageSex = [
    visit.ageAtVisit !== null &&
    visit.ageAtVisit !== undefined
      ? String(
          visit.ageAtVisit
        )
      : '',

    visit.patient.gender ||
      '',
  ]
    .filter(Boolean)
    .join(' / ');


  const doctorDetails = [
    visit.doctor.speciality,
    visit.doctor.qualification,
  ]
    .filter(Boolean)
    .join(' | ');


  const enteredBy =
    visit.createdBy?.name ||
    visit.createdBy?.username ||
    '';


  const html =
`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />

  <title>${escapeHtml(
    visit.opdNumber
  )}</title>

  <style>
    @page {
      size: ${OPD_STICKER_WIDTH_MM}mm ${OPD_STICKER_HEIGHT_MM}mm;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: ${OPD_STICKER_WIDTH_MM}mm;
      height: ${OPD_STICKER_HEIGHT_MM}mm;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      overflow: hidden;
    }

    .sticker {
      width: ${OPD_STICKER_WIDTH_MM}mm;
      min-height: ${OPD_STICKER_HEIGHT_MM}mm;
      padding: 2.6mm 2.8mm;
      display: flex;
      flex-direction: column;
    }

    .clinic {
      text-align: center;
      font-size: 8.5pt;
      line-height: 1.1;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .heading {
      margin-top: 1mm;
      padding: 1mm 0;
      border-top: 0.35mm solid #000;
      border-bottom: 0.35mm solid #000;
      text-align: center;
    }

    .opd {
      font-size: 10.5pt;
      line-height: 1.1;
      font-weight: 900;
      letter-spacing: 0.2mm;
    }

    .date {
      margin-top: 0.5mm;
      font-size: 6.6pt;
      line-height: 1.2;
      font-weight: 600;
    }

    .section {
      padding: 1.3mm 0;
      border-bottom: 0.2mm solid #777;
    }

    .row {
      display: flex;
      gap: 1mm;
      margin: 0.55mm 0;
      font-size: 7.1pt;
      line-height: 1.2;
    }

    .label {
      flex: 0 0 13mm;
      font-weight: 700;
    }

    .value {
      flex: 1;
      min-width: 0;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .patient-name {
      font-size: 8.3pt;
      font-weight: 900;
    }

    .doctor-name {
      font-size: 7.8pt;
      font-weight: 900;
    }

    .amount-box {
      margin-top: 1.2mm;
      padding: 1.2mm 1.5mm;
      border: 0.35mm solid #000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2mm;
    }

    .amount-label {
      font-size: 7.2pt;
      font-weight: 800;
    }

    .amount {
      font-size: 10pt;
      font-weight: 900;
      white-space: nowrap;
    }

    .note {
      margin-top: 1mm;
      font-size: 6.5pt;
      line-height: 1.2;
      max-height: 8mm;
      overflow: hidden;
    }

    .footer {
      margin-top: auto;
      padding-top: 1mm;
      font-size: 5.8pt;
      line-height: 1.2;
      text-align: center;
    }

    @media print {
      html,
      body {
        width: ${OPD_STICKER_WIDTH_MM}mm;
        height: ${OPD_STICKER_HEIGHT_MM}mm;
      }
    }
  </style>
</head>

<body>
  <div class="sticker">

    <div class="clinic">
      ${escapeHtml(
        storeName
      )}
    </div>

    <div class="heading">
      <div class="opd">
        ${escapeHtml(
          visit.opdNumber
        )}
      </div>

      <div class="date">
        ${escapeHtml(
          readableDateTime(
            visit.visitDateTime
          )
        )}
      </div>
    </div>

    <div class="section">

      <div class="row">
        <div class="label">
          Clinic No.
        </div>

        <div class="value">
          ${escapeHtml(
            visit.patient.clinicNumber
          )}
        </div>
      </div>

      <div class="row">
        <div class="label">
          Patient
        </div>

        <div class="value patient-name">
          ${escapeHtml(
            visit.patient.name
          )}
        </div>
      </div>

      <div class="row">
        <div class="label">
          Phone
        </div>

        <div class="value">
          ${escapeHtml(
            visit.patient.phone ||
              '-'
          )}
        </div>
      </div>

      <div class="row">
        <div class="label">
          Age / Sex
        </div>

        <div class="value">
          ${escapeHtml(
            ageSex || '-'
          )}
        </div>
      </div>

    </div>

    <div class="section">

      <div class="row">
        <div class="label">
          Doctor
        </div>

        <div class="value doctor-name">
          ${escapeHtml(
            visit.doctor.name
          )}
        </div>
      </div>

      <div class="row">
        <div class="label">
          Specialty
        </div>

        <div class="value">
          ${escapeHtml(
            doctorDetails ||
              '-'
          )}
        </div>
      </div>

      <div class="row">
        <div class="label">
          NMC No.
        </div>

        <div class="value">
          ${escapeHtml(
            visit.doctor.nmcNumber ||
              '-'
          )}
        </div>
      </div>

    </div>

    <div class="amount-box">
      <div class="amount-label">
        CONSULTATION FEE
      </div>

      <div class="amount">
        Rs. ${escapeHtml(
          Number(
            visit.consultationFee ??
              visit.totalCharge ??
              0
          ).toFixed(2)
        )}
      </div>
    </div>

    <div class="footer">
      ${
        enteredBy
          ? `Entry: ${escapeHtml(
              enteredBy
            )}`
          : ''
      }
    </div>

  </div>

  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 100);
    };

    window.onafterprint = function () {
      window.close();
    };
  </script>
</body>
</html>`;


  printWindow.document.open();
  printWindow.document.write(
    html
  );
  printWindow.document.close();
};
