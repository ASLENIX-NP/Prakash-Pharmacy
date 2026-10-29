import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Banknote,
  CalendarDays,
  ClipboardList,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';

import { apiRequest } from '../services/api';
import { usePharmacy } from '../context/PharmacyContext';


interface Doctor {
  id: string;
  doctorCode: string;
  name: string;
  speciality: string;
  qualification: string;
  nmcNumber: string;
  status: 'active' | 'inactive';
}


interface ClinicPatient {
  id: string;
  clinicNumber: string;
  name: string;
  phone: string;
  gender: string;
  ageYears: number | null;
  address: string;
}


interface ClinicVisit {
  id: string;
  opdNumber: string;

  patient: ClinicPatient;

  doctor: Doctor;

  visitDateTime: string;

  ageAtVisit:
    | number
    | null;

  totalCharge: number;

  chargeNote: string;

  createdBy:
    | {
        id: string;
        username: string;
        name: string;
      }
    | null;
}


interface ClinicReportSummary {
  totalVisits: number;
  uniquePatients: number;
  totalRevenue: number;
  averageRevenuePerVisit: number;
}


interface ClinicReportResponse {
  success: boolean;

  summary: ClinicReportSummary;

  count: number;

  data: ClinicVisit[];
}


interface DoctorListResponse {
  success: boolean;
  count: number;
  data: Doctor[];
}


interface PatientListResponse {
  success: boolean;
  count: number;
  data: ClinicPatient[];
}


interface ReportFilters {
  doctorId: string;
  patientId: string;
  from: string;
  to: string;
}


type DatePreset =
  | 'today'
  | 'week'
  | 'month'
  | 'custom';


const localDateString = (
  date: Date
): string => {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
};


const todayString =
  (): string =>
    localDateString(
      new Date()
    );


const weekStartString =
  (): string => {
    const today =
      new Date();

    const day =
      today.getDay();

    const mondayOffset =
      day === 0
        ? -6
        : 1 - day;

    const monday =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() +
          mondayOffset
      );

    return localDateString(
      monday
    );
  };


const monthStartString =
  (): string => {
    const today =
      new Date();

    return localDateString(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );
  };


const initialFilters =
  (): ReportFilters => ({
    doctorId: '',
    patientId: '',
    from:
      todayString(),
    to:
      todayString(),
  });


const money = (
  value: number
): string =>
  `Rs. ${Number(
    value || 0
  ).toFixed(2)}`;


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


const escapeHtml = (
  value: unknown
): string =>
  String(value ?? '')
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );


const EMPTY_SUMMARY:
  ClinicReportSummary = {
    totalVisits: 0,
    uniquePatients: 0,
    totalRevenue: 0,
    averageRevenuePerVisit: 0,
  };


export const ClinicReportsPanel:
  React.FC = () => {
  const { settings } =
    usePharmacy();


  const [doctors, setDoctors] =
    useState<Doctor[]>([]);


  const [
    filters,
    setFilters,
  ] =
    useState<ReportFilters>(
      initialFilters
    );


  const [
    activePreset,
    setActivePreset,
  ] =
    useState<DatePreset>(
      'today'
    );


  const [
    summary,
    setSummary,
  ] =
    useState<ClinicReportSummary>(
      EMPTY_SUMMARY
    );


  const [
    visits,
    setVisits,
  ] =
    useState<ClinicVisit[]>(
      []
    );


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState('');


  const [
    patientSearch,
    setPatientSearch,
  ] =
    useState('');


  const [
    patientResults,
    setPatientResults,
  ] =
    useState<
      ClinicPatient[]
    >([]);


  const [
    patientSearchLoading,
    setPatientSearchLoading,
  ] =
    useState(false);


  const [
    selectedPatient,
    setSelectedPatient,
  ] =
    useState<
      ClinicPatient | null
    >(null);


  const loadDoctors =
    useCallback(
      async () => {
        try {
          const response =
            await apiRequest<DoctorListResponse>(
              '/doctors?status=all'
            );

          setDoctors(
            Array.isArray(
              response.data
            )
              ? response.data
              : []
          );
        } catch (err) {
          console.error(
            'Unable to load clinic report doctors:',
            err
          );
        }
      },
      []
    );


  const loadReport =
    useCallback(
      async (
        values:
          ReportFilters
      ) => {
        if (
          values.from &&
          values.to &&
          values.from >
            values.to
        ) {
          setError(
            'From date cannot be after To date.'
          );

          return;
        }


        try {
          setLoading(true);
          setError('');


          const params =
            new URLSearchParams();


          if (
            values.doctorId
          ) {
            params.set(
              'doctorId',
              values.doctorId
            );
          }


          if (
            values.patientId
          ) {
            params.set(
              'patientId',
              values.patientId
            );
          }


          if (
            values.from
          ) {
            params.set(
              'from',
              values.from
            );
          }


          if (
            values.to
          ) {
            params.set(
              'to',
              values.to
            );
          }


          const query =
            params.toString();


          const response =
            await apiRequest<ClinicReportResponse>(
              `/clinic-visits/report${
                query
                  ? `?${query}`
                  : ''
              }`
            );


          setSummary(
            response.summary ||
              EMPTY_SUMMARY
          );


          setVisits(
            Array.isArray(
              response.data
            )
              ? response.data
              : []
          );
        } catch (err) {
          setSummary(
            EMPTY_SUMMARY
          );

          setVisits([]);

          setError(
            err instanceof Error
              ? err.message
              : 'Unable to generate clinic report.'
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );


  useEffect(() => {
    const startingFilters =
      initialFilters();

    void loadDoctors();

    void loadReport(
      startingFilters
    );
  }, [
    loadDoctors,
    loadReport,
  ]);


  const applyPreset = (
    preset: DatePreset
  ) => {
    const today =
      todayString();


    let nextFrom =
      filters.from;

    let nextTo =
      filters.to;


    if (
      preset === 'today'
    ) {
      nextFrom =
        today;

      nextTo =
        today;
    }


    if (
      preset === 'week'
    ) {
      nextFrom =
        weekStartString();

      nextTo =
        today;
    }


    if (
      preset === 'month'
    ) {
      nextFrom =
        monthStartString();

      nextTo =
        today;
    }


    const nextFilters = {
      ...filters,
      from:
        nextFrom,
      to:
        nextTo,
    };


    setActivePreset(
      preset
    );

    setFilters(
      nextFilters
    );


    if (
      preset !==
      'custom'
    ) {
      void loadReport(
        nextFilters
      );
    }
  };


  const searchPatients =
    async () => {
      const query =
        patientSearch.trim();


      if (!query) {
        setPatientResults(
          []
        );

        return;
      }


      try {
        setPatientSearchLoading(
          true
        );

        setError('');


        const response =
          await apiRequest<PatientListResponse>(
            `/clinic-patients?search=${encodeURIComponent(
              query
            )}`
          );


        setPatientResults(
          Array.isArray(
            response.data
          )
            ? response.data
            : []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to search clinic patients.'
        );
      } finally {
        setPatientSearchLoading(
          false
        );
      }
    };


  const selectPatient = (
    patient:
      ClinicPatient
  ) => {
    setSelectedPatient(
      patient
    );

    setPatientResults(
      []
    );

    setPatientSearch(
      patient.name
    );

    setFilters(
      (
        previous
      ) => ({
        ...previous,
        patientId:
          patient.id,
      })
    );
  };


  const clearPatient =
    () => {
      setSelectedPatient(
        null
      );

      setPatientSearch(
        ''
      );

      setPatientResults(
        []
      );

      setFilters(
        (
          previous
        ) => ({
        ...previous,
        patientId: '',
      })
    );
  };


  const generateReport =
    () => {
      void loadReport(
        filters
      );
  };


  const printReport =
    () => {
      const printWindow =
        window.open(
          '',
          '_blank',
          'width=1000,height=800'
        );


      if (!printWindow) {
        window.alert(
          'The report print window was blocked. Please allow pop-ups and try again.'
        );

        return;
      }


      const doctorLabel =
        filters.doctorId
          ? doctors.find(
              (doctor) =>
                doctor.id ===
                filters.doctorId
            )?.name ||
            'Selected Doctor'
          : 'All Doctors';


      const patientLabel =
        selectedPatient
          ? `${selectedPatient.name} (${selectedPatient.clinicNumber})`
          : 'All Patients';


      const rows =
        visits
          .map(
            (
              visit,
              index
            ) =>
`<tr>
  <td>${index + 1}</td>
  <td>${escapeHtml(
    readableDateTime(
      visit.visitDateTime
    )
  )}</td>
  <td>${escapeHtml(
    visit.opdNumber
  )}</td>
  <td>
    ${escapeHtml(
      visit.patient.name
    )}
    <br />
    <small>${escapeHtml(
      visit.patient.clinicNumber
    )}</small>
  </td>
  <td>${escapeHtml(
    visit.doctor.name
  )}</td>
  <td>${escapeHtml(
    visit.chargeNote ||
      '-'
  )}</td>
  <td class="money">${escapeHtml(
    money(
      visit.totalCharge
    )
  )}</td>
</tr>`
          )
          .join('');


      const html =
`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />

  <title>Clinic OPD Report</title>

  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
    }

    h1 {
      margin: 0;
      text-align: center;
      font-size: 18px;
    }

    h2 {
      margin: 4px 0 0;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
    }

    .meta {
      margin-top: 14px;
      padding: 9px;
      border: 1px solid #d1d5db;
      font-size: 10px;
      line-height: 1.6;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
      margin-top: 10px;
    }

    .card {
      border: 1px solid #d1d5db;
      padding: 8px;
      text-align: center;
    }

    .card span {
      display: block;
      font-size: 9px;
      color: #6b7280;
    }

    .card strong {
      display: block;
      margin-top: 4px;
      font-size: 14px;
    }

    table {
      width: 100%;
      margin-top: 12px;
      border-collapse: collapse;
    }

    th,
    td {
      border: 1px solid #d1d5db;
      padding: 5px;
      vertical-align: top;
    }

    th {
      background: #f3f4f6;
      font-size: 9px;
      text-align: left;
    }

    small {
      color: #6b7280;
    }

    .money {
      text-align: right;
      white-space: nowrap;
      font-weight: 700;
    }

    .footer {
      margin-top: 10px;
      text-align: right;
      font-size: 9px;
      color: #6b7280;
    }
  </style>
</head>

<body>

  <h1>
    ${escapeHtml(
      settings.storeName
    )}
  </h1>

  <h2>
    Clinic / OPD Report
  </h2>

  <div class="meta">
    <strong>Date Range:</strong>
    ${escapeHtml(
      filters.from ||
        'Beginning'
    )}
    to
    ${escapeHtml(
      filters.to ||
        'Today'
    )}
    <br />

    <strong>Doctor:</strong>
    ${escapeHtml(
      doctorLabel
    )}
    <br />

    <strong>Patient:</strong>
    ${escapeHtml(
      patientLabel
    )}
  </div>

  <div class="summary">

    <div class="card">
      <span>Total Visits</span>
      <strong>
        ${escapeHtml(
          summary.totalVisits
        )}
      </strong>
    </div>

    <div class="card">
      <span>Unique Patients</span>
      <strong>
        ${escapeHtml(
          summary.uniquePatients
        )}
      </strong>
    </div>

    <div class="card">
      <span>Total Revenue</span>
      <strong>
        ${escapeHtml(
          money(
            summary.totalRevenue
          )
        )}
      </strong>
    </div>

    <div class="card">
      <span>Average / Visit</span>
      <strong>
        ${escapeHtml(
          money(
            summary.averageRevenuePerVisit
          )
        )}
      </strong>
    </div>

  </div>

  <table>

    <thead>
      <tr>
        <th>#</th>
        <th>Date / Time</th>
        <th>OPD No.</th>
        <th>Patient</th>
        <th>Doctor</th>
        <th>Charge Note</th>
        <th>Charge</th>
      </tr>
    </thead>

    <tbody>
      ${
        rows ||
        `<tr>
          <td colspan="7" style="text-align:center;">
            No OPD records found for this report.
          </td>
        </tr>`
      }
    </tbody>

  </table>

  <div class="footer">
    Printed:
    ${escapeHtml(
      new Date().toLocaleString()
    )}
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


  return (
    <div className="space-y-5">

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}


      {/* Date Presets */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">

          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Clinic Report Filters
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Review patient visits and clinic charges by doctor, patient and date range.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadDoctors();
              generateReport();
            }}
            disabled={
              loading
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />

            Refresh
          </button>

        </div>


        <div className="mt-5 flex flex-wrap gap-2">

          {[
            {
              id: 'today' as const,
              label: 'Today',
            },
            {
              id: 'week' as const,
              label: 'This Week',
            },
            {
              id: 'month' as const,
              label: 'This Month',
            },
            {
              id: 'custom' as const,
              label: 'Custom',
            },
          ].map(
            (preset) => (
              <button
                key={
                  preset.id
                }
                type="button"
                onClick={() =>
                  applyPreset(
                    preset.id
                  )
                }
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activePreset ===
                  preset.id
                    ? 'bg-teal-700 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {
                  preset.label
                }
              </button>
            )
          )}

        </div>


        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">

          {/* Doctor */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Doctor
            </label>

            <select
              value={
                filters.doctorId
              }
              onChange={(
                event
              ) =>
                setFilters(
                  (
                    previous
                  ) => ({
                    ...previous,
                    doctorId:
                      event.target
                        .value,
                  })
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
            >
              <option value="">
                All Doctors
              </option>

              {doctors.map(
                (doctor) => (
                  <option
                    key={
                      doctor.id
                    }
                    value={
                      doctor.id
                    }
                  >
                    {
                      doctor.name
                    }
                    {doctor.status ===
                    'inactive'
                      ? ' (Inactive)'
                      : ''}
                  </option>
                )
              )}
            </select>
          </div>


          {/* Patient */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Patient
            </label>

            {selectedPatient ? (
              <div className="flex min-h-[42px] items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-extrabold text-slate-800">
                    {
                      selectedPatient.name
                    }
                  </div>

                  <div className="font-mono text-[10px] text-slate-500">
                    {
                      selectedPatient.clinicNumber
                    }
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    clearPatient
                  }
                  className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      value={
                        patientSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setPatientSearch(
                          event.target
                            .value
                        )
                      }
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                          'Enter'
                        ) {
                          event.preventDefault();

                          void searchPatients();
                        }
                      }}
                      placeholder="Optional patient..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void searchPatients()
                    }
                    disabled={
                      patientSearchLoading
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {patientSearchLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </button>
                </div>


                {patientResults.length >
                  0 && (
                  <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {patientResults.map(
                      (patient) => (
                        <button
                          key={
                            patient.id
                          }
                          type="button"
                          onClick={() =>
                            selectPatient(
                              patient
                            )
                          }
                          className="block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-teal-50"
                        >
                          <div className="text-xs font-extrabold text-slate-800">
                            {
                              patient.name
                            }
                          </div>

                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {
                              patient.clinicNumber
                            }
                            {patient.phone
                              ? ` • ${patient.phone}`
                              : ''}
                          </div>
                        </button>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </div>


          {/* From */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              From Date
            </label>

            <input
              type="date"
              value={
                filters.from
              }
              onChange={(
                event
              ) => {
                setActivePreset(
                  'custom'
                );

                setFilters(
                  (
                    previous
                  ) => ({
                    ...previous,
                    from:
                      event.target
                        .value,
                  })
                );
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
            />
          </div>


          {/* To */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              To Date
            </label>

            <input
              type="date"
              value={
                filters.to
              }
              onChange={(
                event
              ) => {
                setActivePreset(
                  'custom'
                );

                setFilters(
                  (
                    previous
                  ) => ({
                    ...previous,
                    to:
                      event.target
                        .value,
                  })
                );
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
            />
          </div>

        </div>


        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={
              generateReport
            }
            disabled={
              loading
            }
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardList className="h-4 w-4" />
            )}

            Generate Report
          </button>
        </div>

      </section>


      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Total Visits
            </span>

            <ClipboardList className="h-4 w-4 text-slate-400" />
          </div>

          <strong className="mt-2 block text-2xl font-extrabold text-slate-900">
            {
              summary.totalVisits
            }
          </strong>
        </div>


        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-700">
              Unique Patients
            </span>

            <Users className="h-4 w-4 text-sky-600" />
          </div>

          <strong className="mt-2 block text-2xl font-extrabold text-sky-800">
            {
              summary.uniquePatients
            }
          </strong>
        </div>


        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">
              Total Revenue
            </span>

            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>

          <strong className="mt-2 block font-mono text-2xl font-extrabold text-emerald-800">
            {money(
              summary.totalRevenue
            )}
          </strong>
        </div>


        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-violet-700">
              Average / Visit
            </span>

            <Stethoscope className="h-4 w-4 text-violet-600" />
          </div>

          <strong className="mt-2 block font-mono text-2xl font-extrabold text-violet-800">
            {money(
              summary.averageRevenuePerVisit
            )}
          </strong>
        </div>

      </div>


      {/* Report Table */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Clinic Visit Report
            </h2>

            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />

              {
                filters.from
              }
              {' to '}
              {
                filters.to
              }
            </p>
          </div>


          <button
            type="button"
            onClick={
              printReport
            }
            disabled={
              loading
            }
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
        </div>


        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating clinic report...
          </div>
        ) : visits.length ===
          0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <ClipboardList className="h-10 w-10 text-slate-300" />

            <p className="mt-3 text-sm font-bold text-slate-600">
              No OPD visits found
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Change the report filters and generate again.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">

              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">
                    Date / Time
                  </th>

                  <th className="px-4 py-3">
                    OPD No.
                  </th>

                  <th className="px-4 py-3">
                    Patient
                  </th>

                  <th className="px-4 py-3">
                    Doctor
                  </th>

                  <th className="px-4 py-3">
                    Note
                  </th>

                  <th className="px-5 py-3 text-right">
                    Charge
                  </th>
                </tr>
              </thead>


              <tbody className="divide-y divide-slate-100">
                {visits.map(
                  (visit) => (
                    <tr
                      key={
                        visit.id
                      }
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4 text-xs text-slate-600">
                        {readableDateTime(
                          visit.visitDateTime
                        )}
                      </td>

                      <td className="px-4 py-4 font-mono text-xs font-bold text-teal-700">
                        {
                          visit.opdNumber
                        }
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-xs font-extrabold text-slate-800">
                          {
                            visit.patient.name
                          }
                        </div>

                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {
                            visit.patient.clinicNumber
                          }
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-xs font-bold text-slate-700">
                          {
                            visit.doctor.name
                          }
                        </div>

                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {
                            visit.doctor.speciality ||
                            ''
                          }
                        </div>
                      </td>

                      <td className="max-w-[260px] px-4 py-4 text-xs text-slate-500">
                        <div className="truncate">
                          {
                            visit.chargeNote ||
                            '—'
                          }
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right font-mono text-xs font-extrabold text-slate-800">
                        {money(
                          visit.totalCharge
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>

            </table>
          </div>
        )}

      </section>

    </div>
  );
};
