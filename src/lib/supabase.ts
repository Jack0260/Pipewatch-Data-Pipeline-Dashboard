import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  category: string;
  slo_target: number;
  created_at: string;
}

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: 'success' | 'failed' | 'partial_failure';
  started_at: string;
  duration_ms: number;
  cost_usd: number;
  failure_reason: string | null;
  created_at: string;
}

export interface Incident {
  id: string;
  pipeline_id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string | null;
  started_at: string;
  resolved_at: string | null;
  status: 'open' | 'resolved';
  created_at: string;
}

export interface CostEntry {
  id: string;
  pipeline_id: string;
  date: string;
  amount_usd: number;
  run_count: number;
  created_at: string;
}
