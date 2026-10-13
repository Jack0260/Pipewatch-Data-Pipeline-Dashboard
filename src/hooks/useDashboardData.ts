import { useEffect, useState, useCallback } from 'react';
import { supabase, type Pipeline, type PipelineRun, type Incident, type CostEntry } from '@/lib/supabase';
import { computeRiskScore, type RiskScore } from '@/lib/riskScore';

export interface PipelineWithRisk extends Pipeline {
  risk: RiskScore;
  recentRuns: PipelineRun[];
  runCount: number;
  successCount: number;
  failedCount: number;
  avgDuration: number;
  avgCost: number;
  totalCost: number;
  hasActiveIncident: boolean;
}

export interface DailyCost {
  date: string;
  total: number;
  byPipeline: Record<string, number>;
  isAnomaly: boolean;
}

export function useDashboardData() {
  const [pipelines, setPipelines] = useState<PipelineWithRisk[]>([]);
  const [allRuns, setAllRuns] = useState<PipelineRun[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const computeAll = useCallback(
    (pips: Pipeline[], runs: PipelineRun[], incs: Incident[], costs: CostEntry[]) => {
      const pipelineMap = new Map<string, PipelineWithRisk>();

      for (const p of pips) {
        const pipelineRuns = runs
          .filter((r) => r.pipeline_id === p.id)
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

        const recentRuns = pipelineRuns.slice(0, 50);
        const risk = computeRiskScore(pipelineRuns, p.slo_target);
        const runCount = pipelineRuns.length;
        const successCount = pipelineRuns.filter((r) => r.status === 'success').length;
        const failedCount = pipelineRuns.filter((r) => r.status !== 'success').length;
        const avgDuration = runCount > 0
          ? pipelineRuns.reduce((sum, r) => sum + r.duration_ms, 0) / runCount
          : 0;
        const avgCost = runCount > 0
          ? pipelineRuns.reduce((sum, r) => sum + r.cost_usd, 0) / runCount
          : 0;
        const totalCost = pipelineRuns.reduce((sum, r) => sum + r.cost_usd, 0);
        const hasActiveIncident = incs.some(
          (i) => i.pipeline_id === p.id && i.status === 'open'
        );

        pipelineMap.set(p.id, {
          ...p,
          risk,
          recentRuns,
          runCount,
          successCount,
          failedCount,
          avgDuration,
          avgCost,
          totalCost,
          hasActiveIncident,
        });
      }

      const sorted = Array.from(pipelineMap.values()).sort(
        (a, b) => b.risk.score - a.risk.score
      );

      // Compute daily costs
      type CostAgg = { total: number; byPipeline: Record<string, number> };
      const costByDate = new Map<string, CostAgg>();
      for (const c of costs) {
        const dateKey = c.date;
        if (!costByDate.has(dateKey)) {
          costByDate.set(dateKey, { total: 0, byPipeline: {} });
        }
        const entry = costByDate.get(dateKey)!;
        entry.total += c.amount_usd;
        entry.byPipeline[c.pipeline_id] = (entry.byPipeline[c.pipeline_id] || 0) + c.amount_usd;
      }

      const sortedDates = Array.from(costByDate.keys()).sort();
      const totals = sortedDates.map((d) => costByDate.get(d)!.total);
      const avg = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
      const stdDev = totals.length > 0
        ? Math.sqrt(totals.reduce((sum, t) => sum + (t - avg) ** 2, 0) / totals.length)
        : 0;
      const threshold = avg + stdDev * 1.5;

      const dailyCostArr: DailyCost[] = sortedDates.map((d) => {
        const entry = costByDate.get(d)!;
        return {
          date: d,
          total: Math.round(entry.total * 100) / 100,
          byPipeline: entry.byPipeline,
          isAnomaly: entry.total > threshold && entry.total > avg * 1.5,
        };
      });

      return { computedPipelines: sorted, computedDailyCosts: dailyCostArr };
    },
    []
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pipRes, runRes, incRes, costRes] = await Promise.all([
        supabase.from('pipelines').select('*').order('name'),
        supabase.from('runs').select('*').order('started_at', { ascending: false }).limit(2000),
        supabase.from('incidents').select('*').order('started_at', { ascending: false }),
        supabase.from('costs').select('*').order('date', { ascending: true }),
      ]);

      if (pipRes.error) throw pipRes.error;
      if (runRes.error) throw runRes.error;
      if (incRes.error) throw incRes.error;
      if (costRes.error) throw costRes.error;

      const pips = pipRes.data as Pipeline[];
      const runs = runRes.data as PipelineRun[];
      const incs = incRes.data as Incident[];
      const costs = costRes.data as CostEntry[];

      setAllRuns(runs);
      setIncidents(incs);

      const { computedPipelines, computedDailyCosts } = computeAll(pips, runs, incs, costs);
      setPipelines(computedPipelines);
      setDailyCosts(computedDailyCosts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [computeAll]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    const runChannel = supabase
      .channel('runs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'runs' }, (payload) => {
        const newRun = payload.new as PipelineRun;
        setAllRuns((prev) => {
          if (prev.some((r) => r.id === newRun.id)) return prev;
          return [newRun, ...prev].slice(0, 2000);
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'runs' }, (payload) => {
        const updatedRun = payload.new as PipelineRun;
        setAllRuns((prev) => prev.map((r) => (r.id === updatedRun.id ? updatedRun : r)));
      })
      .subscribe();

    const incidentChannel = supabase
      .channel('incidents-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        const newInc = payload.new as Incident;
        setIncidents((prev) => {
          if (prev.some((i) => i.id === newInc.id)) return prev;
          return [newInc, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, (payload) => {
        const updatedInc = payload.new as Incident;
        setIncidents((prev) => prev.map((i) => (i.id === updatedInc.id ? updatedInc : i)));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(runChannel);
      supabase.removeChannel(incidentChannel);
    };
  }, []);

  // Recompute when runs or incidents change
  useEffect(() => {
    if (allRuns.length === 0 && pipelines.length === 0) return;
    const pipelineIds = new Set(allRuns.map((r) => r.pipeline_id));
    const pips = pipelines.filter((p) => pipelineIds.has(p.id) || true);
    if (pips.length === 0) return;
    const { computedPipelines, computedDailyCosts } = computeAll(
      pips.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        slo_target: p.slo_target,
        created_at: p.created_at,
      })),
      allRuns,
      incidents,
      [] // costs don't change in realtime for this demo
    );
    setPipelines(computedPipelines);
    setDailyCosts((prev) => prev.length > 0 ? prev : computedDailyCosts);
  }, [allRuns, incidents, computeAll, pipelines.length]);

  return { pipelines, incidents, dailyCosts, loading, error, refetch: fetchAll };
}
