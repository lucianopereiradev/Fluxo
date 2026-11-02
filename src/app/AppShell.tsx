import { FinanceProvider } from '@/features/data/FinanceProvider';
import { AppLayout } from './AppLayout';

/** Everything under /app: the data layer (Dexie, IndexedDB) loads only here, not on the landing page. */
export default function AppShell() {
  return (
    <FinanceProvider>
      <AppLayout />
    </FinanceProvider>
  );
}
