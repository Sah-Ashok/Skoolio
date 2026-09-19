import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiRequest } from '@/lib/api';

export type SchoolRole  = 'super_admin' | 'admin';
export type UserRole    = 'faculty' | 'student' | 'finance';
export type AllRoles    = SchoolRole | UserRole;
export type LoginRole   = 'admin' | 'faculty' | 'student' | 'finance';

export interface AuthUser {
  id:               number;
  email:            string;
  role:             AllRoles;
  full_name?:       string;
  school_name:      string;
  school_code?:     string;
  logo?:            string;
  timezone:         string;
  is_verified?:     boolean;
  is_account:       'active' | 'blocked';
  two_fa_enabled?:  boolean;
  school_id?:       number;
  photo?:           string;
  admission_number?: string;
  // P5 fix: country is returned by /auth/me for admin schools — used for pricing currency
  country?:         string;
  // Date system used by this school: 'AD' = Gregorian (default), 'BS' = Bikram Sambat
  calendar_system?: 'AD' | 'BS';
  // ISO 4217 currency code returned by /auth/me — used by useCurrency to resolve the symbol
  currency?:        string;
}

interface AuthState {
  user:            AuthUser | null;
  isAuthenticated: boolean;
  loading:         boolean;
  bootstrapped:    boolean;
  error:           string | null;
  // 2FA pending state
  twofaPending:    boolean;
  twofaSession:    string | null;
}

const initialState: AuthState = {
  user:            null,
  isAuthenticated: false,
  loading:         false,
  bootstrapped:    false,
  error:           null,
  twofaPending:    false,
  twofaSession:    null,
};

export function getRoleRedirect(role: AllRoles): string {
  switch (role) {
    case 'super_admin': return '/super-admin/dashboard';
    case 'admin':       return '/dashboard';
    case 'faculty':     return '/teacher/dashboard';
    case 'student':     return '/student/dashboard';
    case 'finance':     return '/finance/dashboard';
    default:            return '/dashboard';
  }
}

const loginEndpoints: Record<LoginRole, string> = {
  admin:   '/auth/login',
  faculty: '/auth/login/teacher',
  student: '/auth/login/student',
  finance: '/auth/login/finance',
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (
    credentials: { email: string; password: string; loginRole?: LoginRole },
    { rejectWithValue }
  ) => {
    try {
      const endpoint = loginEndpoints[credentials.loginRole || 'admin'];
      const data = await apiRequest<{ data: any }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      });

      if (data.data?.requires_2fa) {
        return { requires_2fa: true, twofa_session: data.data.twofa_session };
      }

      const account = data.data.school || data.data.user;
      if (!account) throw new Error('Unexpected response from server');
      return account;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Login failed.');
    }
  }
);

export const verify2FAThunk = createAsyncThunk(
  'auth/verify2FA',
  async (
    payload: { twofa_session: string; otp_code: string },
    { rejectWithValue }
  ) => {
    try {
      const data = await apiRequest<{ data: { school: AuthUser } }>('/auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return data.data.school;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Verification failed.');
    }
  }
);

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (payload: Record<string, any>, { rejectWithValue }) => {
    try {
      const data = await apiRequest<{ data: AuthUser }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Registration failed.');
    }
  }
);

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_: void, { rejectWithValue }) => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      return true;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Logout failed.');
    }
  }
);

export const meThunk = createAsyncThunk(
  'auth/me',
  async (_: void, { rejectWithValue }) => {
    try {
      const data = await apiRequest<{ data: AuthUser }>('/auth/me');
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Not authenticated.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user            = null;
      state.isAuthenticated = false;
      state.error           = null;
      state.twofaPending    = false;
      state.twofaSession    = null;
    },
    clearError(state) {
      state.error = null;
    },
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user            = action.payload;
      state.isAuthenticated = true;
    },
    clearTwofa(state) {
      state.twofaPending = false;
      state.twofaSession = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        if ((action.payload as any)?.requires_2fa) {
          state.twofaPending = true;
          state.twofaSession = (action.payload as any).twofa_session;
        } else {
          state.user            = action.payload as AuthUser;
          state.isAuthenticated = true;
          state.twofaPending    = false;
          state.twofaSession    = null;
        }
      })
      .addCase(loginThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; });

    builder
      .addCase(verify2FAThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(verify2FAThunk.fulfilled, (state, action) => {
        state.loading = false; state.user = action.payload; state.isAuthenticated = true;
        state.twofaPending = false; state.twofaSession = null;
      })
      .addCase(verify2FAThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; });

    builder
      .addCase(registerThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerThunk.fulfilled, (state, action) => { state.loading = false; state.user = action.payload; state.isAuthenticated = true; })
      .addCase(registerThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; });

    builder
      .addCase(logoutThunk.fulfilled, (state) => { state.user = null; state.isAuthenticated = false; state.error = null; state.twofaPending = false; state.twofaSession = null; })
      .addCase(logoutThunk.rejected,  (state) => { state.user = null; state.isAuthenticated = false; state.error = null; });

    builder
      .addCase(meThunk.fulfilled, (state, action) => { state.user = action.payload; state.isAuthenticated = true; state.bootstrapped = true; })
      .addCase(meThunk.rejected,  (state) => { state.user = null; state.isAuthenticated = false; state.bootstrapped = true; });
  },
});

export const { logout, clearError, setUser, clearTwofa } = authSlice.actions;
export default authSlice.reducer;
