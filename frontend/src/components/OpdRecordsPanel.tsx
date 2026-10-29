import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  History,
  Loader2,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';

import { usePharmacy } from '../context/PharmacyContext';
import { apiRequest } from '../services/api';
import { printOpdSticker } from '../utils/opdSticker';


interface ClinicPatient {
  id: string;
  clinicNumber: string;
  name: string;
  phone: string | null;
  gender: string | null;
  ageYears: number | null;
  address: string | null;
}


interface Doctor {
  id: string;
  doctorCode: string;
  name: string;
  speciality: string | null;
  qualification: string | null;
  nmcNumber: string | null;
  defaultConsultationFee?: number;
  status?: 'active' | 'inactive';
}


interface CreatedBy {
  id: string;
  username: string;
  name: string;
}


interface ClinicVisit {
  id: string;
  opdNumber: string;

  patient: ClinicPatient;
  doctor: Doctor;

  visitDateTime: string;
  ageAtVisit: number | null;

  consultationFee: number;
  additionalCharge: number;
  additionalChargeNote: string | null;

  totalCharge: number;

  // Temporary compatibility alias from backend.
  chargeNote: string | null;

  status: 'open' | 'completed';
  completedAt: string | null;

  createdBy: CreatedBy | null;

  createdAt?: string;
  updatedAt?: string;
}


interface PatientHistoryVisit {
  id: string;
  opdNumber: string;

  doctor: {
    id: string;
    doctorCode: string;
    name: string;
    speciality: string | null;
    qualification: string | null;
    nmcNumber: string | null;
  };

  visitDateTime: string;
  ageAtVisit: number | null;

  consultationFee: number;
  additionalCharge: number;
  additionalChargeNote: string | null;
  totalCharge: number;

  chargeNote: string | null;

  status: 'open' | 'completed';
  completedAt: string | null;

  createdBy: CreatedBy | null;
}


interface PatientDetail extends ClinicPatient {
  visitCount: number;
  visits: PatientHistoryVisit[];
}


interface VisitListResponse {
  success: boolean;
  count: number;
  data: ClinicVisit[];
}


interface VisitResponse {
  success: boolean;
  message: string;
  data: ClinicVisit;
}


interface DoctorListResponse {
  success: boolean;
  count: number;
  data: Doctor[];
}


interface PatientDetailResponse {
  success: boolean;
  data: PatientDetail;
}


interface VisitFilters {
  search: string;
  doctorId: string;
  status: string;
  from: string;
  to: string;
}


const EMPTY_FILTERS: VisitFilters = {
  search: '',
  doctorId: '',
  status: '',
  from: '',
  to: '',
};


const money = (
  value: number
): string =>
  `Rs. ${Number(value || 0).toFixed(2)}`;


const readableDateTime = (
  value: string | null
): string => {
  if (!value) {
    return '—';
  }

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


export const OpdRecordsPanel: React.FC = () => {
  const { settings, isAdmin } = usePharmacy();


  const [
    visits,
    setVisits,
  ] =
    useState<ClinicVisit[]>([]);
  const [cancelingVisitId, setCancelingVisitId] = useState<string | null>(null);


  const [
    doctors,
    setDoctors,
  ] =
    useState<Doctor[]>([]);


  const [
    filters,
    setFilters,
  ] =
    useState<VisitFilters>(
      EMPTY_FILTERS
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
    success,
    setSuccess,
  ] =
    useState('');


  const [
    selectedVisit,
    setSelectedVisit,
  ] =
    useState<ClinicVisit | null>(
      null
    );


  const [
    patientHistory,
    setPatientHistory,
  ] =
    useState<PatientDetail | null>(
      null
    );


  const [
    patientHistoryLoading,
    setPatientHistoryLoading,
  ] =
    useState(false);


  const [
    completionSaving,
    setCompletionSaving,
  ] =
    useState(false);


  const [
    completionConsultationFee,
    setCompletionConsultationFee,
  ] =
    useState('');


  const [
    completionAdditionalCharge,
    setCompletionAdditionalCharge,
  ] =
    useState('0');


  const [
    completionNote,
    setCompletionNote,
  ] =
    useState('');


  const fetchVisits =
    useCallback(
      async (
        values: VisitFilters
      ) => {
        try {
          setLoading(true);
          setError('');

          const params =
            new URLSearchParams();


          if (
            values.search.trim()
          ) {
            params.set(
              'search',
              values.search.trim()
            );
          }


          if (
            values.doctorId
          ) {
            params.set(
              'doctorId',
              values.doctorId
            );
          }


          if (
            values.status
          ) {
            params.set(
              'status',
              values.status
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
            await apiRequest<VisitListResponse>(
              `/clinic-visits${
                query
                  ? `?${query}`
                  : ''
              }`
            );


          setVisits(
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
              : 'Unable to load OPD records.'
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  const handleCancelVisit = async (visit: ClinicVisit) => {
    const confirmCancel = window.confirm(
      `Are you sure you want to cancel OPD ticket ${visit.opdNumber} for patient "${visit.patient.name}"?\n\nThis will permanently delete this OPD registration.`
    );
    if (!confirmCancel) return;

    try {
      setCancelingVisitId(visit.id);
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/clinic-visits/${encodeURIComponent(visit.id)}`,
        { method: 'DELETE' }
      );
      alert(res?.message || 'OPD ticket cancelled successfully.');
      if (selectedVisit?.id === visit.id) {
        setSelectedVisit(null);
      }
      await loadVisits(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel OPD visit.');
    } finally {
      setCancelingVisitId(null);
    }
  };


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
            'Unable to load doctor filter:',
            err
          );
        }
      },
      []
    );


  useEffect(() => {
    void fetchVisits(
      EMPTY_FILTERS
    );

    void loadDoctors();
  }, [
    fetchVisits,
    loadDoctors,
  ]);


  const openCount =
    useMemo(
      () =>
        visits.filter(
          (visit) =>
            visit.status ===
            'open'
        ).length,
      [visits]
    );


  const completedCount =
    useMemo(
      () =>
        visits.filter(
          (visit) =>
            visit.status ===
            'completed'
        ).length,
      [visits]
    );


  const finalizedRevenue =
    useMemo(
      () =>
        visits
          .filter(
            (visit) =>
              visit.status ===
              'completed'
          )
          .reduce(
            (
              sum,
              visit
            ) =>
              sum +
              Number(
                visit.totalCharge ||
                  0
              ),
            0
          ),
      [visits]
    );


  const completionFinalTotal =
    useMemo(
      () => {
        const consultation =
          Number(
            completionConsultationFee ||
              0
          );

        const additional =
          Number(
            completionAdditionalCharge ||
              0
          );

        if (
          !Number.isFinite(
            consultation
          ) ||
          !Number.isFinite(
            additional
          )
        ) {
          return 0;
        }

        return (
          consultation +
          additional
        );
      },
      [
        completionConsultationFee,
        completionAdditionalCharge,
      ]
    );


  const runFilters =
    () => {
      setSelectedVisit(
        null
      );

      setPatientHistory(
        null
      );

      setSuccess('');

      void fetchVisits(
        filters
      );
    };


  const clearFilters =
    () => {
      setFilters(
        EMPTY_FILTERS
      );

      setSelectedVisit(
        null
      );

      setPatientHistory(
        null
      );

      setSuccess('');

      void fetchVisits(
        EMPTY_FILTERS
      );
    };


  const refreshRecords =
    () => {
      setSelectedVisit(
        null
      );

      setPatientHistory(
        null
      );

      setSuccess('');

      void fetchVisits(
        filters
      );

      void loadDoctors();
    };


  const openVisit = (
    visit: ClinicVisit
  ) => {
    setSelectedVisit(
      visit
    );

    setPatientHistory(
      null
    );

    setError('');
    setSuccess('');

    setCompletionConsultationFee(
      String(
        Number(
          visit.consultationFee ||
            0
        )
      )
    );

    setCompletionAdditionalCharge(
      String(
        Number(
          visit.additionalCharge ||
            0
        )
      )
    );

    setCompletionNote(
      visit.additionalChargeNote ||
        ''
    );
  };


  const loadPatientHistory =
    async (
      patient:
        ClinicPatient
    ) => {
      try {
        setPatientHistoryLoading(
          true
        );

        setError('');


        const response =
          await apiRequest<PatientDetailResponse>(
            `/clinic-patients/${encodeURIComponent(
              patient.id
            )}`
          );


        setPatientHistory(
          response.data
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load patient history.'
        );
      } finally {
        setPatientHistoryLoading(
          false
        );
      }
    };


  const completeSelectedVisit =
    async () => {
      if (
        !selectedVisit ||
        selectedVisit.status !==
          'open'
      ) {
        return;
      }


      const consultationFee =
        Number(
          completionConsultationFee
        );

      const additionalCharge =
        Number(
          completionAdditionalCharge ||
            0
        );


      if (
        !Number.isFinite(
          consultationFee
        ) ||
        consultationFee < 0
      ) {
        setError(
          'Consultation fee must be zero or a positive number.'
        );

        return;
      }


      if (
        !Number.isFinite(
          additionalCharge
        ) ||
        additionalCharge < 0
      ) {
        setError(
          'Additional charge must be zero or a positive number.'
        );

        return;
      }


      try {
        setCompletionSaving(
          true
        );

        setError('');
        setSuccess('');


        const response =
          await apiRequest<VisitResponse>(
            `/clinic-visits/${encodeURIComponent(
              selectedVisit.id
            )}/complete`,
            {
              method:
                'PUT',

              body:
                JSON.stringify({
                  consultationFee,

                  additionalCharge,

                  additionalChargeNote:
                    completionNote.trim(),
                }),
            }
          );


        setSelectedVisit(
          response.data
        );


        setVisits(
          (
            previous
          ) =>
            previous.map(
              (visit) =>
                visit.id ===
                response.data.id
                  ? response.data
                  : visit
            )
        );


        setSuccess(
          `${response.data.opdNumber} completed. Final clinic charge: ${money(
            response.data.totalCharge
          )}.`
        );


        if (
          patientHistory
        ) {
          void loadPatientHistory(
            response.data.patient
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to complete OPD visit.'
        );
      } finally {
        setCompletionSaving(
          false
        );
      }
    };


  return (
    <div className="space-y-5">

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}


      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {success}
        </div>
      )}


      {/* Operational Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-500">
            Visits in Current View
          </span>

          <strong className="mt-2 block text-2xl font-extrabold text-slate-900">
            {visits.length}
          </strong>
        </div>


        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
          <span className="text-xs font-bold text-amber-700">
            Open / Awaiting Completion
          </span>

          <strong className="mt-2 block text-2xl font-extrabold text-amber-800">
            {openCount}
          </strong>
        </div>


        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
          <span className="text-xs font-bold text-sky-700">
            Completed Visits
          </span>

          <strong className="mt-2 block text-2xl font-extrabold text-sky-800">
            {completedCount}
          </strong>
        </div>


        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <span className="text-xs font-bold text-emerald-700">
            Finalized Revenue
          </span>

          <strong className="mt-2 block font-mono text-2xl font-extrabold text-emerald-800">
            {money(
              finalizedRevenue
            )}
          </strong>
        </div>

      </div>


      {/* Filters */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">

          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              OPD Search & Filters
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Search by OPD No., Clinic No., patient name, phone, doctor name or doctor code.
            </p>
          </div>


          <button
            type="button"
            onClick={
              refreshRecords
            }
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


        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={
                filters.search
              }
              onChange={(
                event
              ) =>
                setFilters(
                  (
                    previous
                  ) => ({
                    ...previous,
                    search:
                      event.target
                        .value,
                  })
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
                  runFilters();
                }
              }}
              placeholder="OPD / Clinic No. / patient..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:bg-white"
            />
          </div>


          <select
            value={
              filters.status
            }
            onChange={(
              event
            ) =>
              setFilters(
                (
                  previous
                ) => ({
                  ...previous,
                  status:
                    event.target
                      .value,
                })
              )
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
          >
            <option value="">
              All Statuses
            </option>

            <option value="open">
              Open / Awaiting Completion
            </option>

            <option value="completed">
              Completed
            </option>
          </select>


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


          <input
            type="date"
            value={
              filters.from
            }
            onChange={(
              event
            ) =>
              setFilters(
                (
                  previous
                ) => ({
                  ...previous,
                  from:
                    event.target
                      .value,
                })
              )
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
          />


          <input
            type="date"
            value={
              filters.to
            }
            onChange={(
              event
            ) =>
              setFilters(
                (
                  previous
                ) => ({
                  ...previous,
                  to:
                    event.target
                      .value,
                })
              )
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
          />

        </div>


        <div className="mt-4 flex justify-end gap-2">

          <button
            type="button"
            onClick={
              clearFilters
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>


          <button
            type="button"
            onClick={
              runFilters
            }
            disabled={
              loading
            }
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}

            Apply Filters
          </button>

        </div>

      </section>


      {/* Selected Visit */}
      {selectedVisit && (
        <section className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>
              <div className="flex flex-wrap items-center gap-2">

                <span className="text-[10px] font-extrabold uppercase tracking-wide text-teal-700">
                  OPD Visit
                </span>

                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                    selectedVisit.status ===
                    'open'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedVisit.status ===
                  'open'
                    ? 'Open'
                    : 'Completed'}
                </span>

              </div>


              <h2 className="mt-1 font-mono text-xl font-black text-slate-900">
                {
                  selectedVisit.opdNumber
                }
              </h2>
            </div>


            <button
              type="button"
              onClick={() => {
                setSelectedVisit(
                  null
                );

                setPatientHistory(
                  null
                );
              }}
              className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

          </div>


          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

            <div className="rounded-2xl bg-slate-50 p-4">

              <div className="flex items-center gap-2 text-slate-500">
                <UserRound className="h-4 w-4" />

                <span className="text-[10px] font-bold uppercase">
                  Patient
                </span>
              </div>

              <strong className="mt-2 block text-sm text-slate-900">
                {
                  selectedVisit.patient.name
                }
              </strong>

              <span className="mt-1 block font-mono text-[11px] font-bold text-slate-500">
                {
                  selectedVisit.patient.clinicNumber
                }
              </span>

              {selectedVisit.patient.phone && (
                <span className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="h-3 w-3" />
                  {
                    selectedVisit.patient.phone
                  }
                </span>
              )}

            </div>


            <div className="rounded-2xl bg-slate-50 p-4">

              <div className="flex items-center gap-2 text-slate-500">
                <Stethoscope className="h-4 w-4" />

                <span className="text-[10px] font-bold uppercase">
                  Doctor
                </span>
              </div>

              <strong className="mt-2 block text-sm text-slate-900">
                {
                  selectedVisit.doctor.name
                }
              </strong>

              <span className="mt-1 block text-xs text-slate-500">
                {
                  selectedVisit.doctor.speciality ||
                  '—'
                }
              </span>

            </div>


            <div className="rounded-2xl bg-slate-50 p-4">

              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="h-4 w-4" />

                <span className="text-[10px] font-bold uppercase">
                  Registration
                </span>
              </div>

              <strong className="mt-2 block text-sm text-slate-900">
                {readableDateTime(
                  selectedVisit.visitDateTime
                )}
              </strong>

              <span className="mt-1 block text-xs text-slate-500">
                Age:{' '}
                {selectedVisit.ageAtVisit ??
                  '—'}
                {selectedVisit.patient.gender
                  ? ` / ${selectedVisit.patient.gender}`
                  : ''}
              </span>

            </div>


            <div className="rounded-2xl bg-teal-50 p-4">

              <span className="text-[10px] font-bold uppercase text-teal-700">
                Consultation Fee
              </span>

              <strong className="mt-2 block font-mono text-xl text-teal-800">
                {money(
                  selectedVisit.consultationFee
                )}
              </strong>

              <span className="mt-1 block text-xs text-slate-500">
                Recorded when patient arrived
              </span>

            </div>

          </div>


          {/* OPEN VISIT COMPLETION */}
          {selectedVisit.status ===
          'open' ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">

              <div className="flex items-start gap-3">

                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                  <CircleDollarSign className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Add Charges / Complete Visit
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Complete this OPD after the doctor has finished the consultation. Add only any extra clinic or procedure charge here.
                  </p>
                </div>

              </div>


              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Consultation Fee (Rs.)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      completionConsultationFee
                    }
                    onChange={(
                      event
                    ) =>
                      setCompletionConsultationFee(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm font-bold outline-none focus:border-teal-500"
                  />

                  <p className="mt-1 text-[10px] text-slate-500">
                    Normally unchanged from registration.
                  </p>
                </div>


                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Additional Charge (Rs.)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      completionAdditionalCharge
                    }
                    onChange={(
                      event
                    ) =>
                      setCompletionAdditionalCharge(
                        event.target.value
                      )
                    }
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm font-bold outline-none focus:border-teal-500"
                  />

                  <p className="mt-1 text-[10px] text-slate-500">
                    Example: dressing, minor procedure, service charge.
                  </p>
                </div>


                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Additional Charge Note
                  </label>

                  <input
                    value={
                      completionNote
                    }
                    onChange={(
                      event
                    ) =>
                      setCompletionNote(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Dressing / minor procedure"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                  />

                  <p className="mt-1 text-[10px] text-slate-500">
                    Optional short explanation.
                  </p>
                </div>

              </div>


              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-amber-200 pt-4">

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">
                    Final Total
                  </span>

                  <strong className="mt-1 block font-mono text-2xl font-black text-slate-900">
                    {money(
                      completionFinalTotal
                    )}
                  </strong>

                  <p className="mt-1 text-[10px] text-slate-500">
                    Consultation + additional charge
                  </p>
                </div>


                <button
                  type="button"
                  onClick={() =>
                    void completeSelectedVisit()
                  }
                  disabled={
                    completionSaving
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                >
                  {completionSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}

                  {completionSaving
                    ? 'Completing...'
                    : 'Complete Visit'}
                </button>

              </div>

            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">

              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />

                <h3 className="text-sm font-extrabold text-emerald-900">
                  Visit Completed
                </h3>
              </div>


              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">
                    Consultation
                  </span>

                  <strong className="mt-1 block font-mono text-sm text-slate-900">
                    {money(
                      selectedVisit.consultationFee
                    )}
                  </strong>
                </div>


                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">
                    Additional
                  </span>

                  <strong className="mt-1 block font-mono text-sm text-slate-900">
                    {money(
                      selectedVisit.additionalCharge
                    )}
                  </strong>

                  {selectedVisit.additionalChargeNote && (
                    <span className="mt-1 block text-[10px] text-slate-500">
                      {
                        selectedVisit.additionalChargeNote
                      }
                    </span>
                  )}
                </div>


                <div>
                  <span className="block text-[10px] font-bold uppercase text-emerald-700">
                    Final Total
                  </span>

                  <strong className="mt-1 block font-mono text-lg text-emerald-900">
                    {money(
                      selectedVisit.totalCharge
                    )}
                  </strong>

                  <span className="mt-1 block text-[10px] text-slate-500">
                    Completed{' '}
                    {readableDateTime(
                      selectedVisit.completedAt
                    )}
                  </span>
                </div>

              </div>

            </div>
          )}


          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">

            <div className="text-[11px] text-slate-400">
              Entered by:{' '}

              <strong className="text-slate-600">
                {selectedVisit.createdBy?.name ||
                  'Unknown'}
              </strong>
            </div>


            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={() =>
                  printOpdSticker(
                    selectedVisit,
                    settings.storeName
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Printer className="h-4 w-4" />

                Reprint Arrival Sticker
              </button>


              <button
                type="button"
                onClick={() =>
                  void loadPatientHistory(
                    selectedVisit.patient
                  )
                }
                disabled={
                  patientHistoryLoading
                }
                className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
              >
                {patientHistoryLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <History className="h-4 w-4" />
                )}

                Patient History
              </button>

            </div>

          </div>

        </section>
      )}


      {/* Patient History */}
      {patientHistory && (
        <section className="overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-sm">

          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">

            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-sky-700">
                Patient History
              </span>

              <h2 className="mt-1 text-base font-extrabold text-slate-900">
                {
                  patientHistory.name
                }
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {
                  patientHistory.clinicNumber
                }
                {' • '}
                {
                  patientHistory.visitCount
                }{' '}
                visit
                {patientHistory.visitCount ===
                1
                  ? ''
                  : 's'}
              </p>
            </div>


            <button
              type="button"
              onClick={() =>
                setPatientHistory(
                  null
                )
              }
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

          </div>


          <div className="overflow-x-auto">

            <table className="w-full min-w-[950px] text-left">

              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">

                <tr>
                  <th className="px-5 py-3">
                    OPD No.
                  </th>

                  <th className="px-4 py-3">
                    Date
                  </th>

                  <th className="px-4 py-3">
                    Doctor
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                  <th className="px-4 py-3 text-right">
                    Consultation
                  </th>

                  <th className="px-4 py-3 text-right">
                    Additional
                  </th>

                  <th className="px-5 py-3 text-right">
                    Final
                  </th>
                </tr>

              </thead>


              <tbody className="divide-y divide-slate-100">

                {patientHistory.visits.map(
                  (visit) => (
                    <tr
                      key={
                        visit.id
                      }
                    >

                      <td className="px-5 py-3 font-mono text-xs font-bold text-teal-700">
                        {
                          visit.opdNumber
                        }
                      </td>


                      <td className="px-4 py-3 text-xs text-slate-600">
                        {readableDateTime(
                          visit.visitDateTime
                        )}
                      </td>


                      <td className="px-4 py-3 text-xs font-bold text-slate-700">
                        {
                          visit.doctor.name
                        }
                      </td>


                      <td className="px-4 py-3">

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                            visit.status ===
                            'open'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {
                            visit.status
                          }
                        </span>

                      </td>


                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                        {money(
                          visit.consultationFee
                        )}
                      </td>


                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                        {visit.status ===
                        'completed'
                          ? money(
                              visit.additionalCharge
                            )
                          : '—'}
                      </td>


                      <td className="px-5 py-3 text-right font-mono text-xs font-bold text-slate-800">
                        {visit.status ===
                        'completed'
                          ? money(
                              visit.totalCharge
                            )
                          : 'Pending'}
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>
      )}


      {/* Records Table */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <h2 className="text-base font-extrabold text-slate-900">
            OPD Records
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {
              visits.length
            }{' '}
            record
            {visits.length ===
            1
              ? ''
              : 's'}{' '}
            shown
          </p>

        </div>


        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-medium text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading OPD records...
          </div>
        ) : visits.length ===
          0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">

            <History className="h-10 w-10 text-slate-300" />

            <p className="mt-3 text-sm font-bold text-slate-600">
              No OPD records found
            </p>

          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[1250px] text-left">

              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">

                <tr>
                  <th className="px-5 py-3">
                    Date / Time
                  </th>

                  <th className="px-4 py-3">
                    OPD
                  </th>

                  <th className="px-4 py-3">
                    Patient
                  </th>

                  <th className="px-4 py-3">
                    Doctor
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                  <th className="px-4 py-3 text-right">
                    Consultation
                  </th>

                  <th className="px-4 py-3 text-right">
                    Additional
                  </th>

                  <th className="px-4 py-3 text-right">
                    Final
                  </th>

                  <th className="px-5 py-3 text-right">
                    Action
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
                      className="transition hover:bg-slate-50/70"
                    >

                      <td className="px-5 py-4 text-xs text-slate-600">
                        {readableDateTime(
                          visit.visitDateTime
                        )}
                      </td>


                      <td className="px-4 py-4">

                        <div className="font-mono text-xs font-extrabold text-teal-700">
                          {
                            visit.opdNumber
                          }
                        </div>

                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {
                            visit.patient.clinicNumber
                          }
                        </div>

                      </td>


                      <td className="px-4 py-4">

                        <div className="text-xs font-extrabold text-slate-800">
                          {
                            visit.patient.name
                          }
                        </div>

                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {
                            visit.patient.phone ||
                            ''
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


                      <td className="px-4 py-4">

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                            visit.status ===
                            'open'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {visit.status ===
                          'open'
                            ? 'Open'
                            : 'Completed'}
                        </span>

                      </td>


                      <td className="px-4 py-4 text-right font-mono text-xs font-bold text-slate-700">
                        {money(
                          visit.consultationFee
                        )}
                      </td>


                      <td className="px-4 py-4 text-right font-mono text-xs font-bold text-slate-700">
                        {visit.status ===
                        'completed'
                          ? money(
                              visit.additionalCharge
                            )
                          : '—'}
                      </td>


                      <td className="px-4 py-4 text-right font-mono text-xs font-extrabold text-slate-900">
                        {visit.status ===
                        'completed'
                          ? money(
                              visit.totalCharge
                            )
                          : 'Pending'}
                      </td>


                      <td className="px-5 py-4 text-right">

                        <div className="flex justify-end gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              printOpdSticker(
                                visit,
                                settings.storeName
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Sticker
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              openVisit(
                                visit
                              )
                            }
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                              visit.status ===
                              'open'
                                ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {visit.status ===
                            'open' ? (
                              <CircleDollarSign className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}

                            {visit.status ===
                            'open'
                              ? 'Add Charges / Complete'
                              : 'View'}
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              disabled={cancelingVisitId === visit.id}
                              onClick={() => handleCancelVisit(visit)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
                              title="Cancel / Void this OPD Ticket"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                              {cancelingVisitId === visit.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                        </div>

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
