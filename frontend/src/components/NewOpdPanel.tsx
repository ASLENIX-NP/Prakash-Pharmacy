import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardPlus,
  Loader2,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Stethoscope,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';

import { apiRequest } from '../services/api';
import { usePharmacy } from '../context/PharmacyContext';
import { printOpdSticker } from '../utils/opdSticker';


interface ClinicPatient {
  id: string;
  clinicNumber: string;
  name: string;
  phone: string;
  gender: string;
  ageYears: number | null;
  address: string;
  createdAt?: string;
  updatedAt?: string;
}


interface Doctor {
  id: string;
  doctorCode: string;
  name: string;
  speciality: string;
  qualification: string;
  nmcNumber: string;
  defaultConsultationFee: number;
  status: 'active' | 'inactive';
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
  chargeNote: string | null;
  status: 'open' | 'completed';
  completedAt: string | null;

  createdBy:
    | {
        id: string;
        username: string;
        name: string;
      }
    | null;
}


interface PatientListResponse {
  success: boolean;
  count: number;
  data: ClinicPatient[];
}


interface PatientResponse {
  success: boolean;
  message?: string;
  data: ClinicPatient;
}


interface DoctorListResponse {
  success: boolean;
  count: number;
  data: Doctor[];
}


interface VisitResponse {
  success: boolean;
  message?: string;
  data: ClinicVisit;
}


interface NewPatientForm {
  name: string;
  phone: string;
  ageYears: string;
  gender: string;
  address: string;
}


const sanitizePatientName = (value: string): string =>
  value
    .replace(/[^A-Za-z\s.'-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^(\s)+/, '');


const normalizePatientPhone = (value: string): string =>
  value.replace(/\D/g, '').slice(0, 10);


const EMPTY_PATIENT_FORM: NewPatientForm = {
  name: '',
  phone: '',
  ageYears: '',
  gender: '',
  address: '',
};


export const NewOpdPanel: React.FC = () => {
  const { settings } = usePharmacy();

  const [doctors, setDoctors] =
    useState<Doctor[]>([]);

  const [doctorsLoading, setDoctorsLoading] =
    useState(true);

  const [patientSearch, setPatientSearch] =
    useState('');

  const [patientResults, setPatientResults] =
    useState<ClinicPatient[]>([]);

  const [patientSearching, setPatientSearching] =
    useState(false);

  const [hasSearchedPatients, setHasSearchedPatients] =
    useState(false);

  const [selectedPatient, setSelectedPatient] =
    useState<ClinicPatient | null>(null);

  const [showNewPatientForm, setShowNewPatientForm] =
    useState(false);

  const [newPatient, setNewPatient] =
    useState<NewPatientForm>(
      EMPTY_PATIENT_FORM
    );

  const [patientSaving, setPatientSaving] =
    useState(false);

  const [selectedDoctorId, setSelectedDoctorId] =
    useState('');

  const [totalCharge, setTotalCharge] =
    useState('');

  const [chargeNote, setChargeNote] =
    useState('');

  const [visitSaving, setVisitSaving] =
    useState(false);

  const [savedVisit, setSavedVisit] =
    useState<ClinicVisit | null>(null);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');


  const loadDoctors =
    useCallback(async () => {
      try {
        setDoctorsLoading(true);
        setError('');

        const response =
          await apiRequest<DoctorListResponse>(
            '/doctors?status=active'
          );

        const activeDoctors =
          Array.isArray(response.data)
            ? response.data.filter(
                (doctor) =>
                  doctor.status === 'active'
              )
            : [];

        setDoctors(activeDoctors);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load active doctors.'
        );
      } finally {
        setDoctorsLoading(false);
      }
    }, []);


  useEffect(() => {
    void loadDoctors();
  }, [loadDoctors]);


  const selectedDoctor =
    useMemo(
      () =>
        doctors.find(
          (doctor) =>
            doctor.id ===
            selectedDoctorId
        ) || null,
      [
        doctors,
        selectedDoctorId,
      ]
    );


  const searchPatients =
    async () => {
      const query =
        patientSearch.trim();

      if (!query) {
        setError(
          'Enter patient name, phone number, or Clinic No. to search.'
        );
        return;
      }

      try {
        setPatientSearching(true);
        setError('');
        setSuccess('');
        setHasSearchedPatients(true);

        const response =
          await apiRequest<PatientListResponse>(
            `/clinic-patients?search=${encodeURIComponent(
              query
            )}`
          );

        setPatientResults(
          Array.isArray(response.data)
            ? response.data
            : []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to search patients.'
        );
      } finally {
        setPatientSearching(false);
      }
    };


  const selectPatient = (
    patient: ClinicPatient
  ) => {
    setSelectedPatient(patient);

    setPatientResults([]);
    setHasSearchedPatients(false);
    setShowNewPatientForm(false);

    setPatientSearch(
      `${patient.name} - ${patient.clinicNumber}`
    );

    setError('');
    setSuccess('');
  };


  const clearSelectedPatient = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setPatientResults([]);
    setHasSearchedPatients(false);

    setSavedVisit(null);
    setSuccess('');
    setError('');
  };


  const openNewPatientForm = () => {
    const searchValue =
      patientSearch.trim();

    setNewPatient({
      ...EMPTY_PATIENT_FORM,

      name:
        searchValue &&
        !/^CL-/i.test(
          searchValue
        ) &&
        !/^\d+$/.test(
          searchValue
        )
          ? searchValue
          : '',
    });

    setShowNewPatientForm(true);
    setSelectedPatient(null);
    setSavedVisit(null);

    setError('');
    setSuccess('');
  };


  const createPatient = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const patientName =
      newPatient.name.trim();

    if (!patientName) {
      setError(
        'Patient name is required.'
      );
      return;
    }

    if (
      !/^[A-Za-z][A-Za-z\s.'-]*$/.test(
        patientName
      )
    ) {
      setError(
        'Patient name can contain only letters, spaces, apostrophes, dots, and hyphens.'
      );
      return;
    }

    const cleanPhone =
      normalizePatientPhone(
        newPatient.phone
      );

    if (
      cleanPhone.length > 0 &&
      cleanPhone.length !== 10
    ) {
      setError(
        'Phone number must contain exactly 10 digits when entered.'
      );
      return;
    }


    let parsedAge:
      | number
      | null =
      null;

    if (
      newPatient.ageYears.trim() !==
      ''
    ) {
      parsedAge =
        Number(
          newPatient.ageYears
        );

      if (
        !Number.isInteger(
          parsedAge
        ) ||
        parsedAge < 0 ||
        parsedAge > 130
      ) {
        setError(
          'Age must be a whole number between 0 and 130.'
        );
        return;
      }
    }


    try {
      setPatientSaving(true);
      setError('');
      setSuccess('');

      const response =
        await apiRequest<PatientResponse>(
          '/clinic-patients',
          {
            method: 'POST',

            body: JSON.stringify({
              name:
                patientName,

              phone:
                cleanPhone,

              ageYears:
                parsedAge,

              gender:
                newPatient.gender,

              address:
                newPatient.address.trim(),
            }),
          }
        );


      setSelectedPatient(
        response.data
      );

      setPatientSearch(
        `${response.data.name} - ${response.data.clinicNumber}`
      );

      setNewPatient(
        EMPTY_PATIENT_FORM
      );

      setShowNewPatientForm(
        false
      );

      setPatientResults([]);
      setHasSearchedPatients(
        false
      );

      setSuccess(
        response.message ||
          'Patient registered successfully.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to register patient.'
      );
    } finally {
      setPatientSaving(false);
    }
  };


  const handleDoctorChange = (
    doctorId: string
  ) => {
    setSelectedDoctorId(
      doctorId
    );

    const doctor =
      doctors.find(
        (item) =>
          item.id === doctorId
      );

    if (doctor) {
      setTotalCharge(
        String(
          doctor.defaultConsultationFee ??
            0
        )
      );
    } else {
      setTotalCharge('');
    }
  };


  const saveVisit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!selectedPatient) {
      setError(
        'Select or register a patient before saving the OPD visit.'
      );
      return;
    }


    if (!selectedDoctorId) {
      setError(
        'Select a doctor.'
      );
      return;
    }


    const charge =
      totalCharge.trim() === ''
        ? 0
        : Number(
            totalCharge
          );


    if (
      !Number.isFinite(
        charge
      ) ||
      charge < 0
    ) {
      setError(
        'Total charge must be zero or a positive number.'
      );
      return;
    }


    try {
      setVisitSaving(true);
      setError('');
      setSuccess('');

      const response =
        await apiRequest<VisitResponse>(
          '/clinic-visits',
          {
            method: 'POST',

            body:
              JSON.stringify({
                patientId:
                  selectedPatient.id,

                doctorId:
                  selectedDoctorId,

                ageAtVisit:
                  selectedPatient.ageYears,

                totalCharge:
                  charge,
              }),
          }
        );


      setSavedVisit(
        response.data
      );

      setSuccess(
        response.message ||
          `${response.data.opdNumber} saved successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save OPD visit.'
      );
    } finally {
      setVisitSaving(false);
    }
  };


  const startAnotherVisitForSamePatient =
    () => {
      setSavedVisit(null);
      setSelectedDoctorId('');
      setTotalCharge('');
      setChargeNote('');

      setError('');
      setSuccess('');
    };


  const startNewPatientVisit =
    () => {
      setSavedVisit(null);

      setSelectedPatient(null);

      setPatientSearch('');
      setPatientResults([]);
      setHasSearchedPatients(false);

      setSelectedDoctorId('');
      setTotalCharge('');
      setChargeNote('');

      setShowNewPatientForm(false);
      setNewPatient(
        EMPTY_PATIENT_FORM
      );

      setError('');
      setSuccess('');
    };


  return (
    <div className="space-y-5">
      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

          <span>{success}</span>
        </div>
      )}


      {/* Saved Visit Result */}
      {savedVisit && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />

                <span className="text-xs font-extrabold uppercase tracking-wide">
                  OPD Saved
                </span>
              </div>

              <h2 className="mt-2 font-mono text-2xl font-black text-slate-900 sm:text-3xl">
                {savedVisit.opdNumber}
              </h2>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {savedVisit.patient.name}
              </p>

              <p className="mt-1 text-xs text-slate-600">
                {savedVisit.doctor.name}
                {' • '}
                Rs.{' '}
                {Number(
                  savedVisit.consultationFee
                ).toFixed(2)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  printOpdSticker(
                    savedVisit,
                    settings.storeName
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Printer className="h-4 w-4" />
                Print Sticker
              </button>

              <button
                type="button"
                onClick={
                  startAnotherVisitForSamePatient
                }
                className="rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
              >
                Another Visit for Same Patient
              </button>

              <button
                type="button"
                onClick={
                  startNewPatientVisit
                }
                className="rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800"
              >
                New OPD
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-200 pt-4 sm:grid-cols-4">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">
                Clinic No.
              </span>

              <strong className="mt-1 block font-mono text-xs text-slate-800">
                {savedVisit.patient.clinicNumber}
              </strong>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">
                Age / Sex
              </span>

              <strong className="mt-1 block text-xs text-slate-800">
                {savedVisit.ageAtVisit ??
                  '—'}
                {savedVisit.patient.gender
                  ? ` / ${savedVisit.patient.gender}`
                  : ''}
              </strong>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">
                Doctor
              </span>

              <strong className="mt-1 block text-xs text-slate-800">
                {savedVisit.doctor.name}
              </strong>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">
                Date / Time
              </span>

              <strong className="mt-1 block text-xs text-slate-800">
                {new Date(
                  savedVisit.visitDateTime
                ).toLocaleString()}
              </strong>
            </div>
          </div>

          <p className="mt-4 text-[11px] font-medium text-slate-500">
            This OPD is OPEN and ready for consultation. Print the sticker now; additional charges can be added later from OPD Records.
          </p>
        </div>
      )}


      {!savedVisit && (
        <>
          {/* Patient Selection */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
                  <UserRound className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    1. Patient
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Search by patient name, phone number, or Clinic No.
                  </p>
                </div>
              </div>

              {!selectedPatient && (
                <button
                  type="button"
                  onClick={
                    openNewPatientForm
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Register New Patient
                </button>
              )}
            </div>


            {!selectedPatient && (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      value={
                        patientSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setPatientSearch(
                          event.target.value
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
                      placeholder="Name, phone, or CL-000001"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void searchPatients()
                    }
                    disabled={
                      patientSearching
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60"
                  >
                    {patientSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}

                    Search
                  </button>
                </div>


                {hasSearchedPatients &&
                  !patientSearching &&
                  patientResults.length ===
                    0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
                      <p className="text-sm font-bold text-slate-600">
                        No matching patient found
                      </p>

                      <button
                        type="button"
                        onClick={
                          openNewPatientForm
                        }
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Register as a new patient
                      </button>
                    </div>
                  )}


                {patientResults.length >
                  0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
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
                          className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-teal-50/50"
                        >
                          <div>
                            <div className="text-sm font-extrabold text-slate-900">
                              {
                                patient.name
                              }
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              <span className="font-mono font-bold">
                                {
                                  patient.clinicNumber
                                }
                              </span>

                              {patient.phone && (
                                <span>
                                  {
                                    patient.phone
                                  }
                                </span>
                              )}

                              {patient.ageYears !==
                                null && (
                                <span>
                                  Age{' '}
                                  {
                                    patient.ageYears
                                  }
                                </span>
                              )}

                              {patient.gender && (
                                <span>
                                  {
                                    patient.gender
                                  }
                                </span>
                              )}
                            </div>
                          </div>

                          <ArrowRight className="h-4 w-4 shrink-0 text-teal-600" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}


            {selectedPatient && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-teal-700" />

                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-teal-700">
                        Selected Patient
                      </span>
                    </div>

                    <h3 className="mt-2 text-lg font-extrabold text-slate-900">
                      {
                        selectedPatient.name
                      }
                    </h3>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="font-mono font-bold">
                        {
                          selectedPatient.clinicNumber
                        }
                      </span>

                      {selectedPatient.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {
                            selectedPatient.phone
                          }
                        </span>
                      )}

                      {selectedPatient.ageYears !==
                        null && (
                        <span>
                          Age:{' '}
                          {
                            selectedPatient.ageYears
                          }
                        </span>
                      )}

                      {selectedPatient.gender && (
                        <span>
                          Sex:{' '}
                          {
                            selectedPatient.gender
                          }
                        </span>
                      )}
                    </div>

                    {selectedPatient.address && (
                      <p className="mt-2 text-xs text-slate-500">
                        {
                          selectedPatient.address
                        }
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={
                      clearSelectedPatient
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Change Patient
                  </button>
                </div>
              </div>
            )}


            {showNewPatientForm && (
              <form
                onSubmit={
                  createPatient
                }
                className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Register New Patient
                    </h3>

                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Clinic No. will be generated automatically.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowNewPatientForm(
                        false
                      )
                    }
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>


                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Patient Name *
                    </label>

                    <input
                      required
                      value={
                        newPatient.name
                      }
                      onChange={(
                        event
                      ) =>
                        setNewPatient(
                          (
                            previous
                          ) => ({
                            ...previous,
                            name:
                              sanitizePatientName(
                                event
                                  .target
                                  .value
                              ),
                          })
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>


                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Phone
                    </label>

                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={
                        newPatient.phone
                      }
                      onChange={(
                        event
                      ) =>
                        setNewPatient(
                          (
                            previous
                          ) => ({
                            ...previous,
                            phone:
                              normalizePatientPhone(
                                event
                                  .target
                                  .value
                              ),
                          })
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>


                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Age
                    </label>

                    <input
                      type="number"
                      min="0"
                      max="130"
                      step="1"
                      value={
                        newPatient.ageYears
                      }
                      onChange={(
                        event
                      ) =>
                        setNewPatient(
                          (
                            previous
                          ) => ({
                            ...previous,
                            ageYears:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>


                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Sex
                    </label>

                    <select
                      value={
                        newPatient.gender
                      }
                      onChange={(
                        event
                      ) =>
                        setNewPatient(
                          (
                            previous
                          ) => ({
                            ...previous,
                            gender:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                    >
                      <option value="">
                        Select
                      </option>

                      <option value="Male">
                        Male
                      </option>

                      <option value="Female">
                        Female
                      </option>

                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </div>


                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Address
                    </label>

                    <input
                      value={
                        newPatient.address
                      }
                      onChange={(
                        event
                      ) =>
                        setNewPatient(
                          (
                            previous
                          ) => ({
                            ...previous,
                            address:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>


                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={
                      patientSaving
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-60"
                  >
                    {patientSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}

                    {patientSaving
                      ? 'Registering...'
                      : 'Register & Select Patient'}
                  </button>
                </div>
              </form>
            )}
          </section>


          {/* Visit Details */}
          <form
            onSubmit={saveVisit}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Stethoscope className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    2. Doctor & Consultation Fee
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Register the OPD when the patient arrives. The consultation fee is recorded now; any additional charge is added after the doctor finishes the consultation.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadDoctors()
                }
                disabled={
                  doctorsLoading
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    doctorsLoading
                      ? 'animate-spin'
                      : ''
                  }`}
                />
                Refresh Doctors
              </button>
            </div>


            {doctors.length === 0 &&
            !doctorsLoading ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                No active doctor is available. An Admin must add or reactivate a doctor before an OPD visit can be saved.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Doctor *
                  </label>

                  <select
                    value={
                      selectedDoctorId
                    }
                    onChange={(
                      event
                    ) =>
                      handleDoctorChange(
                        event.target.value
                      )
                    }
                    disabled={
                      doctorsLoading
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                  >
                    <option value="">
                      Select doctor
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
                          {doctor.speciality
                            ? ` - ${doctor.speciality}`
                            : ''}
                        </option>
                      )
                    )}
                  </select>


                  {selectedDoctor && (
                    <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                      <span className="font-bold text-slate-700">
                        {
                          selectedDoctor.qualification ||
                          'Qualification not entered'
                        }
                      </span>

                      {selectedDoctor.nmcNumber && (
                        <>
                          {' • NMC '}
                          {
                            selectedDoctor.nmcNumber
                          }
                        </>
                      )}
                    </div>
                  )}
                </div>


                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Consultation Fee (Rs.) *
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      totalCharge
                    }
                    onChange={(
                      event
                    ) =>
                      setTotalCharge(
                        event.target.value
                      )
                    }
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                  />

                  <p className="mt-1.5 text-[10px] text-slate-400">
                    The doctor default consultation fee is filled automatically but can be adjusted for this OPD.
                  </p>
                </div>
              </div>
            )}


            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div className="text-xs text-slate-500">
                {selectedPatient ? (
                  <>
                    Ready for{' '}
                    <strong className="text-slate-800">
                      {
                        selectedPatient.name
                      }
                    </strong>
                  </>
                ) : (
                  'Select a patient above before saving.'
                )}
              </div>

              <button
                type="submit"
                disabled={
                  visitSaving ||
                  !selectedPatient ||
                  !selectedDoctorId ||
                  doctors.length === 0
                }
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {visitSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardPlus className="h-4 w-4" />
                )}

                {visitSaving
                  ? 'Registering OPD...'
                  : 'Register OPD'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
