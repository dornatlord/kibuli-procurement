import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ROLE_ORDER, ROLE_LABELS, ROLE_DESCRIPTIONS } from "../lib/permissions";
import BrandMark from "../components/BrandMark";
import { useOnline } from "../lib/online";
import {
  AlertIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  SpinnerIcon,
  WifiOffIcon,
} from "../components/icons";

/** What the system carries a purchase through, shown beside the form. */
const JOURNEY = [
  {
    title: "Raise the request",
    detail: "Departments fill in TFORM 5 and pick items straight from the price list.",
  },
  {
    title: "Get it approved",
    detail: "Head of Department, Accounting Officer and, for macro buys, the Contracts Committee.",
  },
  {
    title: "Order and receive",
    detail: "Purchase orders go out and every delivery is checked in.",
  },
  {
    title: "Pay and report",
    detail: "Invoices are matched before payment, and the monthly PPDA report builds itself.",
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const online = useOnline();

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
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* Sign-in */}
      <div className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900">Kibuli Secondary School</div>
            <div className="text-xs text-gray-500">Procurement &amp; Disposal Unit</div>
          </div>
        </div>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Use the account your administrator set up for you.
            </p>

            {!online && (
              <div
                role="status"
                className="mt-6 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900"
              >
                <WifiOffIcon className="mt-px h-[18px] w-[18px] shrink-0" />
                <span>You're offline. Connect to the internet to sign in.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="label">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input h-11"
                  placeholder="you@kibuliss.sch.ug"
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-gray-400 transition hover:text-gray-700 focus-visible:text-green-700 focus-visible:outline-none"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-[18px] w-[18px]" />
                    ) : (
                      <EyeIcon className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                >
                  <AlertIcon className="mt-px h-[18px] w-[18px] shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary h-11 w-full text-[15px]">
                {loading && <SpinnerIcon />}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Can't sign in? Contact the system administrator.
            </p>

            <div className="mt-10 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setShowRoles((s) => !s)}
                aria-expanded={showRoles}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
              >
                What can each access level do?
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${showRoles ? "rotate-180" : ""}`}
                />
              </button>
              {showRoles && (
                <ul className="space-y-3 border-t border-gray-200 px-4 py-4">
                  {ROLE_ORDER.map((role) => (
                    <li key={role}>
                      <div className="text-sm font-medium text-gray-900">{ROLE_LABELS[role]}</div>
                      <div className="text-[13px] leading-5 text-gray-500">{ROLE_DESCRIPTIONS[role]}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>

        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Kibuli Secondary School · Public Procurement and Disposal of
          Public Assets Act, 2003
        </p>
      </div>

      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-green-900 text-white lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(rgb(255 255 255) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div aria-hidden="true" className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-green-600/30 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-green-400/10 blur-3xl" />

        <div className="relative max-w-lg">
          <p className="text-sm font-medium text-green-300">Procurement Management System</p>
          <h2 className="mt-3 text-4xl font-semibold leading-[1.15] tracking-tight">
            Every purchase, from request to payment, in one place.
          </h2>
          <p className="mt-4 text-base leading-7 text-green-100/75">
            Built around the forms the PPDA asks for, so the records keep themselves.
          </p>

          <ol className="mt-10 rounded-2xl bg-white/[0.06] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
            {JOURNEY.map((step, i) => (
              <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
                {i < JOURNEY.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-9 -ml-px h-[calc(100%-2.25rem)] w-px bg-white/15"
                  />
                )}
                <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green-700 text-sm font-semibold ring-1 ring-inset ring-white/20">
                  {i + 1}
                </span>
                <div className="pt-1">
                  <div className="text-sm font-semibold">{step.title}</div>
                  <div className="mt-0.5 text-sm leading-6 text-green-100/70">{step.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
