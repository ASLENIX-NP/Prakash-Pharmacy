import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardPlus,
  Loader2,
  Phone,
  Plus,
  Printer,
  QrCode,
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
  ageMonths?: number | null;
  ageUnit?: string | null;
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
  photoData?: string | null;
}


interface ClinicVisit {
  id: string;
  opdNumber: string;

  patient: ClinicPatient;

  doctor: Doctor;

  visitDateTime: string;
  ageAtVisit: number | null;
  ageMonthsAtVisit?: number | null;
  ageUnitAtVisit?: string | null;
  consultationFee: number;
  additionalCharge: number;
  additionalChargeNote: string | null;
  totalCharge: number;
  paymentMethod?: string | null;
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


interface SharedCustomer {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  membershipNumber: string;
  memberSince: string;
}

interface NewPatientForm {
  name: string;
  phone: string;
  ageYears: string;
  ageUnit: 'years' | 'months' | 'days';
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
  ageUnit: 'years',
  gender: '',
  address: '',
};

export const displayAge = (
  years?: number | null,
  months?: number | null,
  unit?: string | null
): string => {
  if (unit === 'months' || (months !== null && months !== undefined && months > 0 && (years === 0 || years === null))) {
    return `${months} Month${months === 1 ? '' : 's'}`;
  }
  if (unit === 'days') {
    return `${months ?? years} Days`;
  }
  if (years !== null && years !== undefined) {
    if (months && months > 0) {
      return `${years} Y ${months} M`;
    }
    return `${years} Yrs`;
  }
  return '—';
};


export const NewOpdPanel: React.FC = () => {
  const { settings } = usePharmacy();

  const [doctors, setDoctors] =
    useState<Doctor[]>([]);

  const [doctorsLoading, setDoctorsLoading] =
    useState(true);

  const [patientSearchMode, setPatientSearchMode] =
    useState<'name' | 'phone'>('name');

  const [patientSearch, setPatientSearch] =
    useState('');

  // OPD_INDEPENDENT_SEARCH_127Q
  const [patientNameQuery, setPatientNameQuery] = useState('');
  const [patientPhoneQuery, setPatientPhoneQuery] = useState('');

  // Ignore responses from searches that were replaced while typing.
  const patientSearchRequestId = useRef(0);

  // OPD_MEMBER_SEARCH_127H: Membership is separate from an OPD patient record.
  const [searchedMember, setSearchedMember] =
    useState<SharedCustomer | null>(null);
  const [searchedMemberLoading, setSearchedMemberLoading] =
    useState(false);

  // Both input values are preserved. Only the active field drives lookup.
  const updatePatientSearch = (mode: 'name' | 'phone', value: string) => {
    const next = mode === 'phone' ? normalizePatientPhone(value) : value;

    if (mode === 'phone') {
      setPatientPhoneQuery(next);
    } else {
      setPatientNameQuery(next);
    }

    patientSearchRequestId.current += 1;
    setPatientSearchMode(mode);
    setPatientSearch(next);
    setPatientResults([]);
    setHasSearchedPatients(false);
    setPatientSearching(false);
    setSearchedMember(null);
    setError('');
  };

  const activatePatientSearch = (mode: 'name' | 'phone') => {
    if (patientSearchMode === mode) return;

    updatePatientSearch(
      mode,
      mode === 'phone' ? patientPhoneQuery : patientNameQuery
    );
  };

  const canSearchPatients = patientSearchMode === 'phone'
    ? /^\d{10}$/.test(patientSearch)
    : patientSearch.trim().length >= 2;

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

  // OPD_FAMILY_PATIENT_127K: the contact phone is NOT a patient identity.
  const [creatingDifferentPatient, setCreatingDifferentPatient] =
    useState(false);

  const [registerAsMemberSelf, setRegisterAsMemberSelf] =
    useState(false);

  const [newPatient, setNewPatient] =
    useState<NewPatientForm>(
      EMPTY_PATIENT_FORM
    );

  const [patientSaving, setPatientSaving] =
    useState(false);

  const [sharedCustomer, setSharedCustomer] =
    useState<SharedCustomer | null>(null);

  const [customerLookupStatus, setCustomerLookupStatus] =
    useState<'idle' | 'loading' | 'found' | 'missing' | 'error'>('idle');

  const [selectedDoctorId, setSelectedDoctorId] =
    useState('');

  const [totalCharge, setTotalCharge] =
    useState('');

  const [paymentMode, setPaymentMode] =
    useState<'cash' | 'fonepay'>('cash');

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


  // Look up explicitly registered member details by phone.
  // Never automatically overwrite patient form fields.
  useEffect(() => {
    const phone = normalizePatientPhone(newPatient.phone);

    setSharedCustomer(null);

    if (!showNewPatientForm || phone.length !== 10) {
      setCustomerLookupStatus('idle');
      return;
    }

    const controller = new AbortController();
    setCustomerLookupStatus('loading');

    const timer = window.setTimeout(async () => {
      try {
        const response = await apiRequest<{
          success: boolean;
          data: SharedCustomer | null;
        }>(
          `/customers/lookup?phone=${encodeURIComponent(phone)}`,
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;

        if (response.data && response.data.phone === phone && response.data.membershipNumber) {
          setSharedCustomer(response.data);
          setCustomerLookupStatus('found');
        } else {
          setSharedCustomer(null);
          setCustomerLookupStatus('missing');
        }
      } catch {
        if (controller.signal.aborted) return;

        setSharedCustomer(null);
        setCustomerLookupStatus('error');
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [showNewPatientForm, newPatient.phone]);

  // OPD_MEMBER_SEARCH_127H: A newly enrolled member may have no Clinic No. yet.
  // This lookup never creates a patient or modifies any records.
  useEffect(() => {
    const query = patientSearch.trim();
    const phone = normalizePatientPhone(query);
    setSearchedMember(null);

    if (selectedPatient || showNewPatientForm || patientSearchMode !== 'phone' || query !== phone || phone.length !== 10) {
      setSearchedMemberLoading(false);
      return;
    }

    const controller = new AbortController();
    setSearchedMemberLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiRequest<{
          success: boolean;
          data: SharedCustomer | null;
        }>(`/customers/lookup?phone=${encodeURIComponent(phone)}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        if (response.data?.phone === phone && response.data.membershipNumber) {
          setSearchedMember(response.data);
        } else {
          setSearchedMember(null);
        }
      } catch {
        if (!controller.signal.aborted) setSearchedMember(null);
      } finally {
        if (!controller.signal.aborted) setSearchedMemberLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [patientSearch, patientSearchMode, selectedPatient, showNewPatientForm]);
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


  const searchPatients = async () => {
    const query = patientSearch.trim();
    const valid = patientSearchMode === 'phone'
      ? /^\d{10}$/.test(query)
      : query.length >= 2;

    if (!valid) {
      setPatientResults([]);
      setHasSearchedPatients(false);
      setError(patientSearchMode === 'phone'
        ? 'Enter exactly 10 digits to search by phone number.'
        : 'Enter at least 2 characters to search by name or Clinic No.');
      return;
    }

    const requestId = ++patientSearchRequestId.current;
    try {
      setPatientSearching(true);
      setError('');
      setSuccess('');
      setHasSearchedPatients(true);

      const response = await apiRequest<PatientListResponse>(
        `/clinic-patients?search=${encodeURIComponent(query)}`
      );
      if (patientSearchRequestId.current !== requestId) return;

      setPatientResults(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      if (patientSearchRequestId.current !== requestId) return;
      setPatientResults([]);
      setError(err instanceof Error ? err.message : 'Unable to search patients.');
    } finally {
      if (patientSearchRequestId.current === requestId) {
        setPatientSearching(false);
      }
    }
  };


  /*
   * Search by name after 2 characters; by phone only after 10 digits.
   * Never search partial numbers or show stale search results.
   */
  useEffect(() => {
    if (selectedPatient) return;
    const query = patientSearch.trim();
    const valid = patientSearchMode === 'phone'
      ? /^\d{10}$/.test(query)
      : query.length >= 2;

    if (!valid) {
      setPatientResults([]);
      setHasSearchedPatients(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void searchPatients();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [patientSearch, patientSearchMode, selectedPatient]);


  const selectPatient = (
    patient: ClinicPatient
  ) => {
    patientSearchRequestId.current += 1;
    setPatientSearchMode('name');
    setSelectedPatient(patient);

    setPatientResults([]);
    setHasSearchedPatients(false);
    setShowNewPatientForm(false);
    setCreatingDifferentPatient(false);
    setRegisterAsMemberSelf(false);

    setPatientNameQuery(`${patient.name} - ${patient.clinicNumber}`);
    setPatientPhoneQuery('');
    setPatientSearch(
      `${patient.name} - ${patient.clinicNumber}`
    );

    setError('');
    setSuccess('');
  };


  const clearSelectedPatient = () => {
    patientSearchRequestId.current += 1;
    setPatientSearchMode('name');
    setSelectedPatient(null);
    setPatientNameQuery('');
    setPatientPhoneQuery('');
    setPatientSearch('');
    setPatientResults([]);
    setHasSearchedPatients(false);

    setSavedVisit(null);
    setSuccess('');
    setError('');
  };


  const openNewPatientForm = () => {
    setCreatingDifferentPatient(false);
    setRegisterAsMemberSelf(false);
    const searchValue =
      patientSearch.trim();

    setNewPatient({
      ...EMPTY_PATIENT_FORM,

      name:
        patientSearchMode === 'name' &&
        searchValue &&
        !/^CL-/i.test(searchValue) &&
        !/^\d+$/.test(searchValue)
          ? searchValue
          : '',
      phone: patientSearchMode === 'phone' && /^\d{10}$/.test(searchValue)
        ? searchValue
        : '',
    });

    setShowNewPatientForm(true);
    setSelectedPatient(null);
    setSavedVisit(null);

    setError('');
    setSuccess('');
  };


  // Register someone OTHER than the member, such as a child. Only copy the
  // shared contact phone: never auto-copy the member's personal identity.
  const openDifferentPatientForm = () => {
    if (patientSearchMode !== 'phone' || !/^\d{10}$/.test(patientSearch)) return;
    setCreatingDifferentPatient(true);
    setRegisterAsMemberSelf(false);
    setNewPatient({ ...EMPTY_PATIENT_FORM, phone: patientSearch });
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

    if (creatingDifferentPatient) {

      if (!newPatient.ageYears.trim() || !newPatient.gender) {
        setError('Enter the different patient\'s age and sex to help avoid mixed medical records.');
        return;
      }
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


    let parsedAgeYears: number | null = null;
    let parsedAgeMonths: number | null = null;

    if (newPatient.ageYears.trim() !== '') {
      const val = Number(newPatient.ageYears);
      if (!Number.isInteger(val) || val < 0) {
        setError('Age must be a positive whole number.');
        return;
      }
      if (newPatient.ageUnit === 'months') {
        if (val > 120) {
          setError('Age in months must be between 0 and 120.');
          return;
        }
        parsedAgeMonths = val;
        parsedAgeYears = Math.floor(val / 12);
      } else if (newPatient.ageUnit === 'days') {
        if (val > 365) {
          setError('Age in days must be between 0 and 365.');
          return;
        }
        parsedAgeMonths = 0;
        parsedAgeYears = 0;
      } else {
        if (val > 130) {
          setError('Age in years must be between 0 and 130.');
          return;
        }
        parsedAgeYears = val;
        parsedAgeMonths = 0;
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

              // Only link the member when staff explicitly select that
              // person. A family patient with the same phone stays separate.
              linkAsMemberSelf: !creatingDifferentPatient && registerAsMemberSelf,

              phone:
                cleanPhone,

              ageYears:
                parsedAgeYears,

              ageMonths:
                parsedAgeMonths,

              ageUnit:
                newPatient.ageUnit,

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

      setPatientSearchMode('name');
      setPatientNameQuery(`${response.data.name} - ${response.data.clinicNumber}`);
      setPatientPhoneQuery('');
      setPatientSearch(
        `${response.data.name} - ${response.data.clinicNumber}`
      );

      setNewPatient(
        EMPTY_PATIENT_FORM
      );

      setShowNewPatientForm(
        false
      );
      setCreatingDifferentPatient(false);
      setRegisterAsMemberSelf(false);

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
        Number(doctor.defaultConsultationFee) > 0
          ? String(doctor.defaultConsultationFee)
          : ''
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

                ageMonthsAtVisit:
                  selectedPatient.ageMonths,

                ageUnitAtVisit:
                  selectedPatient.ageUnit,

                totalCharge:
                  charge,

                paymentMethod:
                  paymentMode,
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
      setPaymentMode('cash');
      setChargeNote('');

      setError('');
      setSuccess('');
    };


  const startNewPatientVisit =
    () => {
      setSavedVisit(null);

      setSelectedPatient(null);

      setPatientNameQuery('');
      setPatientPhoneQuery('');
      setPatientSearch('');
      setPatientResults([]);
      setHasSearchedPatients(false);

      setSelectedDoctorId('');
      setTotalCharge('');
      setPaymentMode('cash');
      setChargeNote('');

      setShowNewPatientForm(false);
      setCreatingDifferentPatient(false);
      setRegisterAsMemberSelf(false);
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

              <p className="mt-1 text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                <span>{savedVisit.doctor.name}</span>
                <span>•</span>
                <span>
                  Rs.{' '}
                  {Number(
                    savedVisit.consultationFee
                  ).toFixed(2)}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  {savedVisit.paymentMethod === 'fonepay' ? (
                    <>
                      <QrCode className="h-3.5 w-3.5 text-indigo-700" />
                      <span>Fonepay / QR</span>
                    </>
                  ) : (
                    <>
                      <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                      <span>Cash</span>
                    </>
                  )}
                </span>
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
                {displayAge(
                  savedVisit.ageAtVisit,
                  savedVisit.ageMonthsAtVisit,
                  savedVisit.ageUnitAtVisit
                )}
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
                    Use separate fields for patient name / Clinic No. and 10-digit phone number.
                  </p>
                </div>
              </div>

              {!selectedPatient && (
                <button
                  type="button"
                  onClick={
                    openNewPatientForm
                  }
                  className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-teal-700 bg-teal-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-teal-800 hover:border-teal-800"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Register New Patient
                </button>
              )}
            </div>


            {!selectedPatient && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                  <div>
                    <label htmlFor="opd-search-name" className="mb-1 block text-xs font-bold text-slate-700">
                      Search by Patient Name / Clinic No.
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="opd-search-name"
                        type="text"
                        autoComplete="off"
                        value={patientNameQuery}
                        onFocus={() => activatePatientSearch('name')}
                        onChange={(event) => updatePatientSearch('name', event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            if (canSearchPatients) void searchPatients();
                          }
                        }}
                        placeholder="e.g. Ram Sharma or CL-000001"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Type at least 2 characters.</p>
                  </div>

                  <div>
                    <label htmlFor="opd-search-phone" className="mb-1 block text-xs font-bold text-slate-700">
                      Search by Phone Number (10 digits)
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="opd-search-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={10}
                        value={patientPhoneQuery}
                        onFocus={() => activatePatientSearch('phone')}
                        onChange={(event) => updatePatientSearch('phone', event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            if (canSearchPatients) void searchPatients();
                          }
                        }}
                        placeholder="Enter 10-digit mobile number"
                        aria-describedby="opd-phone-search-help"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                      />
                    </div>
                    <p
                      id="opd-phone-search-help"
                      role="status"
                      aria-live="polite"
                      className={`mt-1 text-[11px] ${patientSearchMode === 'phone' && patientSearch.length > 0 && patientSearch.length < 10 ? 'font-semibold text-amber-700' : 'text-slate-500'}`}
                    >
                      {patientSearchMode === 'phone' && patientSearch.length > 0 && patientSearch.length < 10
                        ? `${patientSearch.length}/10 digits â€” enter ${10 - patientSearch.length} more.`
                        : patientSearchMode === 'phone' && patientSearch.length === 10
                          ? '10/10 digits â€” searching automatically.'
                          : 'Exactly 10 digits required; no search for partial numbers.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void searchPatients()}
                    disabled={!canSearchPatients || patientSearching}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 lg:mb-5"
                  >
                    {patientSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {patientSearchMode === 'phone' ? 'Search Phone' : 'Search Name'}
                  </button>
                </div>

                {hasSearchedPatients &&
                  !patientSearching &&
                  !searchedMemberLoading &&
                  searchedMember &&
                  searchedMember.phone === patientSearch.trim() && (
                    <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4">
                      <p className="text-sm font-extrabold text-teal-900">
                        Registered Contact / Member
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {searchedMember.name} | {searchedMember.membershipNumber}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        A membership identifies the contact, not everyone using this phone.
                        Verify the actual patient by name, age and Clinic No.
                      </p>
                      {patientResults.length === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const member = searchedMember;
                            if (!member) return;
                            openNewPatientForm();
                            setRegisterAsMemberSelf(true);
                            setNewPatient({
                              ...EMPTY_PATIENT_FORM,
                              name: sanitizePatientName(member.name),
                              phone: member.phone,
                              address: (member.address ?? '').slice(0, 50),
                            });
                          }}
                          className="mt-3 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-teal-800"
                        >
                          This Patient Is the Registered Member
                        </button>
                      )}
                    </div>
                  )}

                {hasSearchedPatients &&
                  !patientSearching &&
                  !searchedMemberLoading &&
                  patientResults.length === 0 &&
                  !(searchedMember && searchedMember.phone === patientSearch.trim()) && (
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

                              {(patient.ageYears !== null || patient.ageMonths !== undefined) && (
                                <span>
                                  Age {displayAge(patient.ageYears, patient.ageMonths, patient.ageUnit)}
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

                {patientSearchMode === 'phone' && /^\d{10}$/.test(patientSearch) &&
                  !patientSearching && hasSearchedPatients && !showNewPatientForm && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      {/* OPD_FAMILY_UI_REFINEMENT_127M: prominent separate-patient action. */}
                      <p className="mb-2 text-sm font-semibold text-slate-800">
                        Someone else using this phone number?
                      </p>
                      <button
                        type="button"
                        onClick={openDifferentPatientForm}
                        style={{ backgroundColor: '#0f766e', color: '#ffffff' }}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-800 px-4 py-3 text-sm font-extrabold shadow-sm transition hover:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto"
                      >
                        <UserPlus className="h-5 w-5" />
                        Register New Patient (Same Phone)
                      </button>
                      <p className="mt-2 text-xs text-slate-600">
                        For a child or family member. Their own Clinic No. and medical history will be created.
                      </p>
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
                        Selected Patient â€” OPD ticket will use THIS Clinic No.
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

                      {(selectedPatient.ageYears !== null || selectedPatient.ageMonths !== undefined) && (
                        <span>
                          Age: {displayAge(selectedPatient.ageYears, selectedPatient.ageMonths, selectedPatient.ageUnit)}
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
                      {creatingDifferentPatient ? 'Register Different Family Patient' : 'Register New Patient'}
                    </h3>

                    <p className="mt-0.5 text-[11px] text-slate-500">
                      A new Clinic No. and a separate medical record will be created.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      {
                        setShowNewPatientForm(false);
                        setCreatingDifferentPatient(false);
                        setRegisterAsMemberSelf(false);
                      }
                    }
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>


                {/* OPD_FAMILY_FORM_SIMPLIFIED_127N: Staff chose the different-patient action already. */}

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
                      onChange={(event) => {
                        setRegisterAsMemberSelf(false);
                        setNewPatient((previous) => ({
                          ...previous,
                          name: sanitizePatientName(event.target.value),
                        }));
                      }}
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
                      onChange={(event) => {
                        setRegisterAsMemberSelf(false);
                        setNewPatient((previous) => ({
                          ...previous,
                          phone: normalizePatientPhone(event.target.value),
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>


                  <div className="md:col-span-2 xl:col-span-5">
                    {newPatient.phone.length > 0 && newPatient.phone.length < 10 && (
                      <p role="status" className="text-xs font-semibold text-amber-700">
                        Patient phone is incomplete ({newPatient.phone.length}/10 digits). Enter all 10 digits or leave it blank.
                      </p>
                    )}
                    {registerAsMemberSelf && !creatingDifferentPatient && (
                      <p className="mb-2 text-xs font-bold text-teal-800">
                        Registering the member personally (not a family patient).
                      </p>
                    )}
                    {customerLookupStatus === 'loading' && (
                      <p className="text-xs text-slate-500">
                        Checking registered memberships...
                      </p>
                    )}

                    {customerLookupStatus === 'found' &&
                      sharedCustomer &&
                      sharedCustomer.phone === normalizePatientPhone(newPatient.phone) && (
                      <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                        <p className="text-xs font-extrabold text-teal-900">
                          Registered Member Found
                        </p>

                        <p className="mt-1 text-xs text-slate-700">
                          {sharedCustomer.name}
                          {' | '}
                          {sharedCustomer.phone}
                          {' | '}
                          {sharedCustomer.membershipNumber}
                        </p>

                        <p className="text-xs text-slate-600">
                          {sharedCustomer.address || 'Address not recorded'}
                        </p>

                        {!creatingDifferentPatient ? (
                          <button
                            type="button"
                            onClick={() => {
                              const savedName = sanitizePatientName(sharedCustomer.name);
                              setRegisterAsMemberSelf(true);
                              setNewPatient((previous) => ({
                                ...previous,
                                name: savedName || previous.name,
                                address: sharedCustomer.address
                                  ? sharedCustomer.address.slice(0, 50)
                                  : previous.address,
                              }));
                            }}
                            className="mt-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800"
                          >
                            Patient IS This Member â€” Use Details
                          </button>
                        ) : (
                          <p className="mt-2 text-xs font-bold text-amber-800">
                            The registered member is the contact person only.
                            Do not copy their name for this patient.
                          </p>
                        )}

                        <p className="mt-2 text-[11px] text-slate-600">
                          If this person already has an OPD patient number,
                          select their existing OPD record instead of
                          registering a duplicate patient.
                        </p>
                      </div>
                    )}

                    {customerLookupStatus === 'missing' && (
                      <p className="text-xs text-slate-500">
                        No registered member found. You can continue OPD registration as a non-member.
                      </p>
                    )}

                    {customerLookupStatus === 'error' && (
                      <p className="text-xs text-amber-700">
                        Membership lookup is currently unavailable.
                        Existing patient records may still need linking.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Age
                    </label>

                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max={newPatient.ageUnit === 'months' ? 120 : newPatient.ageUnit === 'days' ? 365 : 130}
                        step="1"
                        value={newPatient.ageYears}
                        onChange={(event) =>
                          setNewPatient((previous) => ({
                            ...previous,
                            ageYears: event.target.value,
                          }))
                        }
                        placeholder={newPatient.ageUnit === 'months' ? 'Months' : newPatient.ageUnit === 'days' ? 'Days' : 'Years'}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                      />
                      <select
                        value={newPatient.ageUnit}
                        onChange={(event) =>
                          setNewPatient((previous) => ({
                            ...previous,
                            ageUnit: event.target.value as 'years' | 'months' | 'days',
                          }))
                        }
                        className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-teal-500"
                      >
                        <option value="years">Years</option>
                        <option value="months">Months</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
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
                      maxLength={50}
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
                      <p className="mt-1 text-right text-[11px] text-slate-500">
                        {newPatient.address.length}/50 characters
                      </p>
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
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <fieldset className="min-w-0">
                    <legend className="mb-2 text-xs font-bold text-slate-700">
                      Doctor *
                    </legend>

                    <div
                      className={`space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2 ${
                        doctors.length > 3
                          ? 'max-h-[420px] overflow-y-auto overscroll-contain pr-1.5'
                          : ''
                      }`}
                    >
                      {doctorsLoading && doctors.length === 0 && (
                        <div role="status" className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading available doctors...
                        </div>
                      )}

                      {doctors.map((doctor) => {
                        const isSelected = selectedDoctor?.id === doctor.id;
                        const initials = doctor.name
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((word) => word.charAt(0).toUpperCase())
                          .join('') || 'DR';

                        return (
                          <label
                            key={doctor.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-teal-300 ${
                              isSelected
                                ? 'border-teal-500 bg-teal-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
                            } ${doctorsLoading ? 'cursor-wait opacity-60' : ''}`}
                          >
                            <input
                              type="radio"
                              name="new-opd-doctor"
                              value={doctor.id}
                              checked={isSelected}
                              onChange={() => handleDoctorChange(doctor.id)}
                              disabled={doctorsLoading}
                              className="mt-3 h-4 w-4 shrink-0 accent-teal-700"
                              aria-label={`Select ${doctor.name}`}
                            />

                            <span
                              aria-hidden="true"
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-100 text-xs font-extrabold text-teal-800"
                            >
                              {doctor.photoData ? (
                                <img
                                  src={doctor.photoData}
                                  alt=""
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : initials}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-sm font-extrabold text-slate-900">
                                {doctor.name}
                              </span>
                              <span className="mt-0.5 block break-words text-xs font-semibold text-teal-700">
                                {doctor.speciality || 'General consultation'}
                              </span>
                              {doctor.qualification && (
                                <span className="mt-0.5 block break-words text-[11px] text-slate-600">
                                  {doctor.qualification}
                                </span>
                              )}
                              <span className="mt-1 block break-words text-[11px] text-slate-500">
                                {doctor.nmcNumber
                                  ? `NMC: ${doctor.nmcNumber}`
                                  : `Doctor code: ${doctor.doctorCode || '-'}`}
                              </span>
                            </span>

                            <span className="shrink-0 text-right">
                              <span className="block text-[10px] font-semibold text-slate-500">
                                Default fee
                              </span>
                              <span className="block whitespace-nowrap text-xs font-extrabold text-slate-800">
                                Rs. {Number(doctor.defaultConsultationFee ?? 0).toLocaleString('en-NP')}
                              </span>
                              {isSelected && (
                                <span className="mt-1 block text-[10px] font-bold text-teal-700">
                                  Selected
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {doctors.length > 3 && (
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        Scroll inside the doctor list to view all {doctors.length} doctors.
                      </p>
                    )}
                  </fieldset>
                </div>


                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(190px,240px)] sm:items-center">
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                  />

                  <p className="text-[11px] text-slate-500 sm:col-span-2">
                    The doctor default consultation fee is filled automatically but can be adjusted for this OPD.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] sm:items-center">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Payment Mode *
                    </label>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Select payment method received for this OPD registration.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('cash')}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        paymentMode === 'cash'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs ring-1 ring-emerald-500 font-extrabold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMode('fonepay')}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        paymentMode === 'fonepay'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-xs ring-1 ring-indigo-500 font-extrabold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <QrCode className="h-4 w-4 text-indigo-600" />
                      <span>Fonepay / QR</span>
                    </button>
                  </div>
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
