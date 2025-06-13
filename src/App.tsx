import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useSessionExpiry from './hooks/useSessionExpiry';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import AuthPage from './pages/Auth';
import AuthConfirm from './pages/AuthConfirm';
import MainDashboard from './pages/Dashboard';

export default function App() {
  useSessionExpiry();

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />

          {/* protect all dashboard routes: */}
          <Route
            path="/*"
            element={
              <RequireAuth>
                <MainDashboard />
              </RequireAuth>
            }
          />

          {/* catch-all: redirect unknown routes to dashboard (or login) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
