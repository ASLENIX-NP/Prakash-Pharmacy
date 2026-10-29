import React, { useState } from 'react';
import {
  Stethoscope,
  Building2,
  Layers,
  ClipboardCheck,
  ShoppingCart,
  Truck,
  FileText,
  BarChart3,
  Settings,
  ShieldCheck,
  Phone,
  MapPin,
  FileSpreadsheet,
  Users,
  LogOut,
  Lock,
  UserCheck
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

export type ActiveTab =
  | 'dashboard'
  | 'inventory'
  | 'physical_audit'
  | 'pos'
  | 'stockists'
  | 'sales_history'
  | 'reports'
  | 'users'
  | 'settings'
  | 'clinic';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const {
    settings,
    medicines,
    currentUser,
    isAdmin,
    logout
  } = usePharmacy();

  const lowStockCount = medicines.filter(
    m => m.stockPacks <= m.reorderLevel
  ).length;

  const nearExpiryCount = medicines.filter(m => {
    const exp = new Date(m.expiryDate).getTime();
    const now = new Date().getTime();
    const diffMonths = (exp - now) / (1000 * 60 * 60 * 24 * 30.4);
    return diffMonths <= 6;
  }).length;

  const handleLogout = () => {
    if (confirm(`Sign out of Prakash Pharmacy (${currentUser?.name})?`)) {
      logout();
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Credentials Bar */}
      <div className="bg-slate-900 text-slate-100 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            DDA Licence No: <span className="font-mono text-white tracking-wider">{settings.ddaLicenceNumber}</span>
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="flex items-center gap-1.5 font-semibold text-amber-400">
            PAN No: <span className="font-mono text-white tracking-wider">{settings.panNumber}</span>
          </span>
          <span className="hidden md:inline text-slate-500">|</span>
          <span className="hidden md:flex items-center gap-1 text-slate-300">
            <MapPin className="w-3 h-3 text-slate-400" />
            {settings.address}
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-300">
          <span className="hidden sm:flex items-center gap-1">
            <Phone className="w-3 h-3 text-slate-400" />
            {settings.phoneNumber}
          </span>
          <span className="hidden lg:inline text-slate-400 font-mono">
            FY: {settings.fiscalYear}
          </span>
          <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-500/30">
            13% VAT &amp; IRD Ready
          </span>
        </div>
      </div>

      {/* Main Brand & Action Header */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
        {settings.storeLogo ? (
          <img
            src={settings.storeLogo}
            alt={`${settings.storeName || 'Pharmacy'} logo`}
            className="h-11 w-11 rounded-xl border border-slate-200 bg-white object-contain shadow-sm"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center text-white shadow-md shadow-teal-700/20">
            <Building2 className="w-6 h-6" />
          </div>
        )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {settings.storeName}
              </h1>
              <span className="bg-teal-50 text-teal-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-teal-200">
                Makwanpur, Nepal
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Hetauda-5, Sanopokhara</span>
              <span>•</span>
              <span className="font-mono text-slate-600">{settings.emailId}</span>
            </p>
          </div>
        </div>

        {/* User Status, Role Badge & Sign Out */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Active Logged-in Staff Info */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              isAdmin ? 'bg-purple-700 text-white' : 'bg-teal-700 text-white'
            }`}>
              {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-900 leading-tight flex items-center gap-1">
                <span>{currentUser?.name}</span>
                <span className="font-mono text-[10px] text-slate-500 font-semibold">(@{currentUser?.username})</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                  isAdmin
                    ? 'bg-purple-100 text-purple-900 border-purple-200'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                }`}>
                  {isAdmin ? 'Admin (Full Access)' : 'Staff (Sales & Billing)'}
                </span>
              </div>
            </div>
          </div>

          {/* Low Stock alert for admin */}
          {isAdmin && lowStockCount > 0 && (
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-amber-100 transition-colors cursor-pointer"
              title="Click to view low stock items in inventory"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Low Stock: <strong>{lowStockCount}</strong></span>
            </button>
          )}

          {/* Near expiry alert for admin */}
          {isAdmin && nearExpiryCount > 0 && (
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-rose-100 transition-colors cursor-pointer"
              title="Click to view near-expiry medicines"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Near Expiry: <strong>{nearExpiryCount}</strong></span>
            </button>
          )}

          {/* Quick Open POS Terminal */}
          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-3.5 py-2 rounded-xl font-semibold text-xs shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>POS Counter</span>
          </button>

          {/* Sign Out / Exit Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-3 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            title="Sign out and return to credentials gateway"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs - Filtered strictly by role */}
      <div className="px-4 flex items-center gap-1 overflow-x-auto border-t border-slate-100 scrollbar-none">
        {isAdmin ? (
          <>
            <NavButton
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
              icon={<BarChart3 className="w-4 h-4" />}
              label="Dashboard"
            />
            <NavButton
              active={activeTab === 'pos'}
              onClick={() => setActiveTab('pos')}
              icon={<ShoppingCart className="w-4 h-4" />}
              label="POS &amp; VAT Billing"
              highlight
            />
            <NavButton
              active={activeTab === 'inventory'}
              onClick={() => setActiveTab('inventory')}
              icon={<Layers className="w-4 h-4" />}
              label="Inventory &amp; Generics"
            />
            <NavButton
              active={activeTab === 'physical_audit'}
              onClick={() => setActiveTab('physical_audit')}
              icon={<ClipboardCheck className="w-4 h-4" />}
              label="Physical Stock Count"
            />
            <NavButton
              active={activeTab === 'stockists'}
              onClick={() => setActiveTab('stockists')}
              icon={<Truck className="w-4 h-4" />}
              label="Stockists &amp; Ledger"
            />
            <NavButton
              active={activeTab === 'clinic'}
              onClick={() => setActiveTab('clinic')}
              icon={<Stethoscope className="w-4 h-4" />}
              label="Clinic / OPD"
            />
            <NavButton
              active={activeTab === 'sales_history'}
              onClick={() => setActiveTab('sales_history')}
              icon={<FileText className="w-4 h-4" />}
              label="Sales Register &amp; Bills"
            />
            <NavButton
              active={activeTab === 'reports'}
              onClick={() => setActiveTab('reports')}
              icon={<FileSpreadsheet className="w-4 h-4" />}
              label="Reports &amp; VAT Tax"
            />
            <NavButton
              active={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
              icon={<Users className="w-4 h-4" />}
              label="Staff &amp; Password Control"
            />
            <NavButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              icon={<Settings className="w-4 h-4" />}
              label="Settings &amp; Racks"
            />
          </>
        ) : (
          /* Staff Role: STRICTLY SALES AND ENTRY OF BILL ACCESS */
          <>
            <NavButton
              active={activeTab === 'pos'}
              onClick={() => setActiveTab('pos')}
              icon={<ShoppingCart className="w-4 h-4" />}
              label="POS &amp; VAT Billing (Sales Counter)"
              highlight
            />
            <NavButton
              active={activeTab === 'clinic'}
              onClick={() => setActiveTab('clinic')}
              icon={<Stethoscope className="w-4 h-4" />}
              label="Clinic / OPD"
            />
            <NavButton
              active={activeTab === 'sales_history'}
              onClick={() => setActiveTab('sales_history')}
              icon={<FileText className="w-4 h-4" />}
              label="Sales Register &amp; Entry of Bills"
            />
            <div className="ml-auto py-2 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Staff Mode: Sales, Bill Entry &amp; OPD Authorized</span>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, highlight }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
        active
          ? 'border-teal-600 text-teal-700 bg-teal-50/50'
          : highlight
          ? 'border-transparent text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/40 font-bold'
          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
