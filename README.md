# Culer Collective

A Vite and React FC Barcelona companion for fixtures, results, player statistics, and competition standings. The site is static: its football data is generated into `src/data/generated/snapshot.json` and bundled during `npm run build`.

## Development

Install dependencies and start Vite:

```sh
npm ci
npm run dev
```

Useful checks:

```sh
npm run data:validate
npm test
npm run lint
npm run build
```

## Football data setup

Automatic updates use [GOAL API](https://goal-api.com/documentation) as the primary source for fixtures, results, match events, player statistics, and La Liga standings. Its free plan currently includes [1,000 requests per day](https://goal-api.com/what-is-goal-api). The public, keyless [Barça API](https://api.fc-barcelona.app/en/docs) is the UEFA Champions League standings fallback because GOAL API's current Champions League coverage does not expose that table.

For local updates, copy the example environment file and fill in `GOAL_API_KEY`:

```powershell
Copy-Item .env.example .env
```

The updater loads the repository-root `.env` file when it exists. The example also contains the provider, season, post-match polling window, and optional API endpoint overrides. `.env` is ignored by Git and must never be committed. The updater sends the GOAL API key as a server-side Bearer credential; do not put it in React code, use a `VITE_`-prefixed variable, or commit it.

Run a complete refresh with:

```sh
npm run data:update
```

Run the same guarded mode used by the frequent automation with:

```sh
npm run data:update:scheduled
```

`data:update` contacts the providers immediately. `data:update:scheduled` first checks the committed fixture schedule and exits without making an API request unless a Barça match is inside the configured post-kickoff window. An out-of-window scheduled run uses zero requests. An in-window no-change check is normally about 1–2 requests; a full or match-changing refresh uses tens of requests rather than hundreds, with the exact count depending on competitions, pagination, and match details.

The half-hour checks therefore consume nothing on a normal out-of-window day; the daily full refresh accounts for most usage and remains comfortably below GOAL API's 1,000-request daily allowance. Match days add the small status checks and one detailed refresh after new data appears.

API-Football remains available as an optional provider for an account with current-season access. Set `FOOTBALL_DATA_PROVIDER=api-football` and add `API_FOOTBALL_KEY`; its team, season, and endpoint settings remain in `.env.example` for backward compatibility.

Do not hand-edit `src/data/generated/snapshot.json`. Update mapping or normalization code and regenerate it instead.

## GitHub automation

Add a repository Actions secret named `GOAL_API_KEY` under **Settings → Secrets and variables → Actions**. Paste only the key as the secret value; GitHub supplies it to the updater without exposing it to the browser or generated site. The workflow at `.github/workflows/update-football-data.yml` then runs:

- every 30 minutes in gated scheduled mode;
- once daily at 04:23 UTC in full mode; and
- on demand with either mode from the Actions tab; and
- in full mode when the workflow file itself changes on `main`, which verifies automation changes immediately.

At the start of a later season, set the repository Actions variable `FOOTBALL_DATA_SEASON` to that season’s starting year (for example, `2027` for 2027/28) and run one manual **full** update. `GOAL_API_SEASON` is also accepted as a backward-compatible fallback. The updater initializes the new season without comparing it to the old results; page season labels follow the generated data.

Each run checks or updates the snapshot first. If the data is unchanged, it stops there; if it changed, it installs locked dependencies, validates the snapshot, runs the Node tests and ESLint, builds the Vite site, and commits only `src/data/generated/snapshot.json` and `dist`. The workflow has one concurrency group, so two update runs cannot write at the same time. Its narrow push trigger watches only the workflow file, and it ignores the Actions bot as an actor, preventing generated-data commits from starting a bot loop.

If the workflow cannot push, confirm that repository Actions settings allow `GITHUB_TOKEN` read/write access and that branch protection permits this workflow. The repository does not otherwise prescribe a hosting platform: a host connected to `main` can redeploy from the automation commit, while a host serving the tracked `dist` directory receives the rebuilt output in the same commit.

Scheduled Actions are best effort rather than an exact final-whistle webhook. On public repositories, GitHub may disable scheduled workflows after a long period without repository activity; the manual workflow trigger remains available.

## Data safety

Updates are idempotent and replace the generated snapshot only after fetching, normalization, and validation succeed. Invalid, incomplete, or unavailable provider data makes the command fail. The workflow then stops before committing, so the current snapshot and deployed build remain the last-known-good version. An unchanged snapshot produces no commit, and Git history provides rollback for a bad upstream correction that still passes validation.
