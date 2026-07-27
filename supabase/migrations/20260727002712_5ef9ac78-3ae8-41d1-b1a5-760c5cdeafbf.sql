-- Regimes de escala
CREATE TYPE public.work_regime AS ENUM ('padrao_5x2', 'padrao_6x1', 'escala_12x36', 'escala_24x72', 'estagio', 'parcial', 'intermitente');
CREATE TYPE public.agreement_source AS ENUM ('manual', 'ia');
CREATE TYPE public.holiday_scope AS ENUM ('nacional', 'estadual', 'municipal');

-- Convenções coletivas / acordos
CREATE TABLE public.agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  union_name TEXT,
  category TEXT,
  state_uf TEXT,
  city TEXT,
  valid_from DATE NOT NULL,
  valid_to DATE,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  source public.agreement_source NOT NULL DEFAULT 'manual',
  confirmed BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreements TO authenticated;
GRANT ALL ON public.agreements TO service_role;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_agreements ON public.agreements FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Perfis de jornada
CREATE TABLE public.compliance_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  regime public.work_regime NOT NULL DEFAULT 'padrao_5x2',
  agreement_id UUID REFERENCES public.agreements(id) ON DELETE SET NULL,
  has_written_agreement BOOLEAN NOT NULL DEFAULT false,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_profiles TO authenticated;
GRANT ALL ON public.compliance_profiles TO service_role;
ALTER TABLE public.compliance_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_compliance_profiles ON public.compliance_profiles FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Feriados
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  scope public.holiday_scope NOT NULL DEFAULT 'nacional',
  state_uf TEXT,
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_holidays ON public.holidays FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Liberações auditadas de alertas
CREATE TABLE public.compliance_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (shift_id, rule_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_overrides TO authenticated;
GRANT ALL ON public.compliance_overrides TO service_role;
ALTER TABLE public.compliance_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_compliance_overrides ON public.compliance_overrides FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Vínculo do colaborador ao perfil de jornada
ALTER TABLE public.employees ADD COLUMN compliance_profile_id UUID REFERENCES public.compliance_profiles(id) ON DELETE SET NULL;

-- updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_agreements_updated_at BEFORE UPDATE ON public.agreements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_compliance_profiles_updated_at BEFORE UPDATE ON public.compliance_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agreements_owner ON public.agreements(owner_id);
CREATE INDEX idx_compliance_profiles_owner ON public.compliance_profiles(owner_id);
CREATE INDEX idx_holidays_owner_date ON public.holidays(owner_id, holiday_date);
CREATE INDEX idx_overrides_shift ON public.compliance_overrides(shift_id);