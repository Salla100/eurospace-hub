import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState('loading'); // loading | success | error | missing

  useEffect(() => {
    if (!email) {
      setStatus('missing');
      return;
    }
    api.unsubscribe(email)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [email]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <div className="text-4xl mb-4 animate-pulse">🛸</div>
            <p className="text-space-muted text-sm">Unsubscribing…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-5">👋</div>
            <h1 className="text-2xl font-bold text-space-text mb-2">You're unsubscribed</h1>
            <p className="text-space-muted text-sm mb-2">
              <span className="text-slate-300">{email}</span> has been removed from all EuroSpace notifications.
            </p>
            <p className="text-slate-600 text-xs mb-8">
              You won't receive any further emails from us. You can always re-subscribe from the hub.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-space-accent text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
            >
              Back to the Hub →
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-5">⚠️</div>
            <h1 className="text-2xl font-bold text-space-text mb-2">Something went wrong</h1>
            <p className="text-space-muted text-sm mb-8">
              We couldn't process your request. Please try again or contact us directly.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-space-border text-slate-300 text-sm hover:border-space-accent hover:text-space-accent transition-colors"
            >
              Back to the Hub
            </Link>
          </>
        )}

        {status === 'missing' && (
          <>
            <div className="text-5xl mb-5">🔍</div>
            <h1 className="text-2xl font-bold text-space-text mb-2">No email address found</h1>
            <p className="text-space-muted text-sm mb-8">
              This unsubscribe link appears to be invalid or incomplete.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-space-border text-slate-300 text-sm hover:border-space-accent hover:text-space-accent transition-colors"
            >
              Back to the Hub
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
