import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d.split('|').map((p) => <path key={p} d={p} />)}
  </svg>
)
const ICONS = {
  dashboard: 'M3 13h8V3H3z|M13 21h8V11h-8z|M13 3h8v6h-8z|M3 21h8v-6H3z',
  calendar: 'M4 5h16v16H4z|M4 10h16|M9 3v4|M15 3v4',
  book: 'M12 5v14|M5 12h14',
  mine: 'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',
  reports: 'M4 20V10|M10 20V4|M16 20v-7|M22 20H2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
  masters: 'M3 21h18|M5 21V7l7-4 7 4v14|M9 21v-6h6v6|M9 10h.01|M15 10h.01',
  profile: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9',
}

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  const nav = [
    { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/calendar', label: 'Calendar', icon: 'calendar' },
    { to: '/book', label: 'Book', icon: 'book' },
    { to: '/my-bookings', label: 'My Bookings', icon: 'mine' },
    { to: '/reports', label: 'Reports', icon: 'reports' },
  ]
  const adminNav = [
    { to: '/admin/users', label: 'Users', icon: 'users' },
    { to: '/admin/masters', label: 'Halls & Masters', icon: 'masters' },
  ]

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive ? 'bg-white/15 text-white' : 'text-blue-100 hover:bg-white/10'
    }`

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-brand-700 p-4 text-white md:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <div className="leading-tight">
            <div className="font-bold">Venue Booking</div>
            <div className="text-xs text-blue-200">KNCET</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}><Icon d={ICONS[n.icon]} />{n.label}</NavLink>
          ))}
          {isAdmin && (
            <>
              <div className="mt-5 mb-1 px-3 text-xs font-semibold tracking-wider text-blue-300 uppercase">Admin</div>
              {adminNav.map((n) => (
                <NavLink key={n.to} to={n.to} className={linkCls}><Icon d={ICONS[n.icon]} />{n.label}</NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-white/15 pt-4">
          <NavLink to="/profile" className={({ isActive }) => `block rounded-xl px-2 py-1.5 hover:bg-white/10 ${isActive ? 'bg-white/15' : ''}`}>
            <div className="truncate text-sm font-semibold">{profile?.name}</div>
            <div className="truncate text-xs text-blue-200">{profile?.department} · {isAdmin ? 'Admin' : 'Staff'} · Edit profile</div>
          </NavLink>
          <button onClick={signOut} className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-blue-100 hover:bg-white/10">
            <Icon d={ICONS.logout} /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-brand-700 px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2.5">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="font-bold">Venue Booking</span>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <>
              <NavLink to="/admin/users" className="rounded-lg p-2 hover:bg-white/10" aria-label="Users"><Icon d={ICONS.users} /></NavLink>
              <NavLink to="/admin/masters" className="rounded-lg p-2 hover:bg-white/10" aria-label="Halls and masters"><Icon d={ICONS.masters} /></NavLink>
            </>
          )}
          <NavLink to="/profile" className="rounded-lg p-2 hover:bg-white/10" aria-label="My profile"><Icon d={ICONS.profile} /></NavLink>
          <button onClick={signOut} className="rounded-lg p-2 hover:bg-white/10" aria-label="Log out"><Icon d={ICONS.logout} /></button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-800 dark:bg-slate-900">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-brand-700 dark:text-blue-300' : 'text-slate-500'}`
            }
          >
            <Icon d={ICONS[n.icon]} />
            {n.label === 'My Bookings' ? 'Mine' : n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
