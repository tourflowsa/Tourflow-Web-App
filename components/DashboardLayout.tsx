import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { NotificationBell } from './NotificationBell';
import { 
  LayoutDashboard, 
  Map, 
  CalendarDays, 
  FileCheck, 
  Truck, 
  LogOut, 
  CreditCard, 
  Landmark,
  Users,
  UserCheck,
  Settings,
  Percent,
  Activity,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  FileText,
  UserCircle,
  Search,
  Star,
  Link as LinkIcon,
  Menu,
  X
} from 'lucide-react';
import { NavLink, Navigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole } from '../types';
import { getPendingRequestsCount, getPendingRequestsCountForGuide, getPendingRequestsCountForDriver, getPendingRequestsCountForVehicleOwner } from '../lib/bookingService';
import { getPendingAssignmentsCount } from '../lib/assignmentService';
import { getActiveDisputeCount, getRequestedWithdrawalCount } from '../lib/adminPayoutService';
import { getPendingDocumentsCountAdmin } from '../lib/documentService';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_CONFIG: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Overview', path: '/admin', icon: <LayoutDashboard size={20} /> },
    { label: 'Bookings', path: '/admin/bookings', icon: <CalendarDays size={20} /> },
    { label: 'User Directory', path: '/admin/users', icon: <Users size={20} /> },
    { label: 'User Verification', path: '/admin/verification', icon: <UserCheck size={20} /> },
    { label: 'Document Reviews', path: '/admin/reviews', icon: <FileText size={20} /> },
    { label: 'Provider Reviews', path: '/admin/provider-reviews', icon: <Star size={20} /> },
    { label: 'Requirements', path: '/admin/requirements', icon: <ShieldCheck size={20} /> },
    { label: 'Payouts', path: '/admin/payouts', icon: <CreditCard size={20} /> },
    { label: 'Disputes', path: '/admin/payouts/disputes', icon: <ShieldAlert size={20} /> },
    { label: 'Reconciliation', path: '/admin/payouts/reconciliation', icon: <ShieldCheck size={20} /> },
    { label: 'Fees', path: '/admin/fees', icon: <Percent size={20} /> },
    { label: 'Finance Settings', path: '/admin/finance', icon: <Landmark size={20} /> },
    { label: 'System Audit', path: '/admin/audit', icon: <FileCheck size={20} /> },
    { label: 'Diagnostics', path: '/admin/diagnostics', icon: <Activity size={20} /> },
  ],
  operator: [
    { label: 'Overview', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Tours', path: '/operator/tours', icon: <Map size={20} /> },
    { label: 'Bookings', path: '/operator/bookings', icon: <CalendarDays size={20} /> },
    { label: 'Trip & Vehicle Requests', path: '/operator/vehicle-requests', icon: <CalendarDays size={20} /> },
    { label: 'Directory', path: '/operator/directory', icon: <Search size={20} /> },
    { label: 'Documents', path: '/operator/documents', icon: <FileCheck size={20} /> },
    { label: 'Financials', path: '/operator/financials', icon: <TrendingUp size={20} /> },
    { label: 'Fleet', path: '/operator/vehicles', icon: <Truck size={20} /> },
    { label: 'Payouts', path: '/operator/payouts', icon: <CreditCard size={20} /> },
    { label: 'Profile', path: '/profile', icon: <UserCircle size={20} /> },
  ],
  guide: [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Assignments', path: '/guide/assignments', icon: <CalendarDays size={20} /> },
    { label: 'Trip Requests', path: '/guide/requests', icon: <CalendarDays size={20} /> },
    { label: 'Documents', path: '/guide/documents', icon: <FileCheck size={20} /> },
    { label: 'Earnings', path: '/guide/earnings', icon: <CreditCard size={20} /> },
    { label: 'Profile', path: '/profile', icon: <UserCircle size={20} /> },
  ],
  driver: [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Assignments', path: '/driver/assignments', icon: <CalendarDays size={20} /> },
    { label: 'Trip Requests', path: '/driver/requests', icon: <CalendarDays size={20} /> },
    { label: 'Documents', path: '/driver/documents', icon: <FileCheck size={20} /> },
    { label: 'Earnings', path: '/driver/earnings', icon: <CreditCard size={20} /> },
    { label: 'Profile', path: '/profile', icon: <UserCircle size={20} /> },
  ],
  vehicle_owner: [
    { label: 'Dashboard', path: '/owner', icon: <LayoutDashboard size={20} /> },
    { label: 'My Vehicles', path: '/owner/vehicles', icon: <Truck size={20} /> },
    { label: 'Link Requests', path: '/owner/link-requests', icon: <LinkIcon size={20} /> },
    { label: 'Vehicle Requests', path: '/owner/vehicle-requests', icon: <CalendarDays size={20} /> },
    { label: 'Documents', path: '/owner/documents', icon: <FileCheck size={20} /> },
    { label: 'Earnings', path: '/owner/earnings', icon: <CreditCard size={20} /> },
    { label: 'Maintenance', path: '/owner/maintenance', icon: <Settings size={20} /> },
    { label: 'Profile', path: '/profile', icon: <UserCircle size={20} /> },
  ]
};

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, signOut, loading, profileReady, sessionReady } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAssignmentsCount, setPendingAssignmentsCount] = useState(0);
  const [disputeCount, setDisputeCount] = useState(0);
  const [pendingDocsCount, setPendingDocsCount] = useState(0);
  const [requestedWithdrawalsCount, setRequestedWithdrawalsCount] = useState(0);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchCount = async () => {
    if (!profile) return;
    
    try {
      let count = 0;
      let assignmentsCount = 0;
      let dCount = 0;
      let pdCount = 0;
      let rwCount = 0;
      let pvCount = 0;

      if (profile.role === 'admin') {
        const [dispute, docs, withdrawals, verification] = await Promise.all([
          getActiveDisputeCount(),
          getPendingDocumentsCountAdmin(),
          getRequestedWithdrawalCount(),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending')
        ]);
        dCount = dispute;
        pdCount = docs;
        rwCount = withdrawals;
        pvCount = verification.count || 0;
      } else if (profile.role === 'operator') {
        count = await getPendingRequestsCount(profile.id);
      } else if (profile.role === 'guide') {
        count = await getPendingRequestsCountForGuide(profile.id);
        assignmentsCount = await getPendingAssignmentsCount(profile.id, 'guide');
      } else if (profile.role === 'driver') {
        count = await getPendingRequestsCountForDriver(profile.id);
        assignmentsCount = await getPendingAssignmentsCount(profile.id, 'driver');
      } else if (profile.role === 'vehicle_owner') {
        count = await getPendingRequestsCountForVehicleOwner(profile.id);
      }

      setPendingCount(count);
      setPendingAssignmentsCount(assignmentsCount);
      setDisputeCount(dCount);
      setPendingDocsCount(pdCount);
      setRequestedWithdrawalsCount(rwCount);
      setPendingVerificationCount(pvCount);
    } catch (err) {
      console.error('Failed to fetch pending requests count:', err);
    }
  };

  useEffect(() => {
    fetchCount();
  }, [profile, location.pathname]);

  useEffect(() => {
    const handleUpdate = () => fetchCount();
    window.addEventListener('PENDING_REQUESTS_UPDATED', handleUpdate);
    window.addEventListener('ASSIGNMENTS_UPDATED', handleUpdate);
    window.addEventListener('DISPUTE_UPDATED', handleUpdate);
    window.addEventListener('DOCUMENTS_UPDATED', handleUpdate);
    window.addEventListener('PAYOUTS_UPDATED', handleUpdate);
    return () => {
      window.removeEventListener('PENDING_REQUESTS_UPDATED', handleUpdate);
      window.removeEventListener('ASSIGNMENTS_UPDATED', handleUpdate);
      window.removeEventListener('DISPUTE_UPDATED', handleUpdate);
      window.removeEventListener('DOCUMENTS_UPDATED', handleUpdate);
      window.removeEventListener('PAYOUTS_UPDATED', handleUpdate);
    };
  }, [profile]);

  const isBootstrapInProgress = loading || !sessionReady || !profileReady || (profile && !profile.role);

  if (isBootstrapInProgress) return <div className="min-h-screen flex items-center justify-center bg-brand-white font-bold">Loading Platform...</div>;
  if (!profile) return <Navigate to="/login" replace />;

  const navItems = NAV_CONFIG[profile.role] || [];

  const SidebarContent = (isMobile = false) => (
    <>
      <div className="p-6 border-b border-gray-700 flex items-center justify-between">
        <Link to="/" className="block group" onClick={() => isMobile && setIsMobileMenuOpen(false)}>
          <div className="flex items-center mb-1">
             <img src="/tourflow-logo-reversed.png" alt="TourFlow" className="h-10 w-auto" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 uppercase tracking-widest">
              {profile.role.replace('_', ' ')}
            </span>
            {!isMobile && (
              <span className="text-[10px] text-brand-teal opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                View Website →
              </span>
            )}
          </div>
        </Link>
        {isMobile && (
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/dashboard" || item.path === "/owner" || item.path === "/admin" || item.path === "/admin/payouts"}
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
              isActive 
                ? 'bg-brand-teal text-white shadow-lg shadow-brand-teal/20 translate-x-1' 
                : 'text-gray-300 hover:bg-gray-700 hover:text-white hover:translate-x-1'
            }`}
          >
            {item.icon}
            <span className="font-medium text-sm">
              {item.label}
              {(item.label === 'Requests' || item.label === 'Trip Requests' || item.label === 'Vehicle Requests') && pendingCount > 0 && ` (${pendingCount})`}
              {item.label === 'Assignments' && pendingAssignmentsCount > 0 && ` (${pendingAssignmentsCount})`}
              {item.label === 'Disputes' && disputeCount > 0 && <span className="ml-2 bg-brand-coral text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{disputeCount}</span>}
              {item.label === 'Document Reviews' && pendingDocsCount > 0 && <span className="ml-2 bg-brand-teal text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingDocsCount}</span>}
              {item.label === 'User Verification' && pendingVerificationCount > 0 && <span className="ml-2 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingVerificationCount}</span>}
              {item.label === 'Payouts' && requestedWithdrawalsCount > 0 && <span className="ml-2 bg-brand-teal text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{requestedWithdrawalsCount}</span>}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-brand-teal flex items-center justify-center text-xs font-bold shadow-inner overflow-hidden">
            {profile.avatar_url || profile.profile_image_url ? (
              <img src={(profile.avatar_url || profile.profile_image_url) ?? undefined} alt={profile.full_name || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              profile.email.substring(0,2).toUpperCase()
            )}
          </div>
          <div className="overflow-hidden">
             <p className="text-sm font-bold truncate text-white">{profile.full_name || 'My Account'}</p>
             <p className="text-[10px] text-gray-400 truncate uppercase tracking-tighter">{profile.verification_status}</p>
          </div>
        </div>
        <button 
          onClick={() => {
            if (isMobile) setIsMobileMenuOpen(false);
            signOut();
          }}
          className="w-full flex items-center gap-2 text-gray-400 hover:text-brand-coral px-4 py-2 text-sm transition-colors font-bold"
        >
          <LogOut size={16} />
          Sign Out
        </button>
        <div className="px-4 py-2">
          <Link to="/contact" className="text-gray-400 hover:text-brand-teal text-xs font-bold transition-colors">Support / Need help?</Link>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-brand-white flex flex-col lg:flex-row">
      {/* Mobile Top Bar */}
      <header className="lg:hidden h-16 bg-brand-charcoal text-white flex items-center justify-between px-4 sticky top-0 z-30">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={24} />
        </button>
        <img src="/tourflow-logo-reversed.png" alt="TourFlow" className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          <NotificationBell />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-brand-charcoal text-white flex-col fixed h-full z-20">
        {SidebarContent(false)}
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-brand-charcoal text-white flex flex-col z-50 lg:hidden shadow-2xl"
            >
              {SidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 lg:ml-64 bg-gray-50 min-h-screen flex flex-col">
        <header className="hidden lg:flex h-16 bg-white border-b border-gray-200 items-center justify-end px-8 sticky top-0 z-10">
          <NotificationBell />
        </header>
        <div className="p-4 md:p-8 flex-1 w-full max-w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};
