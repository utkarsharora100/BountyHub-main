// ─── Main Layout with Navbar ─────────────────────────────────
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, Menu, X, Search, Trophy, PlusCircle, User, LogOut } from 'lucide-react';
import { useState } from 'react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/bounties', label: 'Bounties' },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/search', label: 'Search', icon: Search },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary-600 dark:text-primary-400">
              <Trophy className="w-6 h-6" />
              <span className="hidden sm:inline">BountyHub</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    router.pathname === link.href
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {user ? (
                <>
                  <Link href="/bounties/new" className="btn-primary text-sm hidden sm:flex gap-1">
                    <PlusCircle className="w-4 h-4" />
                    Post Bounty
                  </Link>
                  <Link href={`/profile/${user.id}`} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <User className="w-5 h-5" />
                  </Link>
                  <button onClick={handleLogout} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login" className="btn-secondary text-sm">Log In</Link>
                  <Link href="/register" className="btn-primary text-sm">Sign Up</Link>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-1 animate-fade-in">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <Link href="/bounties/new" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-primary-600 dark:text-primary-400">
                + Post Bounty
              </Link>
            )}
          </nav>
        )}
      </header>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} BountyHub — Multi-University Collaboration Platform.
          <span className="block mt-1 text-xs">ADBMS Project • Scalable Database Architecture</span>
        </div>
      </footer>
    </div>
  );
}
