// src/pages/AuthConfirm.tsx
import { useEffect } from 'react';
import { supabase } from '../api/supabase';

export default function AuthConfirm() {
  useEffect(() => {
    // Supabase sets the session in localStorage automatically
    // after the redirect.  Just bounce to the dashboard.
    const timer = setTimeout(() => (window.location.href = '/'), 1000);
    return () => clearTimeout(timer);
  }, []);

  return <p>Confirmation successful. Redirecting…</p>;
}
