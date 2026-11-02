import { lazy, Suspense, type ComponentProps } from 'react';
import { Skeleton } from '@/ui/primitives';

const EChart = lazy(() => import('./EChart'));

/** Charts load ECharts on demand, the first time one is rendered. */
export function Chart(props: ComponentProps<typeof EChart>) {
  return (
    <Suspense fallback={<Skeleton className="w-full" />}>
      <EChart {...props} />
    </Suspense>
  );
}

export type { ChartTheme } from './EChart';
