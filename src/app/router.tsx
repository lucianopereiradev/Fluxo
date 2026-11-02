import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import { NotFoundPage } from './NotFoundPage';
import LandingPage from '@/features/landing/LandingPage';
import PrivacyPage from '@/features/landing/PrivacyPage';
import { RootLayout } from './RootLayout';
import { RouteError } from './RouteError';

// Public pages ship in the main bundle; the app itself loads on demand.
const loadAppShell = () => import('./AppShell');
const loadOverview = () => import('@/features/overview/OverviewPage');
const AppShell = lazy(loadAppShell);

// Opening the app directly: fetch the shell and the first screen in parallel, not one after the other.
if (typeof location !== 'undefined' && location.pathname.startsWith('/app')) {
  void loadAppShell();
  if (location.pathname === '/app' || location.pathname === '/app/') void loadOverview();
}

const OverviewPage = lazy(loadOverview);
const TransactionsPage = lazy(() => import('@/features/transactions/TransactionsPage'));
const AccountsPage = lazy(() => import('@/features/accounts/AccountsPage'));
const CardsPage = lazy(() => import('@/features/cards/CardsPage'));
const BudgetsPage = lazy(() => import('@/features/budgets/BudgetsPage'));
const GoalsPage = lazy(() => import('@/features/goals/GoalsPage'));
const RecurringPage = lazy(() => import('@/features/recurring/RecurringPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const ImportPage = lazy(() => import('@/features/import/ImportPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      {
        path: '/app',
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'transactions', element: <TransactionsPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'cards', element: <CardsPage /> },
          { path: 'budgets', element: <BudgetsPage /> },
          { path: 'goals', element: <GoalsPage /> },
          { path: 'recurring', element: <RecurringPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'import', element: <ImportPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage inApp /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
