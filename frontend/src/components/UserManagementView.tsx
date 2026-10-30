import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Mail, 
  Lock, 
  Edit3, 
  Trash2, 
  KeyRound, 
  Check, 
  X, 
  AlertCircle,
  ShoppingCart,
  Layers,
  Truck,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { useDialog } from '../context/DialogContext';
import { PharmacyUser, UserRole } from '../types/pharmacy';
import { isValidEmail, normalizePhoneNumber } from '../utils/inputValidation';

const ROLE_INFO: Record<UserRole, { title: string; desc: string; badgeColor: string }> = {
  'Admin': {
    title: 'Admin (Full Master Access)',
    desc: 'Unrestricted master access to all pharmacy operations: inventory catalog, physical count audit, wholesaler invoices & ledgers, rack management, VAT reports, pharmacy credentials, and staff password control.',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300'
  },
  'Staff': {
    title: 'Staff (Sales & Bill Entry Access)',
    desc: 'Restricted access exclusively for counter Point of Sale (POS), 13% VAT & 0% VAT-Free billing, loose tablet strip dispensing, sales register audit, and reprinting A5 / Thermal tax invoices.',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  }
};

const normalizeStaffPhoneNumber = (value: string) => {
  return normalizePhoneNumber(value);
};

const DEFAULT_SHIFT_TIMES = { start: '07:00', end: '15:00' };

const formatShiftTime = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
};

const formatShiftRange = (start: string, end: string) =>
  `${formatShiftTime(start)} - ${formatShiftTime(end)}`;

const getShiftTimes = (shiftTiming?: string) => {
  const matches = [...(shiftTiming || '').matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)?/gi)];
  if (matches.length >= 2) {
    const toTimeInputValue = (match: RegExpMatchArray) => {
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const period = match[3]?.toUpperCase();

      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      if (hours > 23 || minutes > 59) return null;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    const start = toTimeInputValue(matches[0]);
    const end = toTimeInputValue(matches[1]);
    if (start && end) return { start, end };
  }

  const normalized = (shiftTiming || '').toLowerCase();
  if (normalized.includes('evening')) return { start: '14:00', end: '21:00' };
  if (normalized.includes('full day') || normalized.includes('proprietor')) {
    return { start: '07:00', end: '21:00' };
  }
  return DEFAULT_SHIFT_TIMES;
};

export const UserManagementView: React.FC = () => {
  const { showToast, confirmDialog } = useDialog();
  const { 
    users, 
    currentUser, 
    logout,
    addUser, 
    updateUser, 
    deleteUser, 
    isAdmin, 
    changeStaffPassword 
  } = usePharmacy();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<PharmacyUser | null>(null);
  const [shiftTimes, setShiftTimes] = useState(DEFAULT_SHIFT_TIMES);

  // Form State for User creation/edit
  const [formData, setFormData] = useState<{
    name: string;
    username: string;
    password: string;
    phone: string;
    email: string;
    role: UserRole;
    pinCode: string;
    shiftTiming: string;
    isActive: boolean;
  }>({
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    role: 'Staff',
    pinCode: '',
    shiftTiming: '',
    isActive: true
  });

  // Password reset modal state (Admin only)
  const [passwordResetUser, setPasswordResetUser] = useState<PharmacyUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setShiftTimes(DEFAULT_SHIFT_TIMES);
    setFormData({
      name: '',
      username: '',
      password: '',
      phone: '',
      email: '',
      role: 'Staff',
      pinCode: `${Math.floor(1000 + Math.random() * 9000)}`,
      shiftTiming: formatShiftRange(DEFAULT_SHIFT_TIMES.start, DEFAULT_SHIFT_TIMES.end),
      isActive: true
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: PharmacyUser) => {
    setEditingUser(user);
    const parsedShiftTimes = getShiftTimes(user.shiftTiming);
    setShiftTimes(parsedShiftTimes);
    setFormData({
      name: user.name,
      username: user.username,
      password: user.password,
      phone: normalizeStaffPhoneNumber(user.phone || ''),
      email: user.email || '',
      role: user.role,
      pinCode: user.pinCode || '1234',
      shiftTiming: formatShiftRange(parsedShiftTimes.start, parsedShiftTimes.end),
      isActive: user.isActive
    });
    setShowAddModal(true);
  };

  const handleSaveUser = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.username.trim()
    ) {
      showToast(
        'Name and User ID / Username are required!',
        'warning',
        'Validation'
      );
      return;
    }

    if (
      formData.phone &&
      !/^\d{10}$/.test(formData.phone)
    ) {
      showToast(
        'Phone number must contain exactly 10 digits.',
        'warning',
        'Validation'
      );
      return;
    }

    if (
      formData.email &&
      !isValidEmail(formData.email)
    ) {
      showToast(
        'Enter a valid email address.',
        'warning',
        'Validation'
      );
      return;
    }

    const cleanPassword =
      formData.password.trim();

    const isStrongPassword = (p: string) =>
      p.length >= 8 && /[a-zA-Z]/.test(p) && /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p);

    if (
      !editingUser &&
      !isStrongPassword(cleanPassword)
    ) {
      showToast(
        'Password must be at least 8 characters and contain at least one letter and one number or symbol!',
        'warning',
        'Validation'
      );
      return;
    }

    if (
      editingUser &&
      cleanPassword &&
      !isStrongPassword(cleanPassword)
    ) {
      showToast(
        'Password must be at least 8 characters and contain at least one letter and one number or symbol!',
        'warning',
        'Validation'
      );
      return;
    }

    try {
      if (editingUser) {
        const updates = {
          ...formData
        } as Partial<PharmacyUser>;

        // Blank password means keep the existing password.
        if (!cleanPassword) {
          delete updates.password;
        } else {
          updates.password =
            cleanPassword;
        }

        await updateUser(
          editingUser.id,
          updates
        );
      } else {
        await addUser({
          ...formData,
          password: cleanPassword
        });
      }

      // Close only after PostgreSQL confirms success.
      setShowAddModal(false);
      setEditingUser(null);
      showToast(
        editingUser
          ? `Staff user ${formData.name} updated successfully.`
          : `Staff user ${formData.name} created successfully.`,
        'success',
        'Staff Saved'
      );

    } catch (error) {
      console.error(
        editingUser
          ? 'Failed to update staff user:'
          : 'Failed to create staff user:',
        error
      );

      showToast(
        error instanceof Error
          ? error.message
          : editingUser
            ? 'Failed to update staff user.'
            : 'Failed to create staff user.',
        'error',
        'Staff Error'
      );
    }
  };

  const handleShiftTimeChange = (field: 'start' | 'end', value: string) => {
    const nextShiftTimes = { ...shiftTimes, [field]: value };
    setShiftTimes(nextShiftTimes);
    if (nextShiftTimes.start && nextShiftTimes.end) {
      setFormData(current => ({
        ...current,
        shiftTiming: formatShiftRange(nextShiftTimes.start, nextShiftTimes.end)
      }));
    }
  };

  const handleOpenPasswordReset = (user: PharmacyUser) => {
    if (!isAdmin) {
      showToast('Access Denied: Only Admin is authorized to change staff passwords!', 'error', 'Permission Denied');
      return;
    }
    setPasswordResetUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordFeedback(null);
  };

  const handleSavePasswordReset = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!passwordResetUser) return;

    if (!isAdmin) {
      setPasswordFeedback({
        type: 'error',
        text:
          'Only Admin can change passwords!'
      });
      return;
    }

    if (
      newPassword.length < 8 ||
      !/[a-zA-Z]/.test(newPassword) ||
      !/[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)
    ) {
      setPasswordFeedback({
        type: 'error',
        text:
          'Password must be at least 8 characters and contain at least one letter and one number or symbol!'
      });
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setPasswordFeedback({
        type: 'error',
        text:
          'Passwords do not match!'
      });
      return;
    }

    const res =
      await changeStaffPassword(
        passwordResetUser.id,
        newPassword
      );

    if (res.success) {
      setPasswordFeedback({
        type: 'success',
        text:
          `Password for ${passwordResetUser.name} has been changed successfully!`
      });

      setTimeout(() => {
        setPasswordResetUser(null);
        setPasswordFeedback(null);
      }, 1200);

    } else {
      setPasswordFeedback({
        type: 'error',
        text: res.message
      });
    }
  };

  const handleSwitchUser = (targetUser: PharmacyUser) => {
    if (!currentUser || targetUser.id === currentUser.id) return;
    if (!targetUser.isActive) {
      showToast('This staff account is deactivated!', 'warning', 'Account Deactivated');
      return;
    }

    // A local PIN must never change the displayed user while retaining the
    // previous user's JWT. End the privileged session and require the target
    // staff member to authenticate normally so UI identity and backend identity
    // always match.
    showToast(
      `Admin session ended. Sign in as ${targetUser.name} with that user's password.`,
      'info',
      'Secure User Switch'
    );
    logout();
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 max-w-xl mx-auto shadow-sm my-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">Admin Authorization Required</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Staff roles have access to Sales POS and Entry of Bills. Only Admin accounts can access Staff Management and change staff passwords.
          </p>
        </div>
        <div className="pt-2 text-xs font-semibold text-slate-500">
          Current logged in account: <strong>{currentUser?.name || 'Staff'}</strong> ({currentUser?.role || 'Staff'})
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
            Staff &amp; Role Management
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 sm:text-sm">
            Manage pharmacy staff accounts, assign roles (Admin with full access, Staff with sales and bill entry), and reset staff passwords.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:border-teal-800 hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add New User / Staff</span>
          </button>
        </div>
      </div>

      {/* Active Shift / User Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50/80 p-4 sm:px-5">
        <div className="flex items-center gap-3.5">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-extrabold ${
            currentUser?.role === 'Admin' ? 'bg-teal-700 text-white' : 'bg-teal-100 text-teal-800'
          }`}>
            {currentUser?.name ? currentUser.name.charAt(0) : 'A'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{currentUser?.name}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-teal-800 ring-1 ring-teal-100">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                Active Session
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Role: <strong>{currentUser?.role}</strong> · User ID: <span className="font-mono">{currentUser?.username}</span> · Shift: {currentUser?.shiftTiming || 'Proprietor'}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-100">
          <ShieldCheck className="h-4 w-4" />
          <span>Admin authorization active · Full system control</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <span className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600">
          <strong className="text-slate-900">{users.length}</strong> users
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600">
          <strong className="text-teal-800">{users.filter(user => user.isActive).length}</strong> active
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600">
          <strong className="text-slate-600">{users.filter(user => !user.isActive).length}</strong> inactive
        </span>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {users.map(u => {
          const roleInfo = ROLE_INFO[u.role] || ROLE_INFO['Staff'];
          const isCurrent = currentUser?.id === u.id;

          return (
            <div
              key={u.id}
              className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all ${
                isCurrent
                  ? 'border-teal-600'
                  : 'border-slate-200 hover:border-teal-200 hover:shadow-md'
              } ${u.isActive ? '' : 'opacity-75'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-extrabold ${
                  u.role === 'Admin' ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-800'
                }`}>
                  {u.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-900">{u.name}</h3>
                  <span className="font-mono text-xs text-slate-500">@{u.username}</span>
                </div>
                <span className={`ml-auto inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  u.isActive ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div>
                <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
                  u.role === 'Admin' ? 'bg-slate-900 text-white' : 'bg-teal-50 text-teal-800'
                }`}>
                  {roleInfo.title}
                </span>
              </div>

              <p className="text-xs leading-relaxed text-slate-500">{roleInfo.desc}</p>

              <div className="mt-auto grid gap-2 border-t border-slate-100 pt-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Password</span>
                  <span className="font-mono font-medium text-slate-800">Set · ••••••••</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Phone</span>
                  <span className="text-right font-semibold text-slate-800">
                    {u.phone ? normalizeStaffPhoneNumber(u.phone) : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Shift</span>
                  <span className="text-right font-semibold text-slate-800">{u.shiftTiming || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Account active</span>
                  <span className={`font-semibold ${u.isActive ? 'text-teal-800' : 'text-slate-500'}`}>
                    {u.isActive ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => handleOpenPasswordReset(u)}
                  className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 transition-colors hover:border-amber-300 hover:bg-amber-100 cursor-pointer"
                  title="Only Admin can change password for staff"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <KeyRound className="h-3.5 w-3.5" />
                    Change Password (Admin Only)
                  </span>
                </button>
                <div className="flex gap-2">
                  {!isCurrent && (
                    <button
                      onClick={() => handleSwitchUser(u)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-600 hover:text-teal-800 cursor-pointer"
                    >
                      Switch Shift
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-600 hover:text-teal-800 cursor-pointer"
                    title="Edit Staff Details"
                  >
                    Edit details
                  </button>
                  {users.length > 1 && u.id !== currentUser?.id && (
                    <button
                      onClick={async () => {
                        const confirmed = await confirmDialog({
                          title: `Delete Staff User`,
                          message: `Are you sure you want to remove the staff user account for "${u.name}" (@${u.username})?`,
                          confirmLabel: 'Delete Account',
                          cancelLabel: 'Keep Account',
                          type: 'danger',
                        });
                        if (confirmed) {
                          await deleteUser(u.id);
                          showToast(`Staff account for ${u.name} removed.`, 'info', 'Account Deleted');
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-50 cursor-pointer"
                      title="Delete User"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Permission Hierarchy Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h3 className="text-base font-extrabold text-slate-900">Role Permissions &amp; Access Hierarchy</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Staff are limited to sales and billing. Admin has full control.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-5 py-3.5 text-left">Role</th>
                <th className="border-b border-slate-200 px-3 py-3.5 text-center">POS &amp; 13% VAT Bill</th>
                <th className="border-b border-slate-200 px-3 py-3.5 text-center">Sales Register &amp; Reprint</th>
                <th className="border-b border-slate-200 px-3 py-3.5 text-center">Medicine Inventory</th>
                <th className="border-b border-slate-200 px-3 py-3.5 text-center">Physical Stock Count</th>
                <th className="border-b border-slate-200 px-3 py-3.5 text-center">Wholesaler Invoices &amp; Ledger</th>
                <th className="border-b border-slate-200 px-3 py-3.5 text-center">Add / Deduct Racks</th>
                <th className="border-b border-slate-200 px-5 py-3.5 text-center">Change Staff Passwords</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/70">
                <td className="px-5 py-3.5 text-left">
                  <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 font-bold text-teal-800">Staff</span>
                </td>
                <td className="px-3 py-3.5 text-center"><span className="inline-grid h-6 w-6 place-items-center rounded-full bg-teal-50 font-bold text-teal-800" aria-label="Allowed">✓</span></td>
                <td className="px-3 py-3.5 text-center"><span className="inline-grid h-6 w-6 place-items-center rounded-full bg-teal-50 font-bold text-teal-800" aria-label="Allowed">✓</span></td>
                <td className="px-3 py-3.5 text-center text-slate-400" aria-label="Not allowed">–</td>
                <td className="px-3 py-3.5 text-center text-slate-400" aria-label="Not allowed">–</td>
                <td className="px-3 py-3.5 text-center text-slate-400" aria-label="Not allowed">–</td>
                <td className="px-3 py-3.5 text-center text-slate-400" aria-label="Not allowed">–</td>
                <td className="px-5 py-3.5 text-center font-semibold text-rose-700">Denied</td>
              </tr>
              <tr className="hover:bg-slate-50/70">
                <td className="px-5 py-3.5 text-left">
                  <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 font-bold text-white">Admin</span>
                </td>
                <td className="px-3 py-3.5 text-center"><span className="inline-grid h-6 w-6 place-items-center rounded-full bg-teal-50 font-bold text-teal-800" aria-label="Allowed">✓</span></td>
                <td className="px-3 py-3.5 text-center"><span className="inline-grid h-6 w-6 place-items-center rounded-full bg-teal-50 font-bold text-teal-800" aria-label="Allowed">✓</span></td>
                <td className="px-3 py-3.5 text-center"><span className="inline-grid h-6 w-6 place-items-center rounded-full bg-teal-50 font-bold text-teal-800" aria-label="Allowed">✓</span></td>
                <td className="px-3 py-3.5 text-center"><span className="inline-grid h-6 w-6 place-items-center rounded-full bg-teal-50 font-bold text-teal-800" aria-label="Allowed">✓</span></td>
                <td className="px-3 py-3.5 text-center"><span className="inline-grid h-6 w-6 place-items-center rounded-full bg-teal-50 font-bold text-teal-800" aria-label="Allowed">✓</span></td>
                <td className="px-3 py-3.5 text-center"><span className="inline-grid h-6 w-6 place-items-center rounded-full bg-teal-50 font-bold text-teal-800" aria-label="Allowed">✓</span></td>
                <td className="px-5 py-3.5 text-center font-semibold text-teal-800">Authorized</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          <span className="font-bold text-teal-800">✓</span> Allowed <span className="mx-1.5">·</span> <span className="text-slate-400">–</span> Not allowed
        </div>
      </div>

      {/* Admin Change Staff Password Modal */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <form 
            onSubmit={handleSavePasswordReset}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Change Staff Password (Admin Only)</h3>
                  <p className="text-xs text-slate-300">
                    Updating password for: <strong>{passwordResetUser.name}</strong> (@{passwordResetUser.username})
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setPasswordResetUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {passwordFeedback && (
                <div className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {passwordFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{passwordFeedback.text}</span>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900">
                <span>As Administrator, you have exclusive privilege to reset and assign login passwords for all staff members.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password for {passwordResetUser.name}: *
                </label>
                <div className="relative">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    required
                    placeholder="Enter new staff password (min 8 chars, letters & numbers)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-900 pr-10 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password: *
                </label>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new staff password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordResetUser(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Save New Password
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingUser ? 'Edit Staff User Profile' : 'Add New Pharmacy Staff'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Staff Name: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suman Shrestha"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    User ID / Username: *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. suman.staff"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Password: *
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    placeholder={
                      editingUser
                        ? "Leave blank to keep current password"
                        : "Min 8 chars (letters & numbers)"
                    }
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned User Role: *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-hidden"
                >
                  <option value="Staff">Staff (Sales &amp; Bill Entry Access only)</option>
                  <option value="Admin">Admin (Full Master Access to All Operations)</option>
                </select>
                <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 p-2 rounded-lg mt-1.5">
                  {ROLE_INFO[formData.role]?.desc}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone Number:
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    title="Enter exactly 10 digits."
                    placeholder="10-digit number"
                    value={formData.phone}
                    onChange={(e) => setFormData({
                      ...formData,
                      phone: normalizeStaffPhoneNumber(e.target.value).slice(0, 10)
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">Enter 10 digits without the country code.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email:
                  </label>
                  <input
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Shift Timing:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="shift-start-time" className="mb-1 block text-[10px] text-slate-500">Start</label>
                      <input
                        id="shift-start-time"
                        type="time"
                        required
                        value={shiftTimes.start}
                        onChange={(e) => handleShiftTimeChange('start', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2.5 text-slate-900 focus:bg-white focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label htmlFor="shift-end-time" className="mb-1 block text-[10px] text-slate-500">End</label>
                      <input
                        id="shift-end-time"
                        type="time"
                        required
                        value={shiftTimes.end}
                        onChange={(e) => handleShiftTimeChange('end', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2.5 text-slate-900 focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Account Status:</span>
                  <span className="text-[11px] text-slate-500">Enable or disable staff login authorization</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    formData.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {formData.isActive ? 'Active' : 'Disabled'}
                </button>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingUser ? 'Update Staff Profile' : 'Save Staff User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
