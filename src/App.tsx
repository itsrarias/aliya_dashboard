import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useSessionExpiry from './hooks/useSessionExpiry';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';

import AuthPage      from './pages/Auth';
import AuthConfirm   from './pages/AuthConfirm';
import MainDashboard from './pages/Dashboard';
import TableView     from './pages/TableView';
import SeriesView    from './pages/SeriesView';
import InvestorView  from './pages/InvestorView';
import AliyaGPT      from './pages/AliyaGPT';

import Layout       from './components/Layout';

export default function App() {
  useSessionExpiry();

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Public auth routes */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />

          {/* All protected routes share Layout + navbar */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            {/* Dashboard as “Home” */}
            <Route index element={<MainDashboard />} />

            {/* New pages */}
            <Route path="table"      element={<TableView />} />
            <Route path="series"     element={<SeriesView />} />
            <Route path="investors"  element={<InvestorView />} />
            <Route path="aliyagpt"   element={<AliyaGPT />} />
          </Route>

          {/* Fallback: redirect anything else to “/” */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
