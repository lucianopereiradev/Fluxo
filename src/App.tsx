import { RouterProvider } from 'react-router';
import '@/i18n';
import { router } from '@/app/router';
import { FinanceProvider } from '@/features/data/FinanceProvider';

export function App() {
  return (
    <FinanceProvider>
      <RouterProvider router={router} />
    </FinanceProvider>
  );
}
