'use client';

import { Provider } from 'react-redux';
import { store } from './index';
import AuthBootstrap from '@/components/shared/AuthBootstrap';
import AcademicYearBootstrap from '@/components/shared/AcademicYearBootstrap';

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthBootstrap />
      <AcademicYearBootstrap />
      {children}
    </Provider>
  );
}
