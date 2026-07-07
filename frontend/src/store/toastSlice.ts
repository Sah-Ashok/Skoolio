import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  show: boolean;
  type: ToastType;
  title: string;
  message?: string;
}

const initialState: ToastState = {
  show: false,
  type: 'info',
  title: '',
  message: undefined,
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    showToast(state, action: PayloadAction<Omit<ToastState, 'show'>>) {
      state.show = true;
      state.type = action.payload.type;
      state.title = action.payload.title;
      state.message = action.payload.message;
    },
    hideToast(state) {
      state.show = false;
    },
  },
});

export const { showToast, hideToast } = toastSlice.actions;
export default toastSlice.reducer;
