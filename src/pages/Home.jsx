import { ArrowRight, CalendarDays, ChevronRight, MapPin, ShieldCheck, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CompetitionPill from '../components/CompetitionPill.jsx'
import FixtureCard from '../components/FixtureCard.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import TimezoneSelect from '../components/TimezoneSelect.jsx'
import { usePreferences } from '../context/preferences.js'
import { fixtures } from '../data/fixtures.js'
import { featuredPlayerIds, players } from '../data/players.js'
import { recentResults } from '../data/results.js'
import { formatFixtureDate, formatFixtureTime, getAge, getTimezoneLabel } from '../utils/formatters.js'

const heroImage = 'https://images.unsplash.com/photo-1544366981-53db834f982a?auto=format&fit=crop&q=88&w=2200'
const pageLoadedAt = Date.now()

function useCountdown(kickoff) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(kickoff).getTime() - pageLoadedAt))

  useEffect(() => {
    const timer = window.setInterval(
      () => setRemaining(Math.max(0, new Date(kickoff).getTime() - Date.now())),
      30000,
    )
    return () => window.clearInterval(timer)
  }, [kickoff])

  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining % 86400000) / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
  }
}

function Countdown({ kickoff }) {
  const countdown = useCountdown(kickoff)
  return (
    <div className="grid grid-cols-3 gap-2" aria-label={`${countdown.days} days, ${countdown.hours} hours, and ${countdown.minutes} minutes until kickoff`}>
      {Object.entries(countdown).map(([unit, value]) => (
        <div key={unit} className="rounded-xl border border-white/10 bg-white/[0.06] px-2 py-3 text-center backdrop-blur-md">
          <span className="block font-display text-2xl font-black leading-none text-white">{String(value).padStart(2, '0')}</span>
          <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">{unit}</span>
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const { timezone } = usePreferences()
  const nextFixture = fixtures.find((fixture) => {
    if (fixture.kickoff) return new Date(fixture.kickoff).getTime() > pageLoadedAt
    return new Date(`${fixture.date}T23:59:59`).getTime() > pageLoadedAt
  }) || fixtures[0]
  const nextIndex = fixtures.findIndex((fixture) => fixture.id === nextFixture.id)
  const upcoming = fixtures.slice(nextIndex + 1, nextIndex + 4)
  const featuredPlayers = players.filter((player) => featuredPlayerIds.includes(player.id))
  const averageAge = Math.round(players.reduce((total, player) => total + getAge(player.birthDate), 0) / players.length)

  return (
    <>
      <section
        className="hero-stadium relative isolate overflow-hidden border-b border-white/10"
        style={{ backgroundImage: `linear-gradient(90deg, rgba(5,15,34,.98) 0%, rgba(7,21,47,.9) 42%, rgba(7,21,47,.38) 100%), url(${heroImage})` }}
      >
        <div className="hero-stripes" aria-hidden="true" />
        <div className="page-shell relative grid min-h-[690px] items-center gap-10 py-14 lg:grid-cols-[1.05fr_.8fr] lg:py-20">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="live-dot" aria-hidden="true" />
              <p className="eyebrow text-slate-300">Independent supporters’ desk · 2026/27</p>
            </div>
            <h1 className="mt-6 font-display text-[clamp(4.2rem,9vw,7.5rem)] font-black uppercase leading-[0.76] tracking-[-0.065em] text-white">
              Matchday
              <span className="block text-outline">starts here.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Every kickoff, every player, every deal. One home for culers who want the full picture before the whistle blows.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/fixtures" className="button-primary">
                Explore fixtures <ArrowRight size={17} />
              </Link>
              <Link to="/squad" className="button-secondary">
                Meet the squad
              </Link>
            </div>
            <a
              href="https://unsplash.com/photos/b84nM5W-AF0"
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-block text-[10px] text-white/35 transition hover:text-white/60"
            >
              Stadium photo by Fikri Rasyid / Unsplash
            </a>
          </div>

          <article className="next-match-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Next match</span>
              </div>
              <CompetitionPill competition={nextFixture.competition} />
            </div>

            <div className="mt-7 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                {formatFixtureDate(nextFixture, timezone)} · {nextFixture.round}
              </p>
              <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex min-w-0 flex-col items-center">
                  <TeamBadge code={nextFixture.homeCode} size="lg" />
                  <p className="mt-3 line-clamp-2 font-display text-lg font-black uppercase leading-none text-white">{nextFixture.home}</p>
                </div>
                <div>
                  <span className="font-display text-4xl font-black text-white/30">VS</span>
                </div>
                <div className="flex min-w-0 flex-col items-center">
                  <TeamBadge code={nextFixture.awayCode} size="lg" />
                  <p className="mt-3 line-clamp-2 font-display text-lg font-black uppercase leading-none text-white">{nextFixture.away}</p>
                </div>
              </div>
            </div>

            <div className="my-7 h-px bg-white/10" />
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-5xl font-black leading-none text-white">{formatFixtureTime(nextFixture, timezone)}</p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  {getTimezoneLabel(timezone)}
                </p>
              </div>
              {nextFixture.kickoff && <div className="w-48 max-w-[52%]"><Countdown kickoff={nextFixture.kickoff} /></div>}
            </div>
            <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-3 text-xs text-slate-300">
              <MapPin size={14} className="text-gold" />
              {nextFixture.venue}
            </div>
            <div className="mt-4"><TimezoneSelect dark /></div>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="page-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">On the horizon</p>
              <h2 className="section-title">The next three</h2>
            </div>
            <Link to="/fixtures" className="text-link">Full calendar <ArrowRight size={15} /></Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {upcoming.map((fixture) => <FixtureCard key={fixture.id} fixture={fixture} compact />)}
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-panel/45 py-16 sm:py-20">
        <div className="page-shell grid gap-6 lg:grid-cols-[.7fr_1.3fr]">
          <div className="rounded-3xl bg-gradient-to-br from-claret to-[#67002d] p-7 sm:p-9">
            <p className="eyebrow text-white/65">Season pulse</p>
            <h2 className="mt-4 font-display text-5xl font-black uppercase leading-[.9]">Form is a feeling.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/70">Six competitive matches. Six wins. The first team has opened the season at full speed.</p>
            <div className="mt-9 flex gap-2">
              {recentResults.map((result) => (
                <div key={result.opponent} className="flex-1 rounded-2xl bg-black/15 p-3">
                  <span className="grid size-7 place-items-center rounded-full bg-emerald-300 text-xs font-black text-emerald-950">{result.outcome}</span>
                  <p className="mt-4 font-display text-2xl font-black">{result.score}</p>
                  <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-white/55">{result.opponent}</p>
                </div>
              ))}
            </div>
            <Link to="/results" className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white transition hover:text-gold">
              See every result <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: UsersRound, value: players.length, label: 'First-team players', note: 'Official squad list' },
              { icon: ShieldCheck, value: averageAge, label: 'Average age', note: 'Youth meets experience' },
              { icon: CalendarDays, value: fixtures.length, label: 'Fixtures tracked', note: 'Local time enabled' },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="stat-card">
                  <span className="grid size-10 place-items-center rounded-xl bg-gold/10 text-gold"><Icon size={19} /></span>
                  <p className="mt-8 font-display text-5xl font-black text-white">{stat.value}</p>
                  <p className="mt-2 text-sm font-bold text-white">{stat.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="page-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">From La Masia to the world</p>
              <h2 className="section-title">Core of the XI</h2>
            </div>
            <Link to="/squad" className="text-link">View all {players.length} players <ArrowRight size={15} /></Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {featuredPlayers.map((player) => (
              <Link key={player.id} to="/squad" className="feature-player group">
                <img
                  src={player.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-y-0 right-0 h-full w-[58%] object-cover object-top opacity-45 transition duration-500 group-hover:scale-105 group-hover:opacity-60"
                />
                <span className="absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-panel/5" aria-hidden="true" />
                <div className="relative z-10 flex items-end justify-between">
                  <div>
                    <span className="text-4xl">{player.flag}</span>
                    <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-gold">#{player.number} · {player.role}</p>
                    <h3 className="mt-2 font-display text-4xl font-black uppercase leading-none text-white">{player.name}</h3>
                    <p className="mt-3 text-xs text-slate-400">{getAge(player.birthDate)} years old · {player.nationality}</p>
                  </div>
                  <span className="grid size-12 place-items-center rounded-full border border-white/10 text-gold transition group-hover:bg-gold group-hover:text-ink">
                    <ChevronRight size={20} />
                  </span>
                </div>
                <span className="absolute -right-3 -top-8 font-display text-[10rem] font-black leading-none text-white/[0.035]" aria-hidden="true">{player.number}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
