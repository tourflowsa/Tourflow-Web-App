import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './components/DashboardLayout';
import { PublicLayout } from './components/PublicLayout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Home } from './pages/public/Home';
import { HowItWorks } from './pages/public/HowItWorks';
import { ForOperators } from './pages/public/ForOperators';
import { ForProviders } from './pages/public/ForProviders';
import { Pricing } from './pages/public/Pricing';
import { ConflictResolution } from './pages/public/ConflictResolution';
import { About } from './pages/public/About';
import { Contact } from './pages/public/Contact';
import { PrivacyPolicy } from './pages/public/PrivacyPolicy';
import { TermsOfService } from './pages/public/TermsOfService';
import { FAQ } from './pages/public/FAQ';
import { AdminDashboard } from './pages/dashboards/AdminDashboard';
import { OperatorDashboard } from './pages/dashboards/OperatorDashboard';
import { GuideDashboard } from './pages/dashboards/GuideDashboard';
import { VehicleOwnerDashboard } from './pages/dashboards/VehicleOwnerDashboard';
import { DriverDashboard } from './pages/dashboards/DriverDashboard';
import { UserVerification } from './pages/admin/UserVerification';
import { UserDetail } from './pages/admin/UserDetail';
import { AdminPayoutsList } from './pages/admin/AdminPayoutsList';
import { AdminPayoutDetail } from './pages/admin/AdminPayoutDetail';
import { AdminPayoutBatchDetail } from './pages/admin/AdminPayoutBatchDetail';
import { AdminReconciliationPage } from './pages/admin/AdminReconciliationPage';
import { PayoutDisputesPage } from './pages/admin/PayoutDisputesPage';
import { FeeManagement } from './pages/admin/FeeManagement';
import { SystemAudit } from './pages/admin/SystemAudit';
import { Diagnostics } from './pages/admin/Diagnostics';
import { ComplianceRequirementsView } from './pages/admin/ComplianceRequirementsView';
import { DocumentReviews } from './pages/admin/DocumentReviews';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage';
import { AdminBookingsList } from './pages/admin/AdminBookingsList';
import { AdminBookingDetail } from './pages/admin/AdminBookingDetail';
import { FinanceSettingsPage } from './pages/admin/FinanceSettingsPage';
import { AdminUserDirectory } from './pages/admin/AdminUserDirectory';
import { ToursList } from './pages/operator/ToursList';
import { TourForm } from './pages/operator/TourForm';
import { TourDetail } from './pages/operator/TourDetail';
import { BookingsList as OperatorBookingsList } from './pages/operator/BookingsList';
import { BookingForm } from './pages/operator/BookingForm';
import { BookingDetail } from './pages/operator/BookingDetail';
import { ProviderDirectory } from './pages/operator/ProviderDirectory';
import { ProviderProfilePage } from './pages/operator/ProviderProfilePage';
import { DocumentsChecklist } from './pages/shared/DocumentsChecklist';
import { FleetList } from './pages/operator/FleetList';
import { VehicleFormPage } from './pages/operator/VehicleFormPage';
import { VehicleDetailPage } from './pages/operator/VehicleDetailPage';
import { ProviderReviewsPage } from './pages/operator/ProviderReviewsPage';
import { OperatorPayoutsPage } from './pages/operator/PayoutsPage';
import { FinancialDashboard } from './pages/operator/FinancialDashboard';
import { PayoutDetail } from './pages/operator/PayoutDetail';
import { AdminPayoutsPage } from './pages/admin/PayoutsPage';
import { ProviderEarningsPage } from './pages/shared/ProviderEarningsPage';
import { AssignmentsList as DriverAssignmentsList } from './pages/driver/AssignmentsList';
import { AssignmentDetail as DriverAssignmentDetail } from './pages/driver/AssignmentDetail';
import { DriverRequestsPage } from './pages/driver/DriverRequestsPage';
import { GuideRequestsPage } from './pages/guide/GuideRequestsPage';
import { AssignmentsList as GuideAssignmentsList } from './pages/guide/AssignmentsList';
import { AssignmentDetail as GuideAssignmentDetail } from './pages/guide/AssignmentDetail';
import { EditProfile } from './pages/shared/EditProfile';
import { getRoleDashboardPath } from './lib/routerUtils';
import { UserRole } from './types';
import { OwnerBookingsList } from './pages/owner/BookingList';
import { LinkRequestsPage } from './pages/owner/LinkRequestsPage';
import { VehicleRequestsPage } from './pages/owner/VehicleRequestsPage';
import { MyRequestsPage } from './pages/operator/MyRequestsPage';

const FullPageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-brand-white">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-brand-teal" />
      <p className="text-brand-charcoal font-medium animate-pulse">Loading secure session...</p>
    </div>
  </div>
);

const DashboardRouter: React.FC = () => {
  const { profile, loading, profileReady, sessionReady } = useAuth();
  const location = useLocation();
  const role = profile?.role;

  const isBootstrapInProgress = loading || !sessionReady || !profileReady || (profile && !role);

  if (isBootstrapInProgress) {
    return <FullPageLoader />;
  }

  if (!profile) {
    return <Navigate to="/login" />;
  }

  if (!role) {
    return <div>Unknown Role</div>;
  }

  switch (role) {
    case 'admin': return <AdminDashboard />;
    case 'operator': return <OperatorDashboard />;
    case 'guide': return <GuideDashboard />;
    case 'vehicle_owner': return <VehicleOwnerDashboard />;
    case 'driver': return <DriverDashboard />;
    default: return <div>Unknown Role</div>;
  }
};

const ProtectedRoute: React.FC<{ children: React.ReactNode, allowedRoles?: UserRole[] }> = ({ children, allowedRoles }) => {
  const { profile, loading, profileReady, sessionReady } = useAuth();
  const location = useLocation();
  const role = profile?.role;

  // 1. Loading Guard (Priority A)
  const isBootstrapInProgress = loading || !sessionReady || !profileReady || (profile && !role);

  if (isBootstrapInProgress) {
    return <FullPageLoader />;
  }

  // 2. Authentication Guard (Priority B)
  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // 3. Authorization Guard (Priority C)
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center">
        <div className="p-8 bg-red-50 border border-red-200 rounded-2xl max-w-md">
          <h2 className="text-2xl font-bold text-red-800 mb-4">Access Denied</h2>
          <p className="text-red-600 font-medium mb-6">You do not have permission to view this page.</p>
          <button 
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const RootRedirect: React.FC = () => {
  const { profile, loading, profileReady, sessionReady } = useAuth();
  const role = profile?.role;
  
  const isBootstrapInProgress = loading || !sessionReady || !profileReady || (profile && !role);

  if (isBootstrapInProgress) {
    return <FullPageLoader />;
  }

  if (profile && role) {
    const destination = getRoleDashboardPath(role);
    return <Navigate to={destination} replace />;
  }

  return <PublicLayout><Home /></PublicLayout>;
};

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/how-it-works" element={<PublicLayout><HowItWorks /></PublicLayout>} />
          <Route path="/for-operators" element={<PublicLayout><ForOperators /></PublicLayout>} />
          <Route path="/for-providers" element={<PublicLayout><ForProviders /></PublicLayout>} />
          <Route path="/pricing" element={<PublicLayout><Pricing /></PublicLayout>} />
          <Route path="/conflict-resolution" element={<PublicLayout><ConflictResolution /></PublicLayout>} />
          <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
          <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
          <Route path="/privacy-policy" element={<PublicLayout><PrivacyPolicy /></PublicLayout>} />
          <Route path="/terms-of-service" element={<PublicLayout><TermsOfService /></PublicLayout>} />
          <Route path="/faq" element={<PublicLayout><FAQ /></PublicLayout>} />
          
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/dashboard" element={<DashboardLayout><DashboardRouter /></DashboardLayout>} />
          
          {/* Shared Routes */}
          <Route path="/profile" element={<ProtectedRoute><DashboardLayout><EditProfile /></DashboardLayout></ProtectedRoute>} />
          <Route path="/diagnostics" element={<ProtectedRoute><DashboardLayout><Diagnostics /></DashboardLayout></ProtectedRoute>} />
          <Route path="/provider/earnings" element={<ProtectedRoute allowedRoles={['driver', 'guide', 'vehicle_owner']}><DashboardLayout><ProviderEarningsPage /></DashboardLayout></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><AdminDashboard /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><AdminBookingsList /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/bookings/:id" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><AdminBookingDetail /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><AdminUserDirectory /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/verification" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><UserVerification /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/verification/:id" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><UserDetail /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/reviews" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><DocumentReviews /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/provider-reviews" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><AdminReviewsPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/requirements" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><ComplianceRequirementsView /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/payouts" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><AdminPayoutsPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/payouts/disputes" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><PayoutDisputesPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/payouts/:id" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><AdminPayoutDetail /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/payouts/reconciliation" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><AdminReconciliationPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/payouts/batch/:batchId" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><AdminPayoutBatchDetail /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/fees" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><FeeManagement /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><SystemAudit /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/finance" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><FinanceSettingsPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/diagnostics" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout><Diagnostics /></DashboardLayout></ProtectedRoute>} />
          
          {/* Operator & Asset Provider (Vehicle Owner) Routes */}
          <Route path="/operator/tours" element={<ProtectedRoute allowedRoles={['operator', 'admin']}><DashboardLayout><ToursList /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/tours/new" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><TourForm /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/tours/:id" element={<ProtectedRoute allowedRoles={['operator', 'admin']}><DashboardLayout><TourDetail /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/tours/:id/edit" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><TourForm /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/bookings" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><OperatorBookingsList /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/bookings/new" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><BookingForm /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/bookings/:id" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><BookingDetail /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/directory" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><ProviderDirectory /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/directory/:id" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><ProviderProfilePage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/directory/provider/:id" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><ProviderProfilePage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/providers/:id" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><ProviderProfilePage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/reviews/provider/:id" element={<ProtectedRoute allowedRoles={['admin', 'operator', 'driver', 'guide', 'vehicle_owner']}><DashboardLayout><ProviderReviewsPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/documents" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><DocumentsChecklist /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/financials" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><FinancialDashboard /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/payouts" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><OperatorPayoutsPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/payouts/:id" element={<ProtectedRoute allowedRoles={['operator']}><DashboardLayout><PayoutDetail /></DashboardLayout></ProtectedRoute>} />

          {/* Unified Fleet Routes */}
          <Route path="/operator/vehicles" element={<ProtectedRoute allowedRoles={['operator', 'vehicle_owner']}><DashboardLayout><FleetList /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/vehicles/new" element={<ProtectedRoute allowedRoles={['operator', 'vehicle_owner']}><DashboardLayout><VehicleFormPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/vehicles/:id" element={<ProtectedRoute allowedRoles={['operator', 'vehicle_owner']}><DashboardLayout><VehicleDetailPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/operator/vehicles/:id/edit" element={<ProtectedRoute allowedRoles={['operator', 'vehicle_owner']}><DashboardLayout><VehicleFormPage /></DashboardLayout></ProtectedRoute>} />

          {/* Guide Routes */}
          <Route path="/guide/assignments" element={<ProtectedRoute allowedRoles={['guide']}><DashboardLayout><GuideAssignmentsList /></DashboardLayout></ProtectedRoute>} />
          <Route path="/guide/assignments/:id" element={<ProtectedRoute allowedRoles={['guide']}><DashboardLayout><GuideAssignmentDetail /></DashboardLayout></ProtectedRoute>} />
          <Route path="/guide/requests" element={<ProtectedRoute allowedRoles={['guide']}><DashboardLayout><GuideRequestsPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/guide/documents" element={<ProtectedRoute allowedRoles={['guide']}><DashboardLayout><DocumentsChecklist /></DashboardLayout></ProtectedRoute>} />
          <Route path="/guide/earnings" element={<ProtectedRoute allowedRoles={['guide']}><DashboardLayout><ProviderEarningsPage /></DashboardLayout></ProtectedRoute>} />

          {/* Vehicle Owner Exclusive Routes */}
          <Route
            path="/owner"
            element={
              <ProtectedRoute allowedRoles={["vehicle_owner"]}>
                <DashboardLayout>
                  <VehicleOwnerDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/bookings"
            element={
              <ProtectedRoute allowedRoles={["vehicle_owner"]}>
                <DashboardLayout>
                  <OwnerBookingsList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/vehicles"
            element={
              <ProtectedRoute allowedRoles={["vehicle_owner"]}>
                <DashboardLayout>
                  <FleetList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/owner/vehicles/new" element={<ProtectedRoute allowedRoles={['vehicle_owner']}><DashboardLayout><VehicleFormPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/owner/vehicles/:id" element={<ProtectedRoute allowedRoles={['vehicle_owner']}><DashboardLayout><VehicleDetailPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/owner/vehicles/:id/edit" element={<ProtectedRoute allowedRoles={['vehicle_owner']}><DashboardLayout><VehicleFormPage /></DashboardLayout></ProtectedRoute>} />
          
          <Route
            path="/owner/link-requests"
            element={
              <ProtectedRoute allowedRoles={["vehicle_owner"]}>
                <DashboardLayout>
                  <LinkRequestsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/vehicle-requests"
            element={
              <ProtectedRoute allowedRoles={["vehicle_owner"]}>
                <DashboardLayout>
                  <VehicleRequestsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/vehicle-requests"
            element={
              <ProtectedRoute allowedRoles={["operator"]}>
                <DashboardLayout>
                  <MyRequestsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route path="/owner/documents" element={<ProtectedRoute allowedRoles={['vehicle_owner']}><DashboardLayout><DocumentsChecklist /></DashboardLayout></ProtectedRoute>} />
          <Route path="/owner/earnings" element={<ProtectedRoute allowedRoles={['vehicle_owner']}><DashboardLayout><ProviderEarningsPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/owner/maintenance" element={<ProtectedRoute allowedRoles={['vehicle_owner']}><DashboardLayout><div className="p-8"><h1 className="text-2xl font-bold">Maintenance Module</h1><p className="mt-4 text-gray-500">Coming Soon: Track your vehicle service history and upcoming maintenance tasks.</p></div></DashboardLayout></ProtectedRoute>} />

          {/* Driver Routes */}
          <Route path="/driver/assignments" element={<ProtectedRoute allowedRoles={['driver']}><DashboardLayout><DriverAssignmentsList /></DashboardLayout></ProtectedRoute>} />
          <Route path="/driver/assignments/:id" element={<ProtectedRoute allowedRoles={['driver']}><DashboardLayout><DriverAssignmentDetail /></DashboardLayout></ProtectedRoute>} />
          <Route path="/driver/requests" element={<ProtectedRoute allowedRoles={['driver']}><DashboardLayout><DriverRequestsPage /></DashboardLayout></ProtectedRoute>} />
          <Route path="/driver/documents" element={<ProtectedRoute allowedRoles={['driver']}><DashboardLayout><DocumentsChecklist /></DashboardLayout></ProtectedRoute>} />
          <Route path="/driver/earnings" element={<ProtectedRoute allowedRoles={['driver']}><DashboardLayout><ProviderEarningsPage /></DashboardLayout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
