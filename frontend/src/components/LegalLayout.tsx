import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import BrandMark from "./BrandMark";
import { ChevronLeftIcon } from "./icons";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * The Privacy Policy and Terms of Use: open to everyone, signed in or not, so
 * they can be read from the sign-in page.
 */
export default function LegalLayout({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  const { user } = useAuth();
  const home = user ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to={home} className="flex min-w-0 items-center gap-3">
            <BrandMark size="sm" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-gray-900">Kibuli Secondary School</span>
              <span className="block truncate text-xs text-gray-500">Procurement System</span>
            </span>
          </Link>
          <Link to={home} className="btn btn-secondary btn-sm shrink-0">
            <ChevronLeftIcon className="h-4 w-4" />
            {user ? "Back to the app" : "Back to sign in"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">On this page</p>
              <ol className="mt-3 space-y-2 text-sm">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="flex gap-2 text-gray-600 transition hover:text-green-800">
                      <span className="w-4 shrink-0 text-right tabular-nums text-gray-400">{i + 1}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="card px-6 py-8 sm:px-10 sm:py-12">
            <p className="text-sm font-medium text-green-700">Last updated {updated}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{title}</h1>
            <div className="mt-4 space-y-3 text-base leading-7 text-gray-600">{intro}</div>

            <div className="mt-10 space-y-10 border-t border-gray-100 pt-10">
              {sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2 className="flex gap-3 text-lg font-semibold text-gray-900">
                    <span className="tabular-nums text-green-700">{i + 1}.</span>
                    {s.title}
                  </h2>
                  <div className="legal-body mt-3 space-y-3 text-[15px] leading-7 text-gray-600">{s.body}</div>
                </section>
              ))}
            </div>
          </article>
        </div>

        <footer className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-gray-500 lg:pl-[15.5rem]">
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-gray-900">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-gray-900">
              Terms of Use
            </Link>
          </div>
          <p className="text-xs text-gray-400">Kibuli Secondary School · P.O. Box 4216, Kampala, Uganda · 0414 257339</p>
        </footer>
      </main>
    </div>
  );
}

/** A bulleted list in the legal pages' style. */
export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-green-700">{children}</ul>;
}
