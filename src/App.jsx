import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Layout & Protected Route Handler
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import DriverManagement from './pages/DriverManagement';
import CustomerManagement from './pages/CustomerManagement';
import SafetyCompliance from './pages/SafetyCompliance';
import BusinessAnalytics from './pages/BusinessAnalytics';
import Advertisements from './pages/Advertisements';
import Settings from './pages/Settings';

// PrivateRoute wrapper
const PrivateRoute = ({ children, currentUser, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 rounded-full border-primary-200 border-t-primary-600 animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route (redirect to drivers if already logged in)
const PublicRoute = ({ children, currentUser, loading }) => {
  if (loading) return null;
  if (currentUser) {
    return <Navigate to="/drivers" replace />;
  }
  return children;
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Show a helpful error screen if Vercel environment variables are missing
  if (!auth && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-xl border border-rose-100">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">!</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Missing Firebase Connection</h1>
          <p className="text-slate-600 mb-6 leading-relaxed">
            The application cannot connect to Firebase. It looks like the <strong className="text-slate-800">Environment Variables</strong> have not been configured in Vercel.
          </p>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-left text-sm font-mono overflow-auto mb-6 text-slate-600">
            Ensure the following keys are set in your Vercel Dashboard:<br /><br />
            - VITE_FIREBASE_API_KEY<br />
            - VITE_FIREBASE_AUTH_DOMAIN<br />
            - VITE_FIREBASE_DATABASE_URL<br />
            - VITE_FIREBASE_PROJECT_ID<br />
            - VITE_FIREBASE_STORAGE_BUCKET<br />
            - VITE_FIREBASE_MESSAGING_SENDER_ID<br />
            - VITE_FIREBASE_APP_ID<br />
            - VITE_FIREBASE_MEASUREMENT_ID
          </div>
          <p className="text-sm border border-amber-200 bg-amber-50 text-amber-800 p-3 rounded-lg">
            <strong>Note:</strong> After saving these keys in Vercel, you <strong>MUST trigger a new redeployment</strong> for changes to take effect!
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>

        {/* Public Login Route */}
        <Route path="/login" element={
          <PublicRoute currentUser={currentUser} loading={loading}>
            <Login />
          </PublicRoute>
        } />

        {/* Protected Dashboard Routes */}
        <Route path="/" element={
          <PrivateRoute currentUser={currentUser} loading={loading}>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/drivers" replace />} />
          <Route path="drivers" element={<DriverManagement />} />
          <Route path="customers" element={<CustomerManagement />} />
          <Route path="safety" element={<SafetyCompliance />} />
          <Route path="analytics" element={<BusinessAnalytics />} />
          <Route path="advertisements" element={<Advertisements />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
