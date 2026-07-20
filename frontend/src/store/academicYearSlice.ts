import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '@/lib/api';

export interface AcademicYear {
  id: number;
  year_name: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'active' | 'completed';
  description?: string | null;
}

interface AcademicYearState {
  activeYear: AcademicYear | null;
  loading: boolean;
  bootstrapped: boolean; // true once the first fetch has completed (success or fail)
  error: string | null;
}

const initialState: AcademicYearState = {
  activeYear:   null,
  loading:      false,
  bootstrapped: false,
  error:        null,
};

export const fetchActiveAcademicYear = createAsyncThunk(
  'academicYear/fetchActive',
  async (_: void, { rejectWithValue }) => {
    try {
      const data = await apiRequest<{ data: AcademicYear }>('/academic-years/active');
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'No active academic year found.');
    }
  }
);

const academicYearSlice = createSlice({
  name: 'academicYear',
  initialState,
  reducers: {
    clearAcademicYear(state) {
      state.activeYear   = null;
      state.bootstrapped = false;
      state.error        = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveAcademicYear.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchActiveAcademicYear.fulfilled, (state, action) => {
        state.loading      = false;
        state.activeYear   = action.payload;
        state.bootstrapped = true;
        state.error        = null;
      })
      .addCase(fetchActiveAcademicYear.rejected, (state, action) => {
        state.loading      = false;
        state.activeYear   = null;
        state.bootstrapped = true;
        state.error        = action.payload as string;
      });
  },
});

export const { clearAcademicYear } = academicYearSlice.actions;
export default academicYearSlice.reducer;
