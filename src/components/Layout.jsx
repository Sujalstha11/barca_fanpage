import { CalendarDays, FileClock, Home, Menu, Trophy, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import BrandMark from './BrandMark.jsx'

const navigation = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/fixtures', label: 'Fixtures', icon: CalendarDays },
  { to: '/results', label: 'Results', icon: Trophy },
  { to: '/squad', label: 'Squad', icon: UsersRound },
  { to: '/contracts', label: 'Contracts', icon: FileClock },
]

function DesktopNavLink({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `relative px-1 py-7 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
          isActive ? 'text-white' : 'text-slate-400 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {item.label}
          <span
            className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gold transition-transform ${
              isActive ? 'scale-x-100' : 'scale-x-0'
            }`}
          />
        </>
      )}
    </NavLink>
  )
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-ink text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-ink/90 backdrop-blur-xl">
        <div className="page-shell flex h-[72px] items-center justify-between">
          <NavLink to="/" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            <BrandMark />
          </NavLink>

          <nav className="hidden items-center gap-6 lg:gap-9 md:flex" aria-label="Primary navigation">
            {navigation.map((item) => <DesktopNavLink key={item.to} item={item} />)}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <span className="live-dot" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">2026/27 season</span>
          </div>

          <button
            type="button"
            className="grid size-11 place-items-center rounded-xl border border-white/10 text-white transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <nav id="mobile-menu" className="border-t border-white/8 bg-panel px-4 py-3 md:hidden" aria-label="Mobile navigation">
            <div className="mx-auto grid max-w-lg gap-1">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${
                        isActive ? 'bg-gold text-ink' : 'text-slate-300 hover:bg-white/6 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={18} />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </nav>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-white/8 bg-[#050f22] pb-8 pt-12">
        <div className="page-shell grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
              Made by fans, for fans. Fixtures, results, squad details, and contract insights in one calm matchday companion.
            </p>
          </div>
          <div>
            <p className="eyebrow">Explore</p>
            <div className="mt-4 grid gap-2 text-sm text-slate-400">
              {navigation.slice(1).map((item) => (
                <NavLink key={item.to} to={item.to} className="w-fit transition-colors hover:text-white">
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">The fine print</p>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Independent, unofficial fan project. Not affiliated with or endorsed by FC Barcelona. Salary figures are media estimates.
            </p>
            <p className="mt-3 text-[10px] leading-5 text-slate-600">
              Player portraits from FC Barcelona. Club crests via{' '}
              <a href="https://footylogos.com/" target="_blank" rel="noreferrer" className="underline transition hover:text-slate-300">FootyLogos</a>.
            </p>
          </div>
        </div>
        <div className="page-shell mt-10 flex flex-col gap-2 border-t border-white/8 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Culer Collective</span>
          <span>Més que una afició.</span>
        </div>
      </footer>
    </div>
  )
}
