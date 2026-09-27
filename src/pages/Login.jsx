import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.message || "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display text-3xl tracking-tight text-ink">Zeno</p>
          <p className="text-xs text-muted mt-0.5 tracking-wide uppercase">Ledger</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-lg p-6 space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Username</label>
            <input
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line focus:outline-none focus:border-moss"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-paper rounded-md border border-line focus:outline-none focus:border-moss"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-clay-light border border-clay/30 text-clay rounded-lg px-3 py-2 text-sm flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-ink text-paper text-sm font-medium py-2.5 rounded-md hover:bg-moss-dark disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
