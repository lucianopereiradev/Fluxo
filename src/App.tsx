import { RouterProvider } from 'react-router';
import '@/i18n';
import { router } from '@/app/router';

export function App() {
  return <RouterProvider router={router} />;
}
