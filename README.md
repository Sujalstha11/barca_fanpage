# Culer Collective

A Vite and React FC Barcelona companion for fixtures, results, player statistics, and competition standings. The site is static: its football data is stored in `src/data/generated/snapshot.json` and bundled during `npm run build`.

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

## Current football data policy

Automatic API updates are paused. The site uses a committed snapshot, and refreshing it does not require an API key. Data changes are reviewed against publicly available club and competition sources, including the [official results](https://www.fcbarcelona.com/en/football/first-team/results) and [official schedule](https://www.fcbarcelona.com/en/football/first-team/schedule).

The reviewed input is `scripts/football-data/manual-2026-10-10.mjs`. It records the source URLs, review time, covered matches, published player statistics, league tables, and cup status. The offline generator at `scripts/refresh-manual-football-data.mjs` rebuilds `src/data/generated/snapshot.json` from that fixed input:

```sh
npm run data:refresh:manual
```

This command makes no network requests and does not fetch today's results or statistics. Repeating it reproduces the records reviewed on 10 October 2026 and preserves that review date.

For a later manual refresh, review the public sources, update or replace the dated input module, and point the generator to the reviewed dataset. Record the actual review time and the period covered by each data section, keeping `source.name` as `manual-public-sources`. Only include figures that the sources support. Do not treat unknown statistics as zero or advance a section's coverage date without verifying it. Preserve an earlier coverage date and explain any unavailable data. Regenerate the snapshot, update the visible source notes and generator message to match, then run the validation, tests, lint, and build commands above before publishing.

Player totals combine the official LaLiga and UEFA records and include players with published records. Published minutes may be rounded. Cup competitions are represented by their stage and draw or match status, without a league rank or points total.

The website does not refresh after a match by itself. A reviewed snapshot must be committed and deployed for visitors to see changes. The existing Vercel Git integration deploys commits to the production branch; no API key is needed by the browser or the Vercel build.

## Optional API updater (manual use only)

The earlier keyed updater remains available if current-season provider access is restored. It uses [GOAL API](https://goal-api.com/documentation) for fixtures, results, match events, player statistics, and La Liga standings. The public, keyless [Barça API](https://api.fc-barcelona.app/en/docs) is its Champions League standings fallback. These providers are not contacted by the current manual refresh process.

To deliberately run a local API update, copy the example environment file and fill in a working `GOAL_API_KEY`:

```powershell
Copy-Item .env.example .env
```

The updater loads the repository-root `.env` file when it exists. The example also contains the provider, season, post-match polling window, and optional API endpoint overrides. `.env` is ignored by Git and must never be committed. The updater sends the GOAL API key as a server-side Bearer credential; do not put it in React code, use a `VITE_`-prefixed variable, or commit it.

Run a complete refresh with:

```sh
npm run data:update
```

To deliberately run an update only inside the configured post-kickoff window:

```sh
npm run data:update:scheduled
```

`data:update` contacts the providers immediately. `data:update:scheduled` first checks the committed fixture schedule and exits without making an API request unless a Barça match is inside the configured post-kickoff window. The command name does not create a schedule. Provider access, coverage, and request limits must be verified before using either command.

API-Football remains available as an optional provider for an account with current-season access. Set `FOOTBALL_DATA_PROVIDER=api-football` and add `API_FOOTBALL_KEY`; its team, season, and endpoint settings remain in `.env.example` for backward compatibility.

## Optional GitHub API workflow

The workflow at `.github/workflows/update-football-data.yml` has only a manual `workflow_dispatch` trigger. There are no timer or push triggers, so existing repository API secrets are unused unless someone deliberately starts this workflow.

After confirming API access, add or replace the repository Actions secret named `GOAL_API_KEY` under **Settings → Secrets and variables → Actions**. Paste only the key as the secret value. Then choose **Update football data (manual API only)** in the Actions tab and run either `full` or the guarded `scheduled` mode. Both choices are manual invocations; neither enables recurring updates.

At the start of a later season, set the repository Actions variable `FOOTBALL_DATA_SEASON` to that season’s starting year (for example, `2027` for 2027/28) and run one manual **full** update. `GOAL_API_SEASON` is also accepted as a backward-compatible fallback. The updater initializes the new season without comparing it to the old results; page season labels follow the generated data.

Each manually started API run checks or updates the snapshot first. If the data is unchanged, it stops there; if it changed, it installs locked dependencies, validates the snapshot, runs the Node tests and ESLint, builds the Vite site, and commits only `src/data/generated/snapshot.json` and `dist`. The workflow has one concurrency group, so two API update runs cannot write at the same time.

If the workflow cannot push, confirm that repository Actions settings allow `GITHUB_TOKEN` read/write access and that branch protection permits this workflow. The repository does not otherwise prescribe a hosting platform: a host connected to `main` can redeploy from the automation commit, while a host serving the tracked `dist` directory receives the rebuilt output in the same commit.

Restoring automatic updates requires a deliberate workflow change after the provider has been verified. Adding or replacing a secret alone will not restart automation.

## Data safety

Manual snapshots must pass the same schema validation and application checks as API snapshots. Validation checks structure and consistency; source review is still required to establish that football facts and coverage dates are correct.

The optional API updater is idempotent and replaces the snapshot only after fetching, normalization, and validation succeed. Invalid, incomplete, or unavailable provider data makes the command fail. The workflow then stops before committing. An unchanged snapshot produces no commit, and Git history provides rollback for an incorrect change.
