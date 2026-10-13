import type { PipelineWithRisk } from '@/hooks/useDashboardData';

interface Props {
  pipelines: PipelineWithRisk[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}

function Gauge({ value, target, size }: { value: number; target: number; size: number }) {
  const radius = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  // Semicircle gauge: use 180 degrees
  const arcFraction = 0.5;
  const arcLength = circumference * arcFraction;
  const fillFraction = Math.min(value / 100, 1);
  const fillLength = arcLength * fillFraction;

  const color = value >= target ? '#10b981' : value >= target * 0.95 ? '#f59e0b' : '#ef4444';

  return (
    <svg viewBox={`0 0 ${size} ${size / 2 + 6}`} className="w-full">
      {/* Background arc */}
      <path
        d={`M ${8} ${cy} A ${radius} ${radius} 0 0 1 ${size - 8} ${cy}`}
        fill="none"
        stroke="#1e293b"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Fill arc */}
      <path
        d={`M ${8} ${cy} A ${radius} ${radius} 0 0 1 ${size - 8} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${fillLength} ${arcLength}`}
      />
      {/* Target marker */}
      {(() => {
        const angle = Math.PI - (target / 100) * Math.PI;
        const x1 = cx + Math.cos(angle) * (radius - 6);
        const y1 = cy - Math.sin(angle) * (radius - 6);
        const x2 = cx + Math.cos(angle) * (radius + 6);
        const y2 = cy - Math.sin(angle) * (radius + 6);
        return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#06b6d4" strokeWidth="2" />;
      })()}
      {/* Value text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#e2e8f0" fontSize="16" fontWeight="700">
        {value.toFixed(1)}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="9">
        target {target.toFixed(0)}%
      </text>
    </svg>
  );
}

export function SloGaugePanel({ pipelines, onSelect, selectedId }: Props) {
  const sorted = [...pipelines].sort((a, b) => {
    const aRate = a.runCount > 0 ? (a.successCount / a.runCount) * 100 : 100;
    const bRate = b.runCount > 0 ? (b.successCount / b.runCount) * 100 : 100;
    const aBreach = aRate < a.slo_target * 100 ? 1 : 0;
    const bBreach = bRate < b.slo_target * 100 ? 1 : 0;
    if (aBreach !== bBreach) return aBreach - bBreach;
    return aRate - bRate;
  });

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">SLO Compliance</h3>
        <span className="text-xs text-slate-500">Success rate vs target</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sorted.map((p) => {
          const successRate = p.runCount > 0 ? (p.successCount / p.runCount) * 100 : 100;
          const target = p.slo_target * 100;
          const met = successRate >= target;
          const isSelected = selectedId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full text-left rounded-lg p-3 border transition-all ${
                isSelected
                  ? 'bg-slate-800 border-cyan-500/40'
                  : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-20 h-12 flex-shrink-0">
                  <Gauge value={successRate} target={target} size={80} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 font-medium truncate">{p.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-medium ${met ? 'text-emerald-400' : 'text-red-400'}`}>
                      {met ? 'Meeting' : 'Breaching'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {p.successCount}/{p.runCount} runs
                    </span>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  p.risk.band === 'healthy' ? 'bg-emerald-500' : p.risk.band === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
