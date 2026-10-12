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
import { PharmacyUser, UserRole } from '../types/pharmacy';

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

export const UserManagementView: React.FC = () => {
  const { 
    users, 
    currentUser, 
    setCurrentUser, 
    addUser, 
    updateUser, 
    deleteUser, 
    isAdmin, 
    changeStaffPassword 
  } = usePharmacy();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<PharmacyUser | null>(null);

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
    pinCode: '2233',
    shiftTiming: 'Morning Shift (7:00 AM - 3:00 PM)',
    isActive: true
  });

  // Password reset modal state (Admin only)
  const [passwordResetUser, setPasswordResetUser] = useState<PharmacyUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Switch User PIN modal state
  const [switchPinInput, setSwitchPinInput] = useState<{ userId: string; pin: string } | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      username: '',
      password: 'staff123',
      phone: '',
      email: '',
      role: 'Staff',
      pinCode: `${Math.floor(1000 + Math.random() * 9000)}`,
      shiftTiming: 'Morning Shift (7:00 AM - 3:00 PM)',
      isActive: true
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: PharmacyUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      password: user.password,
      phone: user.phone || '',
      email: user.email || '',
      role: user.role,
      pinCode: user.pinCode || '1234',
      shiftTiming: user.shiftTiming || 'Day Shift',
      isActive: user.isActive
    });
    setShowAddModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.username.trim()) {
      alert('Name and User ID / Username are required!');
      return;
    }

    if (!formData.password.trim() || formData.password.length < 4) {
      alert('Password must be at least 4 characters long!');
      return;
    }

    if (editingUser) {
      updateUser(editingUser.id, formData);
    } else {
      addUser(formData);
    }

    setShowAddModal(false);
    setEditingUser(null);
  };

  const handleOpenPasswordReset = (user: PharmacyUser) => {
    if (!isAdmin) {
      alert('Access Denied: Only Admin is authorized to change staff passwords!');
      return;
    }
    setPasswordResetUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordFeedback(null);
  };

  const handleSavePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser) return;

    if (!isAdmin) {
      setPasswordFeedback({ type: 'error', text: 'Only Admin can change passwords!' });
      return;
    }

    if (newPassword.length < 4) {
      setPasswordFeedback({ type: 'error', text: 'Password must be at least 4 characters long!' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', text: 'Passwords do not match!' });
      return;
    }

    const res = changeStaffPassword(passwordResetUser.id, newPassword);
    if (res.success) {
      setPasswordFeedback({ type: 'success', text: `Password for ${passwordResetUser.name} has been changed successfully!` });
      setTimeout(() => {
        setPasswordResetUser(null);
        setPasswordFeedback(null);
      }, 1200);
    } else {
      setPasswordFeedback({ type: 'error', text: res.message });
    }
  };

  const handleSwitchUser = (targetUser: PharmacyUser) => {
    if (!currentUser) return;
    if (targetUser.id === currentUser.id) return;
    if (!targetUser.isActive) {
      alert('This staff account is deactivated!');
      return;
    }

    if (targetUser.pinCode) {
      setSwitchPinInput({ userId: targetUser.id, pin: '' });
      setPinError(null);
    } else {
      setCurrentUser(targetUser);
    }
  };

  const handleVerifySwitchPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchPinInput) return;

    const target = users.find(u => u.id === switchPinInput.userId);
    if (!target) return;

    if (target.pinCode && switchPinInput.pin !== target.pinCode) {
      setPinError('Incorrect 4-digit PIN! Please try again.');
      return;
    }

    setCurrentUser(target);
    setSwitchPinInput(null);
    setPinError(null);
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
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Staff &amp; Role Management (Admin Control)
              </h2>
              <p className="text-xs text-slate-500">
                Manage pharmacy staff accounts, assign roles (Admin with full access vs. Staff with sales &amp; bill entry), and reset staff passwords
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Add New User / Staff</span>
          </button>
        </div>
      </div>

      {/* Active Shift / User Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-4 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center font-bold text-base text-teal-300">
            {currentUser?.name ? currentUser.name.charAt(0) : 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">{currentUser?.name}</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Active Session
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Role: <strong>{currentUser?.role}</strong> • User ID: <span className="font-mono">{currentUser?.username}</span> • Shift: {currentUser?.shiftTiming || 'Proprietor'}
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-300 flex items-center gap-2 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Admin Authorization Active • Full System Control</span>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => {
          const roleInfo = ROLE_INFO[u.role] || ROLE_INFO['Staff'];
          const isCurrent = currentUser?.id === u.id;

          return (
            <div 
              key={u.id}
              className={`bg-white p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                isCurrent
                  ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      u.role === 'Admin' ? 'bg-purple-100 text-purple-900 border border-purple-200' : 'bg-teal-100 text-teal-900 border border-teal-200'
                    }`}>
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Currently logged in"></span>
                        )}
                      </h4>
                      <span className="text-xs text-slate-500 font-mono font-semibold">User ID: @{u.username}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    u.isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Role Pill */}
                <div>
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${roleInfo.badgeColor}`}>
                    {roleInfo.title}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    {roleInfo.desc}
                  </p>
                </div>

                {/* Contact info & Credentials status */}
                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Password:</span>
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                      ••••••••
                    </span>
                  </div>

                  {u.phone && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{u.phone}</span>
                    </div>
                  )}

                  {u.shiftTiming && (
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{u.shiftTiming}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                {/* Admin Password Reset Button */}
                <button
                  type="button"
                  onClick={() => handleOpenPasswordReset(u)}
                  className="w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Only Admin can change password for staff"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>Change Password (Admin Only)</span>
                </button>

                <div className="flex items-center justify-between gap-1.5">
                  {isCurrent ? (
                    <span className="text-xs font-bold text-teal-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      <span>Active User</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSwitchUser(u)}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Switch Shift
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Edit Staff Details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {users.length > 1 && u.id !== currentUser?.id && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove staff user account for ${u.name}?`)) {
                            deleteUser(u.id);
                          }
                        }}
                        className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Permission Hierarchy Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>Role Permissions &amp; Access Hierarchy</span>
          </h3>
          <p className="text-xs text-slate-500">
            Clear role distinction: Staff is limited to sales and billing entry; Admin has full control
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-3 text-center">POS &amp; 13% VAT Bill</th>
                <th className="py-2.5 px-3 text-center">Sales Register &amp; Reprint</th>
                <th className="py-2.5 px-3 text-center">Medicine Inventory</th>
                <th className="py-2.5 px-3 text-center">Physical Stock Count</th>
                <th className="py-2.5 px-3 text-center">Wholesaler Invoices &amp; Ledger</th>
                <th className="py-2.5 px-3 text-center">Add/Deduce Racks</th>
                <th className="py-2.5 px-4 text-center">Change Staff Passwords</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 px-4 font-bold text-emerald-800">Staff</td>
                <td className="py-3 px-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="py-3 px-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="py-3 px-3 text-center text-slate-300">—</td>
                <td className="py-3 px-3 text-center text-slate-300">—</td>
                <td className="py-3 px-3 text-center text-slate-300">—</td>
                <td className="py-3 px-3 text-center text-slate-300">—</td>
                <td className="py-3 px-4 text-center text-rose-500 font-semibold">Denied</td>
              </tr>
              <tr className="bg-purple-50/30">
                <td className="py-3 px-4 font-bold text-purple-900">Admin</td>
                <td className="py-3 px-3 text-center"><Check className="w-4 h-4 text-purple-600 mx-auto" /></td>
                <td className="py-3 px-3 text-center"><Check className="w-4 h-4 text-purple-600 mx-auto" /></td>
                <td className="py-3 px-3 text-center"><Check className="w-4 h-4 text-purple-600 mx-auto" /></td>
                <td className="py-3 px-3 text-center"><Check className="w-4 h-4 text-purple-600 mx-auto" /></td>
                <td className="py-3 px-3 text-center"><Check className="w-4 h-4 text-purple-600 mx-auto" /></td>
                <td className="py-3 px-3 text-center"><Check className="w-4 h-4 text-purple-600 mx-auto" /></td>
                <td className="py-3 px-4 text-center text-purple-700 font-bold">Authorized</td>
              </tr>
            </tbody>
          </table>
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
                    placeholder="Enter new staff password (min 4 chars)"
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
                    required
                    placeholder="Min 4 chars"
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
                    type="text"
                    placeholder="e.g. +977-9845112233"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Shift Timing:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 7:00 AM - 3:00 PM"
                    value={formData.shiftTiming}
                    onChange={(e) => setFormData({ ...formData, shiftTiming: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:outline-hidden"
                  />
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

      {/* Switch User PIN Modal */}
      {switchPinInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form 
            onSubmit={handleVerifySwitchPin}
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-800 mx-auto flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">
                Confirm Shift Switch
              </h3>
              <p className="text-xs text-slate-500">
                Enter PIN for {users.find(u => u.id === switchPinInput.userId)?.name}
              </p>
            </div>

            <div>
              <input
                type="password"
                autoFocus
                maxLength={4}
                value={switchPinInput.pin}
                onChange={(e) => setSwitchPinInput({ ...switchPinInput, pin: e.target.value })}
                placeholder="••••"
                className="w-full text-center text-2xl tracking-widest font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
              {pinError && (
                <p className="text-xs text-rose-600 text-center mt-1 font-semibold">
                  {pinError}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSwitchPinInput(null)}
                className="flex-1 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Switch Cashier
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
