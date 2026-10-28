import React, { useState } from 'react';
import { Check, Plus, Save, Settings } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { PharmacySettings } from '../types/pharmacy';
import { digitsOnlyUpTo, isValidEmail, normalizePhoneNumber } from '../utils/inputValidation';

const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '').slice(0, 10);

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, racks, addRack, deduceRack } = usePharmacy();

  const [formData, setFormData] = useState<PharmacySettings>(() => ({
    ...settings,
    phoneNumber: normalizePhoneNumber(settings.phoneNumber),
  }));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [newRackName, setNewRackName] = useState('');
  const [rackError, setRackError] = useState('');

  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(settings);

  const fieldClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/10';

  const sectionCardClass =
    'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
    updateSettings(formData);
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDiscardChanges = () => {
    setFormData({ ...settings });
    setSaveSuccess(false);
    setFormError('');
  };

  const handleRackCreate = async () => {
    const rackName = newRackName.trim();
    if (!rackName) {
      setRackError('Enter a rack name first.');
      return;
    }

    const result = await addRack(rackName, 'User-created rack');
    if (result.success) {
      setNewRackName('');
      setRackError('');
      return;
    }

    setRackError(result.message);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
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
            <h3 className="text-base font-extrabold text-slate-900">Inventory racks</h3>
            <p className="mt-1 text-xs text-slate-500">Create and manage storage racks for your medicines.</p>
          </div>

          <div className="p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                placeholder="Add rack name"
                value={newRackName}
                onChange={(e) => setNewRackName(e.target.value)}
                className={`${fieldClass} sm:flex-1`}
              />
              <button
                type="button"
                onClick={handleRackCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                Add rack
              </button>
            </div>

            {rackError && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {rackError}
              </div>
            )}

            <div className="grid gap-2">
              {racks.map((rack) => (
                <div key={rack.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{rack.name}</div>
                    {rack.description && <div className="text-[11px] text-slate-500">{rack.description}</div>}
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
                      className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </form>
      {hasUnsavedChanges && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
              Unsaved changes
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                type="submit"
                form="pharmacy-profile-form"
                className="flex items-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:border-teal-800 hover:bg-teal-800"
              >
                <Save className="h-4 w-4" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};