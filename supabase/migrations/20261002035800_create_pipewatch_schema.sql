/*
# Create PipeWatch schema (single-tenant, no auth)

1. New Tables
- `pipelines`: id, name, description, category, slo_target, created_at
- `runs`: id, pipeline_id (FK), status, started_at, duration_ms, cost_usd, failure_reason, created_at
- `incidents`: id, pipeline_id (FK), severity, title, description, started_at, resolved_at, status
- `costs`: id, pipeline_id (FK), date, amount_usd, run_count

2. Security
- Enable RLS on all tables.
- Allow anon + authenticated full CRUD — this is a single-tenant monitoring dashboard with no sign-in.

3. Indexes
- runs.pipeline_id, runs.started_at for fast history queries
- incidents.pipeline_id for join queries
- costs.pipeline_id, costs.date for cost rollup queries
*/

-- Pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'ETL',
  slo_target numeric NOT NULL DEFAULT 0.95,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pipelines" ON pipelines;
CREATE POLICY "anon_select_pipelines" ON pipelines FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pipelines" ON pipelines;
CREATE POLICY "anon_insert_pipelines" ON pipelines FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pipelines" ON pipelines;
CREATE POLICY "anon_update_pipelines" ON pipelines FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pipelines" ON pipelines;
CREATE POLICY "anon_delete_pipelines" ON pipelines FOR DELETE
  TO anon, authenticated USING (true);

-- Runs table
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'success',
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  failure_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_runs" ON runs;
CREATE POLICY "anon_select_runs" ON runs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_runs" ON runs;
CREATE POLICY "anon_insert_runs" ON runs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_runs" ON runs;
CREATE POLICY "anon_update_runs" ON runs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_runs" ON runs;
CREATE POLICY "anon_delete_runs" ON runs FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_runs_pipeline_id ON runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at DESC);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  description text,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_incidents" ON incidents;
CREATE POLICY "anon_select_incidents" ON incidents FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_incidents" ON incidents;
CREATE POLICY "anon_insert_incidents" ON incidents FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_incidents" ON incidents;
CREATE POLICY "anon_update_incidents" ON incidents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_incidents" ON incidents;
CREATE POLICY "anon_delete_incidents" ON incidents FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_incidents_pipeline_id ON incidents(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents(started_at DESC);

-- Costs table (daily rollup per pipeline)
CREATE TABLE IF NOT EXISTS costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  date date NOT NULL,
  amount_usd numeric NOT NULL DEFAULT 0,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_costs" ON costs;
CREATE POLICY "anon_select_costs" ON costs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_costs" ON costs;
CREATE POLICY "anon_insert_costs" ON costs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_costs" ON costs;
CREATE POLICY "anon_update_costs" ON costs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_costs" ON costs;
CREATE POLICY "anon_delete_costs" ON costs FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_costs_pipeline_id ON costs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_costs_date ON costs(date DESC);

-- Enable realtime for runs and incidents
ALTER PUBLICATION supabase_realtime ADD TABLE runs;
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;