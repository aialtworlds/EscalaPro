ALTER TABLE public.demand_templates
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS sector_only boolean NOT NULL DEFAULT true;