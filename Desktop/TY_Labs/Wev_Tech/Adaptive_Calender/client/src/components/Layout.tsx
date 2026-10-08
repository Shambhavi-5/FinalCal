import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: '/calendar', icon: '📅', label: 'Today' },
  { to: '/checkin', icon: '⚡', label: 'Check-in' },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-600/20 text-indigo-400'
        : 'text-slate-400 hover:text-white hover:bg-slate-800'
    }`;

  const sidebar = (
    <nav
      className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-64"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-800">
        <span className="text-xl font-bold text-indigo-400">⚡ EnergyCal</span>
      </div>

      {/* Nav links */}
      <div className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-slate-800 flex flex-col gap-2">
        {user && (
          <div className="text-sm">
            <p className="text-white font-medium truncate">{user.name}</p>
            <p className="text-slate-500 text-xs truncate">{user.email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="text-slate-400 hover:text-red-400 text-sm text-left transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-shrink-0 md:fixed md:inset-y-0 z-30">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute inset-y-0 left-0 w-64"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      )}

      {/* Mobile hamburger */}
      <button
        type="button"
        className="absolute top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation menu"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64">
        {children}
      </main>
    </div>
  );
}
