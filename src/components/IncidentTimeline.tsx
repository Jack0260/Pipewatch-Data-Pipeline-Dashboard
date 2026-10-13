import type { Incident } from '@/lib/supabase';

interface Props {
  incidents: Incident[];
  pipelineNames: Map<string, string>;
}

const SEVERITY_STYLES: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  critical: { dot: 'bg-red-500', bg: 'bg-red-500/5', text: 'text-red-400', border: 'border-red-500/20' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-500/5', text: 'text-amber-400', border: 'border-amber-500/20' },
  info: { dot: 'bg-cyan-500', bg: 'bg-cyan-500/5', text: 'text-cyan-400', border: 'border-cyan-500/20' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / (24 * 3600000))}d ago`;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'Ongoing';
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}

export function IncidentTimeline({ incidents, pipelineNames }: Props) {
  const sorted = [...incidents].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Incident Timeline</h3>
        <span className="text-xs text-slate-500">{sorted.filter((i) => i.status === 'open').length} active</span>
      </div>
      <div className="relative flex-1 overflow-y-auto pr-1">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700/50" />
        <div className="space-y-3">
          {sorted.map((inc) => {
            const style = SEVERITY_STYLES[inc.severity] || SEVERITY_STYLES.warning;
            return (
              <div key={inc.id} className="relative pl-8">
                <div className={`absolute left-2 top-1.5 w-3 h-3 rounded-full ${style.dot} ring-2 ring-slate-900`} />
                <div className={`rounded-lg ${style.bg} ${style.border} border p-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold uppercase ${style.text}`}>
                      {inc.severity}
                    </span>
                    <span className="text-xs text-slate-500">{formatTime(inc.started_at)}</span>
                  </div>
                  <div className="text-sm text-slate-200 font-medium leading-snug">
                    {inc.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-400">
                      {pipelineNames.get(inc.pipeline_id) || 'Unknown'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-slate-500">
                      {formatDuration(inc.started_at, inc.resolved_at)}
                    </span>
                    {inc.status === 'open' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${style.bg} ${style.text} border ${style.border}`}>
                        OPEN
                      </span>
                    )}
                  </div>
                  {inc.description && (
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{inc.description}</p>
                  )}
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">No incidents recorded</div>
          )}
        </div>
      </div>
    </div>
  );
}
