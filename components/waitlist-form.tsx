"use client";

import { useState } from "react";

export default function WaitlistForm() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          email,
          useCase,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to join waitlist");
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
          You’re in
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Thanks for joining the waitlist
        </h3>
        <p className="mt-4 text-base leading-7 text-slate-600">
          We’ll keep you updated as SNPL grows and let you know when early access opens.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 text-left"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            First name
          </label>
          <input
            type="text"
            placeholder="Your first name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          What would you use SNPL for?
        </label>
        <select
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
        >
          <option value="">Select one</option>
          <option value="electronics">Electronics</option>
          <option value="household">Household purchases</option>
          <option value="gifts">Gifts</option>
          <option value="timing">Payday timing</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-500">
          Join the list for early access, product updates, and launch news.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex rounded-xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Joining..." : "Join Waitlist"}
        </button>
      </div>
    </form>
  );
}
