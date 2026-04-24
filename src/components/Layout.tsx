import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Home,
  LogOut,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/tableau-de-bord', label: 'Accueil', icon: Home },
  { to: '/commandes', label: 'Commandes', icon: ShoppingBag },
  { to: '/recettes', label: 'Recettes', icon: BookOpen },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/finances', label: 'Finances', icon: Wallet },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cream text-warm-brown">
      {/* Desktop / tablet top bar */}
      <header className="hidden md:flex sticky top-0 z-30 items-center justify-between border-b border-soft-taupe/60 bg-cream/90 backdrop-blur px-8 py-4 pt-safe">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-dusty-pink/20 font-serif text-xl text-warm-brown"
          >
            D
          </div>
          <span className="font-serif text-2xl tracking-tight">Douceur</span>
        </div>

        <div className="flex items-center gap-4">
          {user?.email && (
            <span className="text-sm text-warm-brown/70">{user.email}</span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Se déconnecter"
            className="inline-flex items-center gap-2 rounded-2xl border border-soft-taupe bg-white px-4 py-2 text-sm font-medium text-warm-brown shadow-soft transition hover:bg-soft-taupe/40 min-h-[44px]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </header>

      <div className="md:flex">
        {/* Desktop / tablet sidebar */}
        <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col gap-1 border-r border-soft-taupe/60 bg-cream/50 px-4 py-6">
          <nav className="flex flex-col gap-1" aria-label="Navigation principale">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition min-h-[44px]',
                    isActive
                      ? 'bg-dusty-pink/20 text-warm-brown'
                      : 'text-warm-brown/70 hover:bg-soft-taupe/40 hover:text-warm-brown',
                  ].join(' ')
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12 pl-safe pr-safe pt-safe md:pt-8">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-soft-taupe/70 bg-cream/95 backdrop-blur pb-safe"
      >
        <ul className="grid grid-cols-5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                aria-label={label}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition min-h-[56px]',
                    isActive
                      ? 'text-dusty-pink'
                      : 'text-warm-brown/60 hover:text-warm-brown',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        'flex h-9 w-9 items-center justify-center rounded-2xl transition',
                        isActive ? 'bg-dusty-pink/20' : 'bg-transparent',
                      ].join(' ')}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
