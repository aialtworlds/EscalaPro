CREATE TYPE public.constraint_kind AS ENUM ('indisponivel_semanal','afastamento');

CREATE TABLE public.employee_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind public.constraint_kind NOT NULL,
  weekday smallint,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_constraints TO authenticated;
GRANT ALL ON public.employee_constraints TO service_role;
ALTER TABLE public.employee_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_employee_constraints ON public.employee_constraints FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_employee_constraints_owner ON public.employee_constraints(owner_id, employee_id);

CREATE TABLE public.demand_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  headcount integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_templates TO authenticated;
GRANT ALL ON public.demand_templates TO service_role;
ALTER TABLE public.demand_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_demand_templates ON public.demand_templates FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_demand_templates_owner ON public.demand_templates(owner_id, weekday);

CREATE TABLE public.schedule_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  week_start date NOT NULL,
  label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_snapshots TO authenticated;
GRANT ALL ON public.schedule_snapshots TO service_role;
ALTER TABLE public.schedule_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_schedule_snapshots ON public.schedule_snapshots FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_schedule_snapshots_owner ON public.schedule_snapshots(owner_id, week_start, created_at DESC);

CREATE TABLE public.schedule_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  week_start date NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_shares TO authenticated;
GRANT ALL ON public.schedule_shares TO service_role;
ALTER TABLE public.schedule_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_schedule_shares ON public.schedule_shares FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);