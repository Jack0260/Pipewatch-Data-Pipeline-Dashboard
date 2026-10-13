import type { PipelineWithRisk } from '@/hooks/useDashboardData';

interface Props {
  pipeline: PipelineWithRisk;
  onClose: () => void;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  success: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Success' },
  failed: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Failed' },
  partial_failure: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Partial' },
};

const BAND_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  healthy: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Healthy' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Warning' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: 'Critical' },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = s / 60;
  return `${m.toFixed(1)}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) return <div className="text-xs text-slate-500">No data</div>;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const path = `M ${points.join(' L ')}`;
  const areaPath = `${path} L ${w},${h} L 0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${color.replace('#', '')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function PipelineDetail({ pipeline, onClose }: Props) {
  const bandStyle = BAND_STYLES[pipeline.risk.band] || BAND_STYLES.healthy;
  const runs = pipeline.recentRuns;
  const successRate = pipeline.runCount > 0 ? (pipeline.successCount / pipeline.runCount) * 100 : 0;
  const sloPct = pipeline.slo_target * 100;
  const sloMet = successRate >= sloPct;

  const durationData = runs
    .slice(0, 20)
    .reverse()
    .map((r) => r.duration_ms);
  const costData = runs
    .slice(0, 20)
    .reverse()
    .map((r) => r.cost_usd);

  const failureReasons = runs
    .filter((r) => r.failure_reason)
    .reduce((acc, r) => {
      acc[r.failure_reason!] = (acc[r.failure_reason!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="h-full flex flex-col bg-slate-900/95 border-l border-slate-700/50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-5 py-4 z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {pipeline.category}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${bandStyle.bg} ${bandStyle.text} ${bandStyle.border}`}>
                {bandStyle.label}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-slate-100">{pipeline.name}</h2>
            {pipeline.description && (
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">{pipeline.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 ml-3"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Risk Score Card */}
      <div className="px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke={pipeline.risk.band === 'critical' ? '#ef4444' : pipeline.risk.band === 'warning' ? '#f59e0b' : '#10b981'}
                strokeWidth="6"
                strokeDasharray={`${(pipeline.risk.score / 100) * 213.6} 213.6`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-slate-100">{pipeline.risk.score}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Risk Score
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{pipeline.risk.explanation}</p>
          </div>
        </div>

        {/* Risk factors */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {pipeline.risk.factors.map((f) => (
            <div key={f.label} className="bg-slate-800/50 rounded-lg px-3 py-2">
              <div className="text-xs text-slate-500 mb-0.5">{f.label}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-slate-200">{f.value}</span>
                {f.direction === 'up' && <span className="text-red-400 text-xs">&#9650;</span>}
                {f.direction === 'down' && <span className="text-emerald-400 text-xs">&#9660;</span>}
                {f.direction === 'stable' && <span className="text-slate-500 text-xs">&#9644;</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SLO Gauge */}
      <div className="px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">SLO Compliance</span>
          <span className={`text-xs font-semibold ${sloMet ? 'text-emerald-400' : 'text-red-400'}`}>
            {sloMet ? 'Meeting SLO' : 'Below SLO'}
          </span>
        </div>
        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full rounded-full ${sloMet ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(successRate, 100)}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-cyan-400"
            style={{ left: `${sloPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-slate-400">{successRate.toFixed(1)}% success</span>
          <span className="text-xs text-cyan-400">{sloPct.toFixed(0)}% target</span>
        </div>
      </div>

      {/* Duration Trend */}
      <div className="px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Duration Trend</span>
          <span className="text-xs text-slate-400">avg {formatDuration(pipeline.avgDuration)}</span>
        </div>
        <Sparkline data={durationData} color="#06b6d4" />
      </div>

      {/* Cost Per Run Trend */}
      <div className="px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cost Per Run</span>
          <span className="text-xs text-slate-400">avg ${pipeline.avgCost.toFixed(2)}</span>
        </div>
        <Sparkline data={costData} color="#f59e0b" />
      </div>

      {/* Failure Reasons */}
      {Object.keys(failureReasons).length > 0 && (
        <div className="px-5 py-4 border-b border-slate-700/50">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 block">
            Failure Reasons
          </span>
          <div className="space-y-2">
            {Object.entries(failureReasons)
              .sort(([, a], [, b]) => b - a)
              .map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{reason}</span>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                    {count}x
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Run History */}
      <div className="px-5 py-4 flex-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 block">
          Recent Runs
        </span>
        <div className="space-y-1.5">
          {runs.slice(0, 15).map((run) => {
            const badge = STATUS_BADGE[run.status] || STATUS_BADGE.success;
            return (
              <div
                key={run.id}
                className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-slate-800/50 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  run.status === 'success' ? 'bg-emerald-500' : run.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-slate-500">{formatTime(run.started_at)}</span>
                  </div>
                  {run.failure_reason && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{run.failure_reason}</div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-400">{formatDuration(run.duration_ms)}</div>
                  <div className="text-xs text-slate-500">${run.cost_usd.toFixed(2)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
