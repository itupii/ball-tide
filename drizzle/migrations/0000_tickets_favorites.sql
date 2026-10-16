CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT 'Meu bilhete',
  selections jsonb NOT NULL DEFAULT '[]'::jsonb,
  stake numeric NOT NULL DEFAULT 10,
  total_odds numeric NOT NULL DEFAULT 1,
  ai_analysis text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tickets select" ON public.tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own tickets insert" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tickets update" ON public.tickets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own tickets delete" ON public.tickets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.favorite_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  team_id text NOT NULL,
  team_name text NOT NULL,
  logo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorite_teams TO authenticated;
GRANT ALL ON public.favorite_teams TO service_role;
ALTER TABLE public.favorite_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fav select" ON public.favorite_teams FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own fav insert" ON public.favorite_teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own fav delete" ON public.favorite_teams FOR DELETE TO authenticated USING (auth.uid() = user_id);