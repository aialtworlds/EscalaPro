CREATE TABLE public.subscriptions (
  owner_id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'none',
  provider text NOT NULL DEFAULT 'none',
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free','pro')),
  CONSTRAINT subscriptions_status_check CHECK (status IN ('none','trialing','active','past_due','canceled'))
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_subscription_read" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();