import type { PipelineRun } from './supabase';

export interface RiskScore {
  score: number;
  band: 'healthy' | 'warning' | 'critical';
  failureRate: number;
  recentFailureRate: number;
  priorFailureRate: number;
  latencyTrendPct: number;
  costTrendPct: number;
  explanation: string;
  factors: RiskFactor[];
}

interface RiskFactor {
  label: string;
  value: string;
  impact: 'low' | 'medium' | 'high';
  direction: 'up' | 'down' | 'stable';
}

export function computeRiskScore(
  runs: PipelineRun[],
  sloTarget: number
): RiskScore {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  const recentRuns = runs.filter((r) => new Date(r.started_at).getTime() >= sevenDaysAgo);
  const priorRuns = runs.filter(
    (r) =>
      new Date(r.started_at).getTime() >= fourteenDaysAgo &&
      new Date(r.started_at).getTime() < sevenDaysAgo
  );

  const totalRecent = recentRuns.length;
  const totalPrior = priorRuns.length;

  const failedRecent = recentRuns.filter((r) => r.status !== 'success').length;
  const failedPrior = priorRuns.filter((r) => r.status !== 'success').length;

  const recentFailureRate = totalRecent > 0 ? failedRecent / totalRecent : 0;
  const priorFailureRate = totalPrior > 0 ? failedPrior / totalPrior : 0;
  const overallFailureRate = totalRecent > 0 ? recentFailureRate : 0;

  const recentDurations = recentRuns.map((r) => r.duration_ms);
  const priorDurations = priorRuns.map((r) => r.duration_ms);
  const recentAvgDuration = recentDurations.length > 0
    ? recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length
    : 0;
  const priorAvgDuration = priorDurations.length > 0
    ? priorDurations.reduce((a, b) => a + b, 0) / priorDurations.length
    : 0;
  const latencyTrendPct = priorAvgDuration > 0
    ? ((recentAvgDuration - priorAvgDuration) / priorAvgDuration) * 100
    : 0;

  const recentCosts = recentRuns.map((r) => r.cost_usd);
  const priorCosts = priorRuns.map((r) => r.cost_usd);
  const recentAvgCost = recentCosts.length > 0
    ? recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length
    : 0;
  const priorAvgCost = priorCosts.length > 0
    ? priorCosts.reduce((a, b) => a + b, 0) / priorCosts.length
    : 0;
  const costTrendPct = priorAvgCost > 0
    ? ((recentAvgCost - priorAvgCost) / priorAvgCost) * 100
    : 0;

  // Failure rate component (0-50 points)
  const failureComponent = Math.min(50, recentFailureRate * 200);

  // Latency trend component (0-25 points)
  const latencyComponent = Math.min(25, Math.max(0, Math.abs(latencyTrendPct)) * 0.5);

  // Cost trend component (0-25 points)
  const costComponent = Math.min(25, Math.max(0, Math.abs(costTrendPct)) * 0.5);

  const score = Math.round(failureComponent + latencyComponent + costComponent);

  let band: 'healthy' | 'warning' | 'critical';
  if (score >= 50) band = 'critical';
  else if (score >= 20) band = 'warning';
  else band = 'healthy';

  // Also factor in SLO breach
  const successRate = 1 - recentFailureRate;
  if (successRate < sloTarget && band === 'healthy') {
    band = 'warning';
  }

  const factors: RiskFactor[] = [
    {
      label: 'Failure rate (7d)',
      value: `${(recentFailureRate * 100).toFixed(1)}%`,
      impact: recentFailureRate > 0.1 ? 'high' : recentFailureRate > 0.05 ? 'medium' : 'low',
      direction: recentFailureRate > priorFailureRate ? 'up' : recentFailureRate < priorFailureRate ? 'down' : 'stable',
    },
    {
      label: 'Latency trend',
      value: `${latencyTrendPct >= 0 ? '+' : ''}${latencyTrendPct.toFixed(0)}%`,
      impact: Math.abs(latencyTrendPct) > 30 ? 'high' : Math.abs(latencyTrendPct) > 15 ? 'medium' : 'low',
      direction: latencyTrendPct > 5 ? 'up' : latencyTrendPct < -5 ? 'down' : 'stable',
    },
    {
      label: 'Cost trend',
      value: `${costTrendPct >= 0 ? '+' : ''}${costTrendPct.toFixed(0)}%`,
      impact: Math.abs(costTrendPct) > 50 ? 'high' : Math.abs(costTrendPct) > 25 ? 'medium' : 'low',
      direction: costTrendPct > 5 ? 'up' : costTrendPct < -5 ? 'down' : 'stable',
    },
  ];

  const parts: string[] = [];

  if (recentFailureRate > 0) {
    if (recentFailureRate > priorFailureRate && priorFailureRate > 0) {
      parts.push(
        `failure rate is ${(recentFailureRate * 100).toFixed(0)}%, up from ${(priorFailureRate * 100).toFixed(0)}% the prior week`
      );
    } else {
      parts.push(`failure rate is ${(recentFailureRate * 100).toFixed(0)}%`);
    }
  } else {
    parts.push('no failures in the last 7 days');
  }

  if (Math.abs(latencyTrendPct) > 10) {
    parts.push(
      `run duration has ${latencyTrendPct > 0 ? 'increased' : 'decreased'} ${Math.abs(latencyTrendPct).toFixed(0)}%`
    );
  } else {
    parts.push('duration is stable');
  }

  if (Math.abs(costTrendPct) > 20) {
    parts.push(
      `cost per run is ${costTrendPct > 0 ? 'up' : 'down'} ${Math.abs(costTrendPct).toFixed(0)}%`
    );
  } else {
    parts.push('cost is stable');
  }

  if (successRate < sloTarget) {
    parts.push(`below the ${(sloTarget * 100).toFixed(0)}% SLO target`);
  }

  const explanation = `This pipeline ${parts.join(', ')}.`;

  return {
    score,
    band,
    failureRate: overallFailureRate,
    recentFailureRate,
    priorFailureRate,
    latencyTrendPct,
    costTrendPct,
    explanation,
    factors,
  };
}
