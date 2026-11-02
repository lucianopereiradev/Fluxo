import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppLayout } from './AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { RootLayout } from './RootLayout';

const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const PrivacyPage = lazy(() => import('@/features/landing/PrivacyPage'));
const OverviewPage = lazy(() => import('@/features/overview/OverviewPage'));
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
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      {
        path: '/app',
        element: <AppLayout />,
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
