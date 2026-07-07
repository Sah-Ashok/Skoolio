'use client';

import { Provider } from 'react-redux';
import { store } from './index';
import AuthBootstrap from '@/components/shared/AuthBootstrap';

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthBootstrap />
      {children}
    </Provider>
  );
}
