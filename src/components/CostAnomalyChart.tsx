import { useState } from 'react';
import type { DailyCost } from '@/hooks/useDashboardData';

interface Props {
  dailyCosts: DailyCost[];
  pipelineNames: Map<string, string>;
}

export function CostAnomalyChart({ dailyCosts, pipelineNames }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (dailyCosts.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-4 h-full flex items-center justify-center">
        <span className="text-slate-500 text-sm">No cost data available</span>
      </div>
    );
  }

  const maxCost = Math.max(...dailyCosts.map((d) => d.total));
  const anomalyCount = dailyCosts.filter((d) => d.isAnomaly).length;

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Cost Anomaly Detection</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">30-day spend</span>
          {anomalyCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
              {anomalyCount} anomaly{anomalyCount > 1 ? 'ies' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-end gap-0.5 min-h-[120px] relative">
        {dailyCosts.map((d, i) => {
          const heightPct = (d.total / maxCost) * 100;
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={d.date}
              className="flex-1 relative group cursor-pointer"
              style={{ height: '100%' }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-200"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: d.isAnomaly ? '#ef4444' : isHovered ? '#0891b2' : '#0e7490',
                  opacity: d.isAnomaly ? 1 : isHovered ? 1 : 0.7,
                  boxShadow: d.isAnomaly ? '0 0 8px rgba(239,68,68,0.5)' : 'none',
                }}
              />
              {d.isAnomaly && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400"
                    style={{ animation: 'pipewatch-pulse 1.5s ease-in-out infinite' }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Hover tooltip */}
        {hoveredIdx !== null && (
          <div className="absolute bottom-full mb-2 left-0 z-10 bg-slate-800/95 border border-slate-700 rounded-lg p-3 shadow-xl backdrop-blur-sm min-w-[180px] pointer-events-none"
            style={{ left: `${(hoveredIdx / dailyCosts.length) * 100}%` }}
          >
            <div className="text-xs text-slate-400 mb-1">
              {new Date(dailyCosts[hoveredIdx].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div className="text-lg font-bold text-slate-100">
              ${dailyCosts[hoveredIdx].total.toFixed(2)}
            </div>
            {dailyCosts[hoveredIdx].isAnomaly && (
              <div className="text-xs text-red-400 mt-1 font-medium">Cost anomaly detected</div>
            )}
            <div className="mt-2 pt-2 border-t border-slate-700 space-y-0.5">
              {Object.entries(dailyCosts[hoveredIdx].byPipeline)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([pid, amt]) => (
                  <div key={pid} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{pipelineNames.get(pid) || 'Unknown'}</span>
                    <span className="text-slate-300">${amt.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 px-1">
        <span className="text-xs text-slate-500">
          {dailyCosts.length > 0 ? new Date(dailyCosts[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
        </span>
        <span className="text-xs text-slate-500">
          {dailyCosts.length > 0 ? new Date(dailyCosts[dailyCosts.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
        </span>
      </div>
    </div>
  );
}
