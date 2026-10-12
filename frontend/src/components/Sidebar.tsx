import React from 'react';
import {
  ChevronRight,
  LogOut,
  X
} from 'lucide-react';

import { usePharmacy } from '../context/PharmacyContext';
import prakashLogo from '../assets/prakash-logo.png';

export type ActiveTab =
  | 'dashboard'
  | 'inventory'
  | 'physical_audit'
  | 'pos'
  | 'stockists'
  | 'sales_history'
  | 'reports'
  | 'users'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface MenuItem {
  id: ActiveTab;
  label: string;
  shortCode: string;
  badge?: number;
  adminOnly?: boolean;
  tone: string;
  toneActive: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileOpen = false,
  onMobileClose,
}) => {
  const {
    settings,
    currentUser,
    isAdmin,
    medicines,
    logout,
  } = usePharmacy();

  const lowStockCount = medicines.filter(
    (medicine) => medicine.stockPacks <= medicine.reorderLevel
  ).length;

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      shortCode: 'DB',
      adminOnly: true,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      toneActive: 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white border-transparent',
    },
    {
      id: 'pos',
      label: 'POS & VAT Billing',
      shortCode: 'PO',
      tone: 'bg-sky-50 text-sky-700 border-sky-100',
      toneActive: 'bg-gradient-to-br from-sky-500 to-cyan-600 text-white border-transparent',
    },
    {
      id: 'inventory',
      label: 'Inventory & Generics',
      shortCode: 'IN',
      adminOnly: true,
      badge: lowStockCount,
      tone: 'bg-violet-50 text-violet-700 border-violet-100',
      toneActive: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white border-transparent',
    },
    {
      id: 'physical_audit',
      label: 'Physical Stock Count',
      shortCode: 'PS',
      adminOnly: true,
      tone: 'bg-amber-50 text-amber-700 border-amber-100',
      toneActive: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-transparent',
    },
    {
      id: 'stockists',
      label: 'Stockists & Ledger',
      shortCode: 'ST',
      adminOnly: true,
      tone: 'bg-rose-50 text-rose-700 border-rose-100',
      toneActive: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white border-transparent',
    },
    {
      id: 'sales_history',
      label: 'Sales Register & Bills',
      shortCode: 'SR',
      tone: 'bg-slate-100 text-slate-700 border-slate-200',
      toneActive: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white border-transparent',
    },
    {
      id: 'reports',
      label: 'Reports & VAT Tax',
      shortCode: 'RP',
      adminOnly: true,
      tone: 'bg-cyan-50 text-cyan-700 border-cyan-100',
      toneActive: 'bg-gradient-to-br from-cyan-500 to-teal-600 text-white border-transparent',
    },
    {
      id: 'users',
      label: 'Staff & Password Control',
      shortCode: 'SC',
      adminOnly: true,
      tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      toneActive: 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-transparent',
    },
    {
      id: 'settings',
      label: 'Settings & Racks',
      shortCode: 'SE',
      adminOnly: true,
      tone: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
      toneActive: 'bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white border-transparent',
    },
  ];

  const visibleItems = menuItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const handleNavigation = (tab: ActiveTab) => {
    setActiveTab(tab);

    if (onMobileClose) {
      onMobileClose();
    }
  };

  const handleLogout = () => {
    const confirmed = window.confirm(
      `Sign out of ${settings.storeName || 'Prakash Pharmacy'}?`
    );

    if (confirmed) {
      logout();
    }
  };

  const firstLetter =
    currentUser?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-white">

      {/* HEADER */}
      <div className="flex h-[82px] shrink-0 items-center justify-between border-b border-slate-100 px-4">
        <button
          type="button"
          onClick={() =>
            handleNavigation(isAdmin ? 'dashboard' : 'pos')
          }
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <img
            src={prakashLogo}
            alt="Prakash Pharmacy logo"
            className="h-11 w-11 shrink-0 rounded-2xl object-contain bg-white p-1 shadow-[0_8px_20px_rgba(16,185,129,0.12)]"
          />

          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-extrabold tracking-tight text-slate-900">
              {settings.storeName || 'Prakash Pharmacy'}
            </h1>

            <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
              Pharmacy Management
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close sidebar"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* SCROLLABLE MENU */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
          Main Menu
        </p>

        <nav className="space-y-1.5">
          {visibleItems.map((item) => {
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigation(item.id)}
                className={`
                  group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200
                  ${
                    active
                      ? 'bg-gradient-to-r from-teal-50 to-emerald-50 text-slate-900 shadow-[0_4px_16px_rgba(15,23,42,0.04)]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                {active && (
                  <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-teal-600" />
                )}

                <div
                  className={`
                    flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[11px] font-black tracking-wide shadow-sm transition
                    ${active ? item.toneActive : item.tone}
                  `}
                >
                  {item.shortCode}
                </div>

                <span
                  className={`
                    min-w-0 flex-1 text-[12px] leading-[1.25rem]
                    ${active ? 'font-bold' : 'font-semibold'}
                  `}
                >
                  {item.label}
                </span>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className="min-w-[22px] rounded-full bg-amber-100 px-1.5 py-0.5 text-center text-[9px] font-extrabold text-amber-700">
                    {item.badge}
                  </span>
                )}

                <ChevronRight
                  className={`
                    h-3.5 w-3.5 shrink-0 transition-all
                    ${
                      active
                        ? 'text-teal-600 opacity-100'
                        : 'text-slate-300 opacity-0 group-hover:opacity-100'
                    }
                  `}
                />
              </button>
            );
          })}
        </nav>
      </div>

      {/* FIXED BOTTOM */}
      <div className="shrink-0 border-t border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] font-bold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`
                flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm
                ${
                  isAdmin
                    ? 'bg-gradient-to-br from-violet-600 to-purple-700'
                    : 'bg-gradient-to-br from-teal-600 to-emerald-700'
                }
              `}
            >
              {firstLetter}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-extrabold text-slate-900">
                {currentUser?.name || 'User'}
              </p>

              <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">
                @{currentUser?.username}
              </p>

              <span
                className={`
                  mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide
                  ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }
                `}
              >
                {isAdmin ? 'Admin' : 'Staff'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-full min-h-0 w-[255px] shrink-0 border-r border-slate-200 bg-white shadow-[5px_0_25px_rgba(15,23,42,0.025)] lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed bottom-0 left-0 top-[32px] z-50 w-[280px] border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 lg:hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
