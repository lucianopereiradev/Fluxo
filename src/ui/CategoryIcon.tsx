import {
  ArrowLeftRight,
  Briefcase,
  Car,
  Circle,
  CircleDashed,
  CreditCard,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  PartyPopper,
  PawPrint,
  PiggyBank,
  Plane,
  PlusCircle,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '@/domain/types';
import { cn } from './primitives';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
  'plus-circle': PlusCircle,
  home: Home,
  utensils: Utensils,
  'shopping-basket': ShoppingBasket,
  car: Car,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  'party-popper': PartyPopper,
  'shopping-bag': ShoppingBag,
  repeat: Repeat,
  receipt: Receipt,
  plane: Plane,
  'paw-print': PawPrint,
  sparkles: Sparkles,
  landmark: Landmark,
  'circle-dashed': CircleDashed,
  circle: Circle,
  target: Target,
  'piggy-bank': PiggyBank,
  wallet: Wallet,
  'credit-card': CreditCard,
};

export function CategoryIcon({
  category,
  transfer = false,
  className,
}: {
  category?: Pick<Category, 'icon' | 'color'> | null;
  transfer?: boolean;
  className?: string;
}) {
  const Icon = transfer
    ? ArrowLeftRight
    : (category && CATEGORY_ICONS[category.icon]) || CircleDashed;
  const color = transfer ? 'var(--c-text-muted)' : (category?.color ?? 'var(--c-text-faint)');
  return (
    <span
      aria-hidden
      className={cn('grid size-9 shrink-0 place-items-center rounded-xl', className)}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
    >
      <Icon className="size-[18px]" strokeWidth={1.8} />
    </span>
  );
}
