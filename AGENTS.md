<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Football data comes from ESPN's free public site API via server functions in src/lib/espn.functions.ts (no key, worldwide, live); live views poll every 15s — keep calls server-side to avoid CORS.
- Bookmaker odds come from The Odds API (ODDS_API_KEY, trimmed) in src/lib/odds.functions.ts; ESPN/DraftKings odds are the fallback on match pages.
- Probabilities use a Poisson model in src/lib/analytics.ts with small-sample shrinkage; AI ticket analysis streams from the /api/ai-ticket server route and requires a signed-in bearer token.
