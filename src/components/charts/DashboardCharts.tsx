'use client'

/**
 * Dashboard Charts — Recharts-powered visualizations for Angel OS.
 *
 * All charts are client components wrapping recharts.
 * Data is passed as props from server components (page.tsx).
 *
 * Charts:
 *   - RevenueChart: Area chart showing revenue over time
 *   - OrderVolumeChart: Bar chart showing orders per day
 *   - FederationActivityChart: Line chart of federation actions
 *   - SplitDonutChart: Donut/pie showing the 95/5 split
 *   - JusticeFundChart: Area chart of cumulative justice fund growth
 */

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  date: string
  value: number
  label?: string
}

export interface FederationActivityPoint {
  date: string
  heartbeats: number
  skillInvocations: number
  catalogBrowses: number
}

// ── Color Palette (matches existing Tailwind theme) ─────────────────────

const COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  orange: '#f97316',
  rose: '#f43f5e',
  muted: '#6b7280',
  grid: '#e5e7eb',
  gridDark: '#374151',
}

// ── Revenue Trend (Area Chart) ──────────────────────────────────────────

export function RevenueChart({ data }: { data: TimeSeriesPoint[] }) {
  if (data.length === 0) {
    return <ChartEmptyState message="Revenue data will appear after your first sale" />
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Revenue Trend</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
          <YAxis
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            formatter={(value) => [`$${Number(value || 0).toFixed(2)}`, 'Revenue']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={COLORS.emerald}
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Order Volume (Bar Chart) ────────────────────────────────────────────

export function OrderVolumeChart({ data }: { data: TimeSeriesPoint[] }) {
  if (data.length === 0) {
    return <ChartEmptyState message="Order volume will appear after your first order" />
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Order Volume</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
          <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            formatter={(value) => [Number(value || 0), 'Orders']}
          />
          <Bar dataKey="value" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Federation Activity (Multi-Line Chart) ──────────────────────────────

export function FederationActivityChart({ data }: { data: FederationActivityPoint[] }) {
  if (data.length === 0) {
    return <ChartEmptyState message="Federation activity will appear as your network grows" />
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Federation Activity</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
          <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="heartbeats"
            stroke={COLORS.emerald}
            strokeWidth={2}
            dot={false}
            name="Heartbeats"
          />
          <Line
            type="monotone"
            dataKey="skillInvocations"
            stroke={COLORS.purple}
            strokeWidth={2}
            dot={false}
            name="Skill Invocations"
          />
          <Line
            type="monotone"
            dataKey="catalogBrowses"
            stroke={COLORS.blue}
            strokeWidth={2}
            dot={false}
            name="Catalog Browses"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Split Breakdown (Donut Chart) ───────────────────────────────────────

const SPLIT_DATA = [
  { name: 'You (95%)', value: 95, color: COLORS.emerald },
  { name: 'Platform (5%)', value: 5, color: COLORS.blue },
]

export function SplitDonutChart() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">How payments split</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={SPLIT_DATA}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${(name || '').split(' (')[0]} ${((percent || 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {SPLIT_DATA.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            formatter={(value) => [`${Number(value || 0)}%`, 'Share']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
        {SPLIT_DATA.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Justice Fund Growth (Area Chart) ────────────────────────────────────

export function JusticeFundChart({ data }: { data: TimeSeriesPoint[] }) {
  if (data.length === 0) {
    return <ChartEmptyState message="Justice Fund allocations will appear after your first transaction" />
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Justice Fund Growth</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="justiceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.amber} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.amber} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
          <YAxis
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            formatter={(value) => [`$${Number(value || 0).toFixed(2)}`, 'Cumulative']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={COLORS.amber}
            strokeWidth={2}
            fill="url(#justiceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-6">
      <div className="text-center">
        <svg
          className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
