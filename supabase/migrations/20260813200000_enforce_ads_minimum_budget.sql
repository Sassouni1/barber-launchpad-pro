ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_minimum_daily_budget
  CHECK (daily_budget_cents >= 1000);
