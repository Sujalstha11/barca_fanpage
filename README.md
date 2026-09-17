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

## API-Football setup

Automatic updates use [API-Football v3](https://www.api-football.com/documentation-v3). Follow the provider’s [getting-started guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide), copy the football API key from its dashboard, and keep that key private.

For local updates, copy the example environment file and fill in `API_FOOTBALL_KEY`:

```powershell
Copy-Item .env.example .env
```

The updater loads the repository-root `.env` file when it exists. The example also contains the FC Barcelona team and season defaults, the post-match polling window, and an optional API base URL override. `.env` is ignored by Git and must never be committed.

Run a complete refresh with:

```sh
npm run data:update
```

Run the same guarded mode used by the frequent automation with:

```sh
npm run data:update:scheduled
```

`data:update` contacts the provider immediately. `data:update:scheduled` first checks the committed fixture schedule and exits without making an API request unless a Barça match is inside the configured post-kickoff window. A regular full or post-match sync normally uses about 6–7 requests, depending on active competitions and provider pagination. The first sync usually needs one extra team-verification request; an out-of-window run uses zero, while an in-window final-status check uses one. Provider corrections or missing event details can increase that estimate.

With the included schedule, expect roughly 7 requests on a normal no-match day and about 13–15 on a match day—comfortably below the provider’s current [100-request free daily allowance](https://www.api-football.com/news/post/how-ratelimit-works).

Do not hand-edit `src/data/generated/snapshot.json`. Update mapping or normalization code and regenerate it instead.

## GitHub automation

Add a repository Actions secret named `API_FOOTBALL_KEY` under **Settings → Secrets and variables → Actions**. The workflow at `.github/workflows/update-football-data.yml` then runs:

- every 30 minutes in gated scheduled mode;
- once daily at 04:23 UTC in full mode; and
- on demand with either mode from the Actions tab.

At the start of a later season, set the repository Actions variable `API_FOOTBALL_SEASON` to that season’s starting year (for example, `2027` for 2027/28) and run one manual **full** update. The updater initializes the new season without comparing it to the old results; page season labels follow the generated data.

Each run checks or updates the snapshot first. If the data is unchanged, it stops there; if it changed, it installs locked dependencies, validates the snapshot, runs the Node tests and ESLint, builds the Vite site, and commits only `src/data/generated/snapshot.json` and `dist`. The workflow has one concurrency group, so two update runs cannot write at the same time. It has no `push` trigger and ignores the Actions bot as an actor, preventing update commits from starting a bot loop.

If the workflow cannot push, confirm that repository Actions settings allow `GITHUB_TOKEN` read/write access and that branch protection permits this workflow. The repository does not otherwise prescribe a hosting platform: a host connected to `main` can redeploy from the automation commit, while a host serving the tracked `dist` directory receives the rebuilt output in the same commit.

Scheduled Actions are best effort rather than an exact final-whistle webhook. On public repositories, GitHub may disable scheduled workflows after a long period without repository activity; the manual workflow trigger remains available.

## Data safety

Updates are idempotent and replace the generated snapshot only after fetching, normalization, and validation succeed. Invalid, incomplete, or unavailable provider data makes the command fail. The workflow then stops before committing, so the current snapshot and deployed build remain the last-known-good version. An unchanged snapshot produces no commit, and Git history provides rollback for a bad upstream correction that still passes validation.
