import { useState, useMemo } from 'react';
import { Activity, AlertTriangle, DollarSign, CheckCircle, Radio } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { PipelineGraph } from '@/components/PipelineGraph';
import { PipelineDetail } from '@/components/PipelineDetail';
import { IncidentTimeline } from '@/components/IncidentTimeline';
import { CostAnomalyChart } from '@/components/CostAnomalyChart';
import { SloGaugePanel } from '@/components/SloGaugePanel';

function App() {
  const { pipelines, incidents, dailyCosts, loading, error } = useDashboardData();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pipelineNames = useMemo(
    () => new Map(pipelines.map((p) => [p.id, p.name])),
    [pipelines]
  );

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === selectedId) || null,
    [pipelines, selectedId]
  );

  const stats = useMemo(() => {
    const totalPipelines = pipelines.length;
    const activeIncidents = incidents.filter((i) => i.status === 'open').length;
    const totalRuns = pipelines.reduce((sum, p) => sum + p.runCount, 0);
    const totalSuccess = pipelines.reduce((sum, p) => sum + p.successCount, 0);
    const successRate = totalRuns > 0 ? (totalSuccess / totalRuns) * 100 : 0;
    const todayCost = dailyCosts.length > 0 ? dailyCosts[dailyCosts.length - 1]?.total || 0 : 0;
    const criticalCount = pipelines.filter((p) => p.risk.band === 'critical').length;
    const warningCount = pipelines.filter((p) => p.risk.band === 'warning').length;
    return { totalPipelines, activeIncidents, successRate, todayCost, criticalCount, warningCount };
  }, [pipelines, incidents, dailyCosts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-slate-700 border-t-cyan-400 rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Loading pipeline data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-slate-200 font-semibold mb-1">Failed to load dashboard</h2>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">PipeWatch</h1>
                <p className="text-xs text-slate-500 -mt-0.5">Pipeline Observability Dashboard</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/20">
              <Radio className="w-3.5 h-3.5" />
              <span className="font-medium">Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="max-w-[1600px] mx-auto px-6 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Pipelines"
            value={stats.totalPipelines.toString()}
            sub={`${stats.criticalCount} critical · ${stats.warningCount} warning`}
            color="cyan"
          />
          <StatCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Active Incidents"
            value={stats.activeIncidents.toString()}
            sub={stats.activeIncidents > 0 ? 'Requires attention' : 'All clear'}
            color={stats.activeIncidents > 0 ? 'red' : 'emerald'}
          />
          <StatCard
            icon={<CheckCircle className="w-4 h-4" />}
            label="Success Rate"
            value={`${stats.successRate.toFixed(1)}%`}
            sub="Across all pipelines"
            color={stats.successRate >= 95 ? 'emerald' : stats.successRate >= 90 ? 'amber' : 'red'}
          />
          <StatCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Today's Spend"
            value={`$${stats.todayCost.toFixed(2)}`}
            sub="Aggregate cost"
            color="amber"
          />
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pipeline graph - spans 2 columns */}
          <div className="lg:col-span-2 bg-slate-900/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Pipeline Status Graph</h3>
              <span className="text-xs text-slate-500">Click a node for details</span>
            </div>
            <div className="p-2" style={{ height: 520 }}>
              <PipelineGraph
                pipelines={pipelines}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>

          {/* Right column: SLO gauges */}
          <div style={{ height: 556 }}>
            <SloGaugePanel
              pipelines={pipelines}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          </div>
        </div>

        {/* Bottom row: incidents + costs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div style={{ height: 360 }}>
            <IncidentTimeline incidents={incidents} pipelineNames={pipelineNames} />
          </div>
          <div style={{ height: 360 }}>
            <CostAnomalyChart dailyCosts={dailyCosts} pipelineNames={pipelineNames} />
          </div>
        </div>
      </div>

      {/* Detail slide-over */}
      {selectedPipeline && (
        <div className="fixed inset-0 z-30 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedId(null)}
          />
          <div
            className="relative w-full max-w-md h-full bg-slate-900 shadow-2xl overflow-y-auto"
            style={{ animation: 'pipewatch-slide-in 0.25s ease-out' }}
          >
            <PipelineDetail pipeline={selectedPipeline} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: 'cyan' | 'red' | 'emerald' | 'amber';
}

function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  const colorMap = {
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  };
  const c = colorMap[color];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`${c.text}`}>{icon}</div>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}

export default App;
