import {
  ArrowLeftRight,
  ChartNoAxesColumn,
  CreditCard,
  FileUp,
  Landmark,
  LayoutDashboard,
  PieChart,
  Repeat,
  Settings,
  Target,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  key: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar (the rest live under "More"). */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/app', key: 'overview', icon: LayoutDashboard, primary: true },
  { to: '/app/transactions', key: 'transactions', icon: ArrowLeftRight, primary: true },
  { to: '/app/accounts', key: 'accounts', icon: Landmark },
  { to: '/app/cards', key: 'cards', icon: CreditCard, primary: true },
  { to: '/app/budgets', key: 'budgets', icon: PieChart },
  { to: '/app/goals', key: 'goals', icon: Target },
  { to: '/app/recurring', key: 'recurring', icon: Repeat },
  { to: '/app/reports', key: 'reports', icon: ChartNoAxesColumn },
  { to: '/app/import', key: 'import', icon: FileUp },
  { to: '/app/settings', key: 'settings', icon: Settings },
];
