// src/hooks/useSessionExpiry.ts
import { useEffect } from 'react';
import { supabase } from '../api/supabase';

export default function useSessionExpiry() {
  useEffect(() => {
    const TWO_WEEKS_MS = 1000 * 60 * 60 * 24 * 14;

    // 1) On app load, force logout if >14 days since start
    const start = Number(localStorage.getItem('session-start') ?? 0);
    if (start && Date.now() - start > TWO_WEEKS_MS) {
      supabase.auth.signOut();
      localStorage.removeItem('session-start');
    }

    // 2) Listen for SIGNED_IN to stamp the start time
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        localStorage.setItem('session-start', Date.now().toString());
      }
    });

    // data.subscription is the actual subscription object
    const subscription = data.subscription;

    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
