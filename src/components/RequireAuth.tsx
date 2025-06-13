import React, { JSX } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // or show a spinner
    return <div>Loading…</div>;
  }
  if (!user) {
    // not logged in → send to /auth, preserve where they wanted to go
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  // logged in → render the protected page
  return children;
}
