"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type SiteHeaderProps = {
  showDemoLink?: boolean;
};

export default function SiteHeader({
  showDemoLink = true,
}: SiteHeaderProps) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getClaims().then(({ data }) => setSignedIn(Boolean(data?.claims?.sub)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <span
            className="text-lg font-semibold tracking-tight text-slate-900"
            style={{ letterSpacing: "-0.02em" }}
          >
            SNPL
          </span>
        </Link>

        <nav className="flex items-center gap-5">
          {showDemoLink ? <Link href="/demo" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">Demo</Link> : null}
          <Link href={signedIn ? "/account" : "/login"} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">{signedIn ? "Account" : "Sign in"}</Link>
        </nav>
      </div>
    </header>
  );
}
