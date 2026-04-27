import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV = [
  { href: '#opportunities', label: 'Opportunities' },
  { href: '#workshops', label: 'Workshops' },
  { href: '#competitions', label: 'Competitions' },
  { href: '#networks', label: 'Networks' },
  { href: '#teams', label: 'Teams' },
  { href: '#about', label: 'About' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';

  return (
    <header className="sticky top-0 z-40 border-b border-space-border bg-space-bg/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0 text-space-text hover:text-space-accent transition-colors"
        >
          <span className="text-xl">🛸</span>
          <span className="font-bold text-sm sm:text-base hidden xs:block">EuroSpace Student Hub</span>
          <span className="font-bold text-sm xs:hidden">EuroSpace</span>
        </Link>

        {/* Desktop nav */}
        {!isAdmin && (
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-space-text hover:bg-space-card transition-colors"
              >
                {n.label}
              </a>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {!isAdmin ? (
            <Link
              to="/admin"
              className="hidden sm:flex items-center px-3 py-1.5 rounded-lg border border-space-border text-slate-400 text-xs hover:border-space-accent hover:text-space-accent transition-colors"
            >
              Admin
            </Link>
          ) : (
            <Link
              to="/"
              className="flex items-center px-3 py-1.5 rounded-lg border border-space-border text-slate-400 text-xs hover:border-space-accent hover:text-space-accent transition-colors"
            >
              ← Back
            </Link>
          )}

          {/* Mobile menu button */}
          {!isAdmin && (
            <button
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-space-text hover:bg-space-card"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {open && !isAdmin && (
        <div className="md:hidden border-t border-space-border bg-space-card px-4 py-3">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="block py-2 text-sm text-slate-400 hover:text-space-text"
              onClick={() => setOpen(false)}
            >
              {n.label}
            </a>
          ))}
          <Link
            to="/admin"
            className="block py-2 text-sm text-slate-400 hover:text-space-accent"
            onClick={() => setOpen(false)}
          >
            Admin →
          </Link>
        </div>
      )}
    </header>
  );
}
