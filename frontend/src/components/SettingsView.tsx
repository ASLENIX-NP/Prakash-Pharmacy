import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, ImagePlus, Plus, Save, Search, Settings, Trash2, Upload, Warehouse } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { PharmacySettings } from '../types/pharmacy';
import { digitsOnlyUpTo, isValidEmail, normalizePhoneNumber } from '../utils/inputValidation';
import { apiRequest } from '../services/api';
import { setBrowserFavicon } from '../utils/favicon';

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function syncUnmodifiedSetting<K extends keyof PharmacySettings>(
  current: PharmacySettings,
  previous: PharmacySettings,
  latest: PharmacySettings,
  key: K,
): PharmacySettings {
  return current[key] === previous[key]
    ? { ...current, [key]: latest[key] }
    : current;
}

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, racks, addRack, deduceRack } = usePharmacy();

  const [formData, setFormData] = useState<PharmacySettings>(() => ({
    ...settings,
    phoneNumber: normalizePhoneNumber(settings.phoneNumber),
  }));
  const previousSettings = useRef(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [logoError, setLogoError] = useState('');
  const [newRackName, setNewRackName] = useState('');
  const [newRackDescription, setNewRackDescription] = useState('');
  const [rackError, setRackError] = useState('');
  const [rackSearch, setRackSearch] = useState('');
  const [rackFilter, setRackFilter] = useState<'all' | 'custom' | 'general'>('all');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState(false);

  const hasUnsavedChanges = (Object.keys(formData) as (keyof PharmacySettings)[]).some(
    (key) => formData[key] !== settings[key],
  );

  useEffect(() => {
    const previous = previousSettings.current;
    previousSettings.current = settings;

    setFormData((current) =>
      (Object.keys(settings) as (keyof PharmacySettings)[]).reduce(
        (next, key) => syncUnmodifiedSetting(next, previous, settings, key),
        current,
      ),
    );
  }, [settings]);

  const fieldClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/10';

  const sectionCardClass =
    'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]';

  const filteredRacks = racks.filter((rack) => {
    const matchesSearch =
      rack.name.toLowerCase().includes(rackSearch.toLowerCase()) ||
      (rack.description ?? '').toLowerCase().includes(rackSearch.toLowerCase());

    const matchesFilter =
      rackFilter === 'all' ||
      (rackFilter === 'general' && rack.name.toLowerCase() === 'general shelf') ||
      (rackFilter === 'custom' && rack.name.toLowerCase() !== 'general shelf');

    return matchesSearch && matchesFilter;
  });

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError('Choose a PNG, JPEG, or WebP image.');
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setLogoError('Logo image must be 5 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') {
        setLogoError('Could not read the selected image. Please try again.');
        return;
      }

      const storeLogo = reader.result;
      setFormData((current) => ({ ...current, storeLogo }));
      setBrowserFavicon(storeLogo);
      setLogoError('');

      // Auto-save immediately so the uploaded logo is applied to the favicon and settings
      setIsSaving(true);
      try {
        await updateSettings({ storeLogo });
        setSaveSuccess(true);
        window.setTimeout(() => setSaveSuccess(false), 3000);
      } catch (error) {
        setLogoError(error instanceof Error ? error.message : 'Failed to save the store logo.');
      } finally {
        setIsSaving(false);
      }
    };
    reader.onerror = () => {
      setLogoError('Could not read the selected image. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async () => {
    if (isSaving || formData.storeLogo === settings.storeLogo) {
      return;
    }

    setLogoError('');
    setIsSaving(true);
    try {
      await updateSettings({ storeLogo: formData.storeLogo });
      setBrowserFavicon(formData.storeLogo);
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'Failed to save the store logo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSaving) {
      return;
    }

    if (!/^\d{9}$/.test(formData.panNumber.trim())) {
      setFormError('PAN must be exactly 9 digits.');
      return;
    }

    if (!/^\d{10}$/.test(formData.phoneNumber)) {
      setFormError('Phone number must contain exactly 10 digits.');
      return;
    }

    if (!isValidEmail(formData.emailId)) {
      setFormError('Enter a valid email address.');
      return;
    }

    setFormError('');
    setIsSaving(true);
    try {
      await updateSettings(formData);
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setFormData({ ...settings });
    setSaveSuccess(false);
    setFormError('');
    setLogoError('');
  };

  const handleRackCreate = async () => {
    const rackName = newRackName.trim();
    if (!rackName) {
      setRackError('Enter a rack name first.');
      return;
    }

    const result = await addRack(rackName, newRackDescription.trim() || 'User-created rack');
    if (result.success) {
      setNewRackName('');
      setNewRackDescription('');
      setRackError('');
      setRackSearch('');
      setRackFilter('all');
      return;
    }

    setRackError(result.message);
  };

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    setBackupError('');
    setBackupSuccess(false);
    try {
      const data = await apiRequest<object>('/reports/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prakash-pharmacy-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupSuccess(true);
      window.setTimeout(() => setBackupSuccess(false), 4000);
    } catch (err: unknown) {
      setBackupError(err instanceof Error ? err.message : 'Backup failed. Please try again.');
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className={`premium-settings-shell mx-auto max-w-6xl space-y-5 ${hasUnsavedChanges ? 'pb-24' : 'pb-5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
              <Settings className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Settings</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Pharmacy profile and inventory rack management.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">Admin only</span>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800" role="status">
          <Check className="h-4 w-4" />
          Settings updated successfully.
        </div>
      )}
      {formError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800" role="alert">
          {formError}
        </div>
      )}

      <form id="pharmacy-profile-form" onSubmit={handleSubmit} className="space-y-5">
        <section className={sectionCardClass}>
          <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4">
            <h3 className="text-base font-extrabold text-slate-900">Store details</h3>
            <p className="mt-1 text-xs text-slate-500">Official pharmacy information used on records and bills.</p>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Store / Pharmacy Name *</label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">PAN Number *</label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.panNumber}
                onChange={(e) => setFormData({ ...formData, panNumber: digitsOnlyUpTo(e.target.value, 9) })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Official Phone Number *</label>
              <input
                type="tel"
                inputMode="numeric"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: normalizePhoneNumber(e.target.value) })}
                className={fieldClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">DDA Licence Number</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={20}
                value={formData.ddaLicenceNumber}
                onChange={(e) => setFormData({ ...formData, ddaLicenceNumber: digitsOnlyUpTo(e.target.value, 20) })}
                className={fieldClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Address *</label>
              <textarea
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={`${fieldClass} resize-none`}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Official Email ID *</label>
              <input
                type="email"
                value={formData.emailId}
                onChange={(e) => setFormData({ ...formData, emailId: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        </section>

        <section className={sectionCardClass}>
          <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4">
            <h3 className="text-base font-extrabold text-slate-900">Store logo</h3>
            <p className="mt-1 text-xs text-slate-500">Upload the logo shown on your login page, header, and invoices.</p>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                {formData.storeLogo ? (
                  <img
                    src={formData.storeLogo}
                    alt="Store logo preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImagePlus className="h-7 w-7 text-slate-400" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {formData.storeLogo ? 'Logo selected' : 'Add your pharmacy logo'}
                </p>
                <p className="mt-1 text-xs text-slate-500">PNG, JPEG, or WebP. Maximum file size: 2 MB.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label
                    htmlFor="store-logo-upload"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-teal-700 bg-teal-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-800"
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Upload logo
                  </label>
                  <input
                    id="store-logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoChange}
                    className="sr-only"
                  />
                  {formData.storeLogo && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={async () => {
                        setFormData((current) => ({ ...current, storeLogo: '' }));
                        setBrowserFavicon('/favicon.png');
                        setLogoError('');
                        setIsSaving(true);
                        try {
                          await updateSettings({ storeLogo: '' });
                          setSaveSuccess(true);
                          window.setTimeout(() => setSaveSuccess(false), 3000);
                        } catch (err) {
                          setLogoError(err instanceof Error ? err.message : 'Failed to remove logo.');
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
              {formData.storeLogo !== settings.storeLogo && (
                <button
                  type="button"
                  onClick={handleSaveLogo}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg border border-teal-700 bg-teal-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {isSaving ? 'Saving...' : 'Save logo'}
                </button>
              )}
            </div>
            {logoError && (
              <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">
                {logoError}
              </p>
            )}
          </div>
        </section>

        <section className={sectionCardClass}>
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Inventory racks</h3>
              <p className="mt-1 text-xs text-slate-500">Create and manage storage racks for your medicines.</p>
            </div>
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {racks.length} racks
            </span>
          </div>

          <div className="bg-slate-50/70 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Rack name</label>
                <input
                  type="text"
                  placeholder="e.g. Shelf B-2"
                  value={newRackName}
                  onChange={(e) => setNewRackName(e.target.value)}
                  className={`${fieldClass} h-11`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  What it holds <span className="font-normal lowercase tracking-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Antacids, vitamins"
                  value={newRackDescription}
                  onChange={(e) => setNewRackDescription(e.target.value)}
                  className={`${fieldClass} h-11`}
                />
              </div>

              <button
                type="button"
                onClick={handleRackCreate}
                className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-teal-700 px-4 text-xs font-bold text-white transition-colors hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                Add rack
              </button>
            </div>

            {rackError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {rackError}
              </div>
            )}
          </div>

          <div className="space-y-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={rackSearch}
                  onChange={(e) => setRackSearch(e.target.value)}
                  placeholder="Search racks"
                  className={`${fieldClass} h-10 pl-9`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'custom', label: 'Custom' },
                  { key: 'general', label: 'General' },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    aria-pressed={rackFilter === chip.key}
                    onClick={() => setRackFilter(chip.key as 'all' | 'custom' | 'general')}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      rackFilter === chip.key
                        ? 'border-teal-200 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:text-teal-700'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredRacks.length > 0 ? (
                filteredRacks.map((rack) => {
                  const isGeneralShelf = rack.name.toLowerCase() === 'general shelf';
                  const isColdRack = /cold|refriger|freeze|chill/i.test(rack.name);
                  const tileClass = isColdRack ? 'bg-sky-100 text-sky-700' : isGeneralShelf ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700';
                  const tagClass = isColdRack ? 'bg-sky-100 text-sky-700' : isGeneralShelf ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700';

                  return (
                    <div
                      key={rack.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-teal-200 hover:bg-slate-100"
                    >
                      <div className={`grid h-11 w-11 place-items-center rounded-xl ${tileClass}`}>
                        <Warehouse className="h-5 w-5" strokeWidth={2} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-slate-800">{rack.name}</span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${tagClass}`}>
                            {isGeneralShelf ? 'General' : isColdRack ? 'Cold storage' : 'Custom'}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-[11px] text-slate-500">
                          {rack.description || 'Storage rack for medicine inventory'}
                        </div>
                      </div>

                      {rack.name.toLowerCase() !== 'general shelf' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const response = await deduceRack(rack.id);
                            if (!response.success) {
                              setRackError(response.message);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                  <strong className="mb-1 block text-slate-700">No matching racks found</strong>
                  Try another keyword or add a new rack.
                </div>
              )}
            </div>
          </div>
        </section>

        {hasUnsavedChanges && (
          <div
            className="fixed bottom-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6 lg:left-[255px]"
            aria-live="polite"
          >
            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
              Unsaved changes
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={isSaving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:border-teal-800 hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Data Backup */}
      <section className={sectionCardClass}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <Settings className="h-4 w-4 text-teal-700" />
          <div>
            <h2 className="text-[14px] font-extrabold text-slate-900">Data Backup</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Download a full JSON backup of all pharmacy data (inventory, sales, purchases, distributors, etc.)
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={backupLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:border-teal-800 hover:bg-teal-800 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {backupLoading ? 'Preparing Backup…' : 'Download Backup (JSON)'}
            </button>

            {backupSuccess && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                <Check className="h-3 w-3" />
                Backup downloaded successfully
              </span>
            )}

            {backupError && (
              <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                {backupError}
              </span>
            )}
          </div>

          <p className="mt-3 text-[11px] text-slate-400">
            The backup includes: inventory, distributors, purchase invoices, sales bills, sales returns, supplier ledger/returns, racks, categories, generics, doctors, clinic patients &amp; visits, stock adjustments, inventory safety-status history, and purchase-cancellation audit logs.
            Store this file in a safe place (Google Drive, USB drive, etc.).
          </p>
        </div>
      </section>
    </div>
  );
};
