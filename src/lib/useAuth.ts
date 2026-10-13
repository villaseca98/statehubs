import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authChanged = false;
    supabase.auth.getSession().then(({ data, error: failure }) => {
      if (!active || authChanged) return;
      setUser(data.session?.user ?? null);
      setError(failure?.message ?? null);
      setLoading(false);
    }).catch((failure: unknown) => {
      if (!active || authChanged) return;
      setError(failure instanceof Error ? failure.message : 'Authentication unavailable');
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      authChanged = true;
      setUser(session?.user ?? null); setLoading(false); setError(null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return { user, loading, error };
}
