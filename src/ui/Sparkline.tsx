import { useId } from 'react';

/**
 * Lightweight SVG line for small previews (the full charts use ECharts, loaded lazily).
 * The area under zero is tinted so negative stretches stand out without relying on color
 * alone: a dashed zero line marks the threshold.
 */
export function Sparkline({
  values,
  label,
  height = 64,
}: {
  values: number[];
  label: string;
  height?: number;
}) {
  const id = useId();
  if (values.length < 2) return null;
  const width = 300;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 4 - ((v - min) / span) * (height - 8);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const zero = y(0);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="h-16 w-full overflow-visible"
    >
      <defs>
        <clipPath id={`${id}-below`}>
          <rect x="0" y={zero} width={width} height={height - zero} />
        </clipPath>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--c-accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--c-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${zero} ${points} ${width},${zero}`} fill={`url(#${id}-fill)`} />
      <polygon
        points={`0,${zero} ${points} ${width},${zero}`}
        fill="var(--c-negative)"
        fillOpacity="0.25"
        clipPath={`url(#${id}-below)`}
      />
      {min < 0 && (
        <line
          x1="0"
          x2={width}
          y1={zero}
          y2={zero}
          stroke="var(--c-negative)"
          strokeDasharray="4 4"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke="var(--c-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
