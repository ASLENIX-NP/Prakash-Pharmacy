import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  UserCheck,
  UserRound,
  UserX,
  X,
} from 'lucide-react';

import { apiRequest } from '../services/api';
import { useDialog } from '../context/DialogContext';

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
  createdAt?: string;
  updatedAt?: string;
}

interface DoctorsResponse {
  success: boolean;
  count: number;
  data: Doctor[];
}

interface DoctorResponse {
  success: boolean;
  message?: string;
  data: Doctor;
}

interface DoctorFormState {
  name: string;
  speciality: string;
  qualification: string;
  nmcNumber: string;
  defaultConsultationFee: string;
  photoData: string | null;
}

const EMPTY_FORM: DoctorFormState = {
  name: '',
  speciality: '',
  qualification: '',
  nmcNumber: '',
  defaultConsultationFee: '',
  photoData: null,
};


const prepareDoctorPhoto = async (file: File): Promise<string> => {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5_000_000
  ) {
    throw new Error('Choose a JPG, PNG or WebP image under 5 MB.');
  }

  const bitmap = await createImageBitmap(file);

  try {
    if (bitmap.width * bitmap.height > 25_000_000) {
      throw new Error('Image dimensions are too large.');
    }

    const canvas = document.createElement('canvas');
    const ratio = Math.min(
      1,
      512 / Math.max(bitmap.width, bitmap.height)
    );

    canvas.width = Math.max(
      1,
      Math.round(bitmap.width * ratio)
    );

    canvas.height = Math.max(
      1,
      Math.round(bitmap.height * ratio)
    );

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Image conversion is unavailable.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let value = canvas.toDataURL('image/jpeg', 0.78);

    if (value.length > 240000) {
      canvas.width = Math.max(1, Math.round(canvas.width * 0.7));
      canvas.height = Math.max(1, Math.round(canvas.height * 0.7));

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      value = canvas.toDataURL('image/jpeg', 0.58);
    }

    if (value.length > 240000) {
      throw new Error('Image is still too large after resizing.');
    }

    return value;
  } finally {
    bitmap.close();
  }
};

export const DoctorManagementPanel: React.FC = () => {
  const { confirmDialog, showToast } = useDialog();
  const [doctors, setDoctors] =
    useState<Doctor[]>([]);

  const [form, setForm] =
    useState<DoctorFormState>(EMPTY_FORM);

  const [editingDoctor, setEditingDoctor] =
    useState<Doctor | null>(null);

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);

  const [statusChangingId, setStatusChangingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');


  const loadDoctors =
    useCallback(async () => {
      try {
        setLoading(true);
        setError('');

        const response =
          await apiRequest<DoctorsResponse>(
            '/doctors?status=all'
          );

        setDoctors(
          Array.isArray(response.data)
            ? response.data
            : []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load doctors.'
        );
      } finally {
        setLoading(false);
      }
    }, []);


  useEffect(() => {
    void loadDoctors();
  }, [loadDoctors]);


  const activeCount =
    useMemo(
      () =>
        doctors.filter(
          (doctor) =>
            doctor.status === 'active'
        ).length,
      [doctors]
    );


  const inactiveCount =
    doctors.length - activeCount;


  const filteredDoctors =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return doctors;
      }

      return doctors.filter(
        (doctor) =>
          doctor.name
            .toLowerCase()
            .includes(query) ||
          doctor.doctorCode
            .toLowerCase()
            .includes(query) ||
          doctor.speciality
            .toLowerCase()
            .includes(query) ||
          doctor.qualification
            .toLowerCase()
            .includes(query) ||
          doctor.nmcNumber
            .toLowerCase()
            .includes(query)
      );
    }, [doctors, search]);


  const resetForm = () => {
    setEditingDoctor(null);
    setForm(EMPTY_FORM);
    setError('');
  };


  const startEditing = (
    doctor: Doctor
  ) => {
    setEditingDoctor(doctor);

    setForm({
      name: doctor.name,
      speciality: doctor.speciality,
      qualification: doctor.qualification,
      nmcNumber: doctor.nmcNumber,
      photoData: doctor.photoData ?? null,
      defaultConsultationFee:
        Number(doctor.defaultConsultationFee) > 0
          ? String(doctor.defaultConsultationFee)
          : '',
    });

    setError('');
    setSuccess('');

  };


  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const name =
      form.name.trim();

    if (!name) {
      setError(
        'Doctor name is required.'
      );
      return;
    }

    const fee =
      form.defaultConsultationFee.trim() === ''
        ? 0
        : Number(
            form.defaultConsultationFee
          );

    if (
      !Number.isFinite(fee) ||
      fee < 0
    ) {
      setError(
        'Consultation fee must be zero or a positive number.'
      );
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const payload = {
        name,
        speciality:
          form.speciality.trim(),
        qualification:
          form.qualification.trim(),
        nmcNumber:
          form.nmcNumber.trim(),
        defaultConsultationFee:
          fee,
        photoData: form.photoData,
      };

      let response:
        DoctorResponse;

      if (editingDoctor) {
        response =
          await apiRequest<DoctorResponse>(
            `/doctors/${encodeURIComponent(
              editingDoctor.id
            )}`,
            {
              method: 'PUT',
              body:
                JSON.stringify(
                  payload
                ),
            }
          );
      } else {
        response =
          await apiRequest<DoctorResponse>(
            '/doctors',
            {
              method: 'POST',
              body:
                JSON.stringify(
                  payload
                ),
            }
          );
      }

      setSuccess(
        response.message ||
          (editingDoctor
            ? 'Doctor updated successfully.'
            : 'Doctor added successfully.')
      );

      setEditingDoctor(null);
      setForm(EMPTY_FORM);

      await loadDoctors();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save doctor.'
      );
    } finally {
      setSaving(false);
    }
  };


  const changeDoctorStatus =
    async (
      doctor: Doctor,
      nextStatus:
        | 'active'
        | 'inactive'
    ) => {
      if (
        nextStatus === 'inactive'
      ) {
        const confirmed =
          await confirmDialog({
            title: `Deactivate ${doctor.name}`,
            message: `Deactivate ${doctor.name}?\n\nThe doctor will no longer be selectable for new OPD visits. Existing OPD history will remain unchanged.`,
            confirmLabel: 'Deactivate',
            cancelLabel: 'Keep Active',
            type: 'warning',
          });

        if (!confirmed) {
          return;
        }
      }

      try {
        setStatusChangingId(
          doctor.id
        );

        setError('');
        setSuccess('');

        let response:
          DoctorResponse;

        if (
          nextStatus === 'inactive'
        ) {
          response =
            await apiRequest<DoctorResponse>(
              `/doctors/${encodeURIComponent(
                doctor.id
              )}`,
              {
                method: 'DELETE',
              }
            );
        } else {
          response =
            await apiRequest<DoctorResponse>(
              `/doctors/${encodeURIComponent(
                doctor.id
              )}`,
              {
                method: 'PUT',
                body:
                  JSON.stringify({
                    status: 'active',
                  }),
              }
            );
        }

        setSuccess(
          response.message ||
            (nextStatus === 'active'
              ? 'Doctor reactivated successfully.'
              : 'Doctor deactivated successfully.')
        );

        if (
          editingDoctor?.id ===
          doctor.id
        ) {
          resetForm();
        }

        await loadDoctors();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to change doctor status.'
        );
      } finally {
        setStatusChangingId(
          null
        );
      }
    };


  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Registered Doctors
            </span>

            <UserRound className="h-4 w-4 text-slate-400" />
          </div>

          <strong className="mt-2 block text-2xl font-extrabold text-slate-900">
            {doctors.length}
          </strong>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">
              Active Doctors
            </span>

            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>

          <strong className="mt-2 block text-2xl font-extrabold text-emerald-800">
            {activeCount}
          </strong>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              Inactive Doctors
            </span>

            <UserX className="h-4 w-4 text-slate-500" />
          </div>

          <strong className="mt-2 block text-2xl font-extrabold text-slate-700">
            {inactiveCount}
          </strong>
        </div>
      </div>


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


      {/* Add / Edit Doctor */}

      {editingDoctor && (
        <button
          type="button"
          aria-label="Close edit doctor"
          onClick={resetForm}
          className="fixed inset-0 z-[70] cursor-default bg-slate-950/45"
        />
      )}

      <form
        onSubmit={handleSubmit}
        role={editingDoctor ? 'dialog' : undefined}
        aria-modal={editingDoctor ? true : undefined}
        aria-label={
          editingDoctor
            ? `Edit ${editingDoctor.doctorCode}`
            : 'Add Doctor'
        }
        className={
          editingDoctor
            ? 'fixed left-1/2 top-4 z-[80] max-h-[calc(100dvh-2rem)] w-[calc(100%_-_1rem)] max-w-5xl -translate-x-1/2 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-[calc(100%_-_2rem)] sm:-translate-y-1/2 sm:p-6'
            : 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'
        }
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
              {editingDoctor ? (
                <Edit3 className="h-5 w-5" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </div>

            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {editingDoctor
                  ? `Edit ${editingDoctor.doctorCode}`
                  : 'Add Doctor'}
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {editingDoctor
                  ? 'Update doctor details. Changes will apply to future OPD entries.'
                  : 'Store doctor details used in OPD entry and sticker printing.'}
              </p>
            </div>
          </div>

          {editingDoctor && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          )}
        </div>



        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/70 p-4 shadow-sm">
          {form.photoData ? (
            <img
              src={form.photoData}
              alt="Doctor photo preview"
              className="h-16 w-16 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-teal-100 text-lg font-bold text-teal-800">
              {form.name.trim().slice(0, 1).toUpperCase() || 'DR'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <label htmlFor="doctor-photo-upload" className="block text-xs font-bold text-slate-700">
              Doctor Photograph (Optional)
            </label>

            <input
              id="doctor-photo-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={saving || photoUploading}
              className="peer sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;

                try {
                  setPhotoUploading(true);
                  setError('');

                  const photoData = await prepareDoctorPhoto(file);
                  setForm(previous => ({ ...previous, photoData }));
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Unable to read doctor photo.'
                  );
                } finally {
                  setPhotoUploading(false);
                }
              }}
            />

            <label
              htmlFor="doctor-photo-upload"
              className="mt-2 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-400 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
            >
              <span aria-hidden="true">+</span>
              {form.photoData ? 'Change Doctor Photo' : 'Upload Doctor Photo'}
            </label>

            {photoUploading ? (
              <p className="mt-2 text-xs font-semibold text-teal-700">
                Preparing photo...
              </p>
            ) : form.photoData ? (
              <p className="mt-2 text-xs font-semibold text-teal-700">
                Photo ready. Save the doctor to keep it.
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                No photo selected yet.
              </p>
            )}

            <p className="mt-1 text-xs text-slate-600">
              JPG, PNG or WebP (maximum 5 MB). Automatically resized.
            </p>
          </div>

          {form.photoData && (
            <button
              type="button"
              disabled={saving || photoUploading}
              onClick={() =>
                setForm(previous => ({ ...previous, photoData: null }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Remove photo
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Doctor Name *
            </label>

            <input
              value={form.name}
              onChange={(event) =>
                setForm(
                  (previous) => ({
                    ...previous,
                    name:
                      event.target.value,
                  })
                )
              }
              placeholder="Dr. Ram Sharma"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>


          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Specialty
            </label>

            <input
              value={
                form.speciality
              }
              onChange={(event) =>
                setForm(
                  (previous) => ({
                    ...previous,
                    speciality:
                      event.target.value,
                  })
                )
              }
              placeholder="General Medicine"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>


          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Qualification
            </label>

            <input
              value={
                form.qualification
              }
              onChange={(event) =>
                setForm(
                  (previous) => ({
                    ...previous,
                    qualification:
                      event.target.value,
                  })
                )
              }
              placeholder="MBBS, MD"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>


          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              NMC Number
            </label>

            <input
              value={
                form.nmcNumber
              }
              onChange={(event) =>
                setForm(
                  (previous) => ({
                    ...previous,
                    nmcNumber:
                      event.target.value,
                  })
                )
              }
              placeholder="NMC registration"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>


          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Default Fee (Rs.)
            </label>

            <div className="relative">
              <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.defaultConsultationFee}
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,
                      defaultConsultationFee:
                        event.target.value,
                    })
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              />
            </div>
          </div>
        </div>


        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={saving || photoUploading}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingDoctor ? (
              <Edit3 className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}

            {saving
              ? 'Saving...'
              : editingDoctor
              ? 'Update Doctor'
              : 'Add Doctor'}
          </button>
        </div>
      </form>


      {/* Doctor Directory */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Doctor Directory
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Active doctors can be selected for new OPD visits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search doctor..."
                className="w-60 max-w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                void loadDoctors()
              }
              disabled={loading}
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
        </div>


        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-medium text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading doctors...
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <Stethoscope className="h-10 w-10 text-slate-300" />

            <p className="mt-3 text-sm font-bold text-slate-600">
              No doctors found
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Add the clinic's first doctor using the form above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">
                    Doctor
                  </th>

                  <th className="px-4 py-3">
                    Specialty
                  </th>

                  <th className="px-4 py-3">
                    Qualification
                  </th>

                  <th className="px-4 py-3">
                    NMC No.
                  </th>

                  <th className="px-4 py-3 text-right">
                    Default Fee
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredDoctors.map(
                  (doctor) => {
                    const changingStatus =
                      statusChangingId ===
                      doctor.id;

                    return (
                      <tr
                        key={doctor.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-teal-50 text-teal-700">
                              {doctor.photoData ? (
                                <img src={doctor.photoData} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <Stethoscope className="h-4 w-4" />
                              )}
                            </div>

                            <div>
                              <div className="text-sm font-extrabold text-slate-900">
                                {doctor.name}
                              </div>

                              <div className="mt-0.5 font-mono text-[10px] font-bold text-slate-400">
                                {doctor.doctorCode}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-xs font-medium text-slate-600">
                          {doctor.speciality ||
                            '—'}
                        </td>

                        <td className="px-4 py-4 text-xs font-medium text-slate-600">
                          {doctor.qualification ||
                            '—'}
                        </td>

                        <td className="px-4 py-4 font-mono text-xs font-semibold text-slate-600">
                          {doctor.nmcNumber ||
                            '—'}
                        </td>

                        <td className="px-4 py-4 text-right font-mono text-sm font-bold text-slate-800">
                          Rs.{' '}
                          {Number(
                            doctor.defaultConsultationFee ||
                              0
                          ).toFixed(2)}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                              doctor.status ===
                              'active'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-100 text-slate-500'
                            }`}
                          >
                            {doctor.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(
                                  doctor
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>

                            {doctor.status ===
                            'active' ? (
                              <button
                                type="button"
                                disabled={
                                  changingStatus
                                }
                                onClick={() =>
                                  void changeDoctorStatus(
                                    doctor,
                                    'inactive'
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                              >
                                {changingStatus ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserX className="h-3.5 w-3.5" />
                                )}

                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  changingStatus
                                }
                                onClick={() =>
                                  void changeDoctorStatus(
                                    doctor,
                                    'active'
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {changingStatus ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5" />
                                )}

                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
