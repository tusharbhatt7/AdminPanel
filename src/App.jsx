import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { auth } from './firebase';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './lib/useAuth';
import { PERMISSIONS } from './lib/roles';

// Layout & guards
import Layout from './components/Layout';
import RequirePermission from './components/RequirePermission';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RideManagement from './pages/RideManagement';
import Payments from './pages/Payments';
import Reviews from './pages/Reviews';
import UserManagement from './pages/UserManagement';
import AuditLogs from './pages/AuditLogs';
import { Complaints, Promotions, Fleet, Zones, Notifications } from './pages/modules';
import DriverManagement from './pages/DriverManagement';
import CustomerManagement from './pages/CustomerManagement';
import SafetyCompliance from './pages/SafetyCompliance';
import BusinessAnalytics from './pages/BusinessAnalytics';
import Advertisements from './pages/Advertisements';
import Settings from './pages/Settings';

const Spinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-canvas">
    <div className="w-10 h-10 border-2 rounded-full border-line border-t-brand animate-spin" />
  </div>
);

/**
 * Signed in AND carrying an active role record. Firebase Auth accepting the
 * password is not by itself authorisation — a deactivated account or one with
 * no role never reaches the panel.
 */
const PrivateRoute = ({ children }) => {
  const { hasAccess, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!hasAccess) return <Navigate to="/login" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { hasAccess, loading } = useAuth();
  if (loading) return null;
  if (hasAccess) return <Navigate to="/dashboard" replace />;
  return children;
};

function MissingConfig() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-canvas">
      <div className="max-w-xl p-8 border rounded-xl bg-surface border-danger/40">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 text-2xl font-bold rounded-full bg-danger-soft text-danger">!</div>
        <h1 className="mb-2 text-xl font-bold text-fg">Missing Firebase connection</h1>
        <p className="mb-6 leading-relaxed text-fg-2">
          The application cannot reach Firebase. The <strong className="text-fg">environment variables</strong> are
          not configured for this deployment.
        </p>
        <div className="p-4 mb-6 overflow-auto font-mono text-sm text-left border rounded-lg bg-raised border-line text-fg-2">
          VITE_FIREBASE_API_KEY<br />VITE_FIREBASE_AUTH_DOMAIN<br />VITE_FIREBASE_DATABASE_URL<br />
          VITE_FIREBASE_PROJECT_ID<br />VITE_FIREBASE_STORAGE_BUCKET<br />VITE_FIREBASE_MESSAGING_SENDER_ID<br />
          VITE_FIREBASE_APP_ID<br />VITE_FIREBASE_MEASUREMENT_ID
        </div>
        <p className="p-3 text-sm border rounded-lg border-warn/30 bg-warn-soft text-fg-2">
          <strong className="text-fg">Note:</strong> after saving these in Vercel you must redeploy for them to apply.
        </p>
      </div>
    </div>
  );
}

function App() {
  if (!auth) return <MissingConfig />;

  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="rides" element={<RideManagement />} />
            <Route path="drivers" element={<DriverManagement />} />
            <Route path="customers" element={<CustomerManagement />} />
            <Route path="payments" element={<Payments />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="promotions" element={<Promotions />} />
            <Route path="advertisements" element={<Advertisements />} />
            <Route path="fleet" element={<Fleet />} />
            <Route path="zones" element={<Zones />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="safety" element={<SafetyCompliance />} />
            <Route path="analytics" element={<BusinessAnalytics />} />
            <Route path="settings" element={<Settings />} />

            {/* Administration */}
            <Route path="users" element={
              <RequirePermission permission={PERMISSIONS.USERS_READ}><UserManagement /></RequirePermission>
            } />
            <Route path="audit" element={
              <RequirePermission permission={PERMISSIONS.AUDIT_READ}><AuditLogs /></RequirePermission>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
