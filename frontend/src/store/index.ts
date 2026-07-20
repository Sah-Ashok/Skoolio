import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import toastReducer from './toastSlice';
import academicYearReducer from './academicYearSlice';

export const store = configureStore({
  reducer: {
    auth:         authReducer,
    toast:        toastReducer,
    academicYear: academicYearReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
