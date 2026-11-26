import React, { useState } from 'react';
import { AlertTriangle, BadgeCheck, UserPlus } from 'lucide-react';
import { ApiError, apiRequest } from '../services/api';

type CreatedMember = {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  membershipNumber: string;
  memberSince: string;
};
type ExistingProfile = {
  id: number;
  name: string;
  phone: string;
  address: string | null;
};
type MembershipError = {
  code?: string;
  message?: string;
  existingCustomer?: ExistingProfile;
};
type MembershipResponse = {
  success: boolean;
  message: string;
  data: CreatedMember;
};
type Props = {
  onRegistered: (member: CreatedMember) => void;
};

export const MembershipRegistration: React.FC<Props> = ({ onRegistered }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingProfile, setExistingProfile] = useState<ExistingProfile | null>(null);
  const [verified, setVerified] = useState(false);

  const resetReview = () => {
    setError('');
    setSuccess('');
    setExistingProfile(null);
    setVerified(false);
  };

  const register = async (confirmExistingProfile: boolean) => {
    if (submitting) return;
    if (confirmExistingProfile && (!existingProfile || !verified)) return;
    const cleanedName = name.trim().replace(/\s+/g, ' ');
    const cleanedAddress = address.trim().replace(/\s+/g, ' ');
    const cleanedPhone = phone.replace(/\D/g, '').slice(0, 10);

    if (
      cleanedName.length < 2 || cleanedName.length > 150 ||
      cleanedAddress.length < 3 || cleanedAddress.length > 300 ||
      !/^\d{7,10}$/.test(cleanedPhone)
    ) {
      if (!/^\d{7,10}$/.test(cleanedPhone)) {
        setError('Phone number must be between 7 and 10 digits (numbers only).');
        return;
      }
      if (cleanedName.length < 2 || cleanedName.length > 150) {
        setError('Please enter a valid full name (2-150 characters).');
        return;
      }
      if (cleanedAddress.length < 3 || cleanedAddress.length > 300) {
        setError('Please enter a valid address (3-300 characters).');
        return;
      }
      setError('Enter a name (2-150 characters), phone (7-10 digits), and address (3-300 characters).');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiRequest<MembershipResponse>('/customers/members', {
        method: 'POST',
        body: JSON.stringify({
          name: cleanedName,
          phone: cleanedPhone,
          address: cleanedAddress,
          confirmExistingProfile,
        }),
      });
      if (!response.success || !response.data.membershipNumber) {
        throw new Error('Membership registration did not return a valid member number.');
      }
      setSuccess(`${response.data.name} registered as ${response.data.membershipNumber}.`);
      setName('');
      setPhone('');
      setAddress('');
      setExistingProfile(null);
      setVerified(false);
      onRegistered(response.data);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const details = caught.data && typeof caught.data === 'object'
          ? caught.data as MembershipError
          : null;
        if (
          caught.status === 409 &&
          details?.code === 'EXISTING_PROFILE_CONFIRMATION_REQUIRED' &&
          details.existingCustomer
        ) {
          setExistingProfile(details.existingCustomer);
          setVerified(false);
          setError('An older customer profile uses this phone. Compare details below and verify the person before converting that profile to a membership.');
        } else {
          setExistingProfile(null);
          setVerified(false);
          setError(details?.message || caught.message);
        }
      } else {
        setExistingProfile(null);
        setVerified(false);
        setError(caught instanceof Error ? caught.message : 'Membership registration failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Register pharmacy membership">
      <div className="mb-4 flex items-start gap-3">
        <UserPlus className="mt-0.5 h-6 w-6 text-teal-700" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Register New Member</h2>
          <p className="text-sm text-slate-500">Only explicit admin registration creates membership. POS and OPD visits without membership are still allowed.</p>
        </div>
      </div>

      <form
        className="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end"
        onSubmit={(event) => { event.preventDefault(); void register(false); }}
      >
        <label className="block text-xs font-semibold text-slate-700">
          Full name <span className="text-rose-600">*</span>
          <input
            required
            maxLength={150}
            autoComplete="name"
            value={name}
            onChange={(event) => { setName(event.target.value); resetReview(); }}
            placeholder="Member's full name"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          <span className="flex items-center justify-between">
            <span>Phone number <span className="text-rose-600">*</span></span>
            {phone.length > 0 && (
              <span className={`text-[11px] font-normal ${
                phone.length < 7 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-bold'
              }`}>
                {phone.length}/10 digits {phone.length < 7 ? '(min 7)' : '✓'}
              </span>
            )}
          </span>
          <input
            required
            type="tel"
            inputMode="numeric"
            pattern="[0-9]{7,10}"
            maxLength={10}
            autoComplete="tel"
            value={phone}
            onKeyDown={(e) => {
              if (
                ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                (e.ctrlKey || e.metaKey)
              ) {
                return;
              }
              if (!/^\d$/.test(e.key)) {
                e.preventDefault();
              }
            }}
            onChange={(event) => {
              const numericOnly = event.target.value.replace(/\D/g, '').slice(0, 10);
              setPhone(numericOnly);
              resetReview();
            }}
            placeholder="7-10 digits (e.g. 98XXXXXXXX)"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 font-mono"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Address <span className="text-rose-600">*</span>
          <input
            required
            maxLength={300}
            autoComplete="street-address"
            value={address}
            onChange={(event) => { setAddress(event.target.value); resetReview(); }}
            placeholder="Member's address"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Registering...' : 'Register Member'}
        </button>
      </form>

      {success && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          <BadgeCheck className="h-5 w-5" aria-hidden="true" /> {success}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
      {existingProfile && (
        <div className="mt-3 space-y-3 rounded-lg border border-amber-300 p-4 text-sm">
          <p className="font-bold text-slate-900">Existing non-member profile - verify identity</p>
          <dl className="grid gap-2 sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Saved name</dt><dd className="font-semibold">{existingProfile.name}</dd></div>
            <div><dt className="text-xs text-slate-500">Saved phone</dt><dd className="font-semibold">{existingProfile.phone}</dd></div>
            <div><dt className="text-xs text-slate-500">Saved address</dt><dd className="font-semibold">{existingProfile.address || 'Not recorded'}</dd></div>
          </dl>
          <label className="flex cursor-pointer items-start gap-2 text-slate-800">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
              className="mt-1"
            />
            I verified this is the same person and approve enrollment of this existing customer profile.
          </label>
          <button
            type="button"
            disabled={!verified || submitting}
            onClick={() => { void register(true); }}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Registering...' : 'Confirm Existing Profile Membership'}
          </button>
          <p className="text-xs text-slate-500">Conflicting names or addresses cannot be auto-enrolled. Review those cases separately. No history is merged by this form.</p>
        </div>
      )}
    </section>
  );
};