"use client";

import { useState } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await fetch("/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center shadow-sm">
        <p className="font-medium text-slate-900">You’re in.</p>
        <p className="mt-2 text-sm text-slate-600">
          We’ll keep you updated as SNPL grows.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-xl flex-col items-center gap-3 sm:flex-row sm:justify-center"
    >
      <input
        type="email"
        required
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 sm:w-80"
      />

      <button
        type="submit"
        className="w-full rounded-xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-800 sm:w-auto"
      >
        Join Waitlist
      </button>
    </form>
  );
}
