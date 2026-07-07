'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { meThunk } from '@/store/authSlice';

/**
 * Runs once when the app mounts. Calls /auth/me to check the httpOnly cookie
 * and re-hydrate Redux auth state on every page load / refresh, since Redux
 * state itself does not persist across reloads.
 */
export default function AuthBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(meThunk());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
