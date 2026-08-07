import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ROLE_ORDER, ROLE_LABELS, ROLE_DESCRIPTIONS } from "../lib/permissions";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRoles, setShowRoles] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 items-start">
        {/* Sign-in card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-green-800">
              Kibuli Secondary School
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Procurement Management System
            </p>
            <p className="text-xs text-gray-400 mt-1">PPDA Act 2003 — TFORM 5</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="you@kibuliss.sch.ug"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg font-medium text-sm disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
            Your access level is set by the administrator. If you cannot sign in
            or need different permissions, contact them directly.
          </p>

          <button
            type="button"
            onClick={() => setShowRoles((s) => !s)}
            className="md:hidden w-full mt-4 text-xs text-green-700 underline"
          >
            {showRoles ? "Hide access levels" : "What are the access levels?"}
          </button>
        </div>

        {/* Access levels reference */}
        <div
          className={`bg-green-800/40 border border-green-700 rounded-xl p-6 text-white ${
            showRoles ? "block" : "hidden md:block"
          }`}
        >
          <h2 className="font-semibold text-sm mb-1">Access Levels</h2>
          <p className="text-green-200 text-xs mb-4">
            Every account is assigned one level by the administrator. It decides
            what you can see and do.
          </p>
          <ul className="space-y-3">
            {ROLE_ORDER.map((role) => (
              <li key={role} className="flex gap-3">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                    role === "administrator" ? "bg-amber-300" : "bg-green-400"
                  }`}
                />
                <div>
                  <div className="text-xs font-semibold text-white">
                    {ROLE_LABELS[role]}
                  </div>
                  <div className="text-[11px] text-green-200 leading-snug">
                    {ROLE_DESCRIPTIONS[role]}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
