import { BarChart, LineChart, SankeyChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { useEffect, useRef } from 'react';
import { resolveTheme, useUi } from '@/stores/ui';

// Only the pieces Fluxo uses are registered, keeping this lazily loaded chunk small.
echarts.use([
  BarChart,
  LineChart,
  SankeyChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  SVGRenderer,
]);

export interface ChartTheme {
  text: string;
  muted: string;
  faint: string;
  border: string;
  surface: string;
  accent: string;
  positive: string;
  negative: string;
  warning: string;
  series: string[];
}

function readTheme(): ChartTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    text: v('--c-text'),
    muted: v('--c-text-muted'),
    faint: v('--c-text-faint'),
    border: v('--c-border'),
    surface: v('--c-surface'),
    accent: v('--c-accent'),
    positive: v('--c-positive'),
    negative: v('--c-negative'),
    warning: v('--c-warning'),
    series: [1, 2, 3, 4, 5, 6].map((i) => v(`--c-chart-${i}`)),
  };
}

/**
 * ECharts wrapper. `build` receives the current theme colors, so charts follow light/dark
 * mode. Every chart also gets an accessible label; data tables next to charts carry the
 * actual numbers for screen readers.
 */
export default function EChart({
  build,
  label,
  height = 320,
}: {
  build: (theme: ChartTheme) => EChartsCoreOption;
  label: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const themePref = useUi((s) => s.theme);
  const resolved = resolveTheme(themePref);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'svg' });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    chartRef.current?.setOption(
      {
        animation: !reduced,
        textStyle: { fontFamily: 'Geist Variable, ui-sans-serif, system-ui' },
        ...build(readTheme()),
      },
      { notMerge: true },
    );
  }, [build, resolved]);

  return <div ref={ref} role="img" aria-label={label} style={{ height }} className="w-full" />;
}
