import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV = [
  { href: '#opportunities', label: 'Opportunities' },
  { href: '#esa-academy', label: 'ESA Academy' },
  { href: '#competitions', label: 'Competitions' },
  { href: '#networks', label: 'Networks' },
  { href: '#teams', label: 'Teams' },
  { href: '#internships', label: 'Internships' },
  { href: '#subscribe', label: 'Subscribe' },
];

const HEADER_H = 56;

export default function Header() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';

  useEffect(() => {
    document.documentElement.style.setProperty('--header-h', `${HEADER_H}px`);

    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > lastY.current && y > HEADER_H * 2;
      if (goingDown !== hidden) {
        setHidden(goingDown);
        document.documentElement.style.setProperty('--header-h', goingDown ? '0px' : `${HEADER_H}px`);
      }
      lastY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hidden]);

  // Close mobile menu on nav click
  const handleNavClick = () => setOpen(false);

  return (
    <header
      className="sticky top-0 z-40 border-b border-space-border bg-space-bg/90 backdrop-blur-md"
      style={{
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.25s ease',
        height: `${HEADER_H}px`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-full gap-6">
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
              className="block py-2.5 text-sm text-slate-400 hover:text-space-text border-b border-space-border/50 last:border-0"
              onClick={handleNavClick}
            >
              {n.label}
            </a>
          ))}
          <Link
            to="/admin"
            className="block py-2.5 text-sm text-slate-400 hover:text-space-accent"
            onClick={handleNavClick}
          >
            Admin →
          </Link>
        </div>
      )}
    </header>
  );
}
