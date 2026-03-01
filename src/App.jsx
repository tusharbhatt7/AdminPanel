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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
