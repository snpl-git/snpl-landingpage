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
    return <p className="text-green-600">You're in.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex justify-center gap-2">
      <input
        type="email"
        required
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border px-4 py-3 rounded-lg w-72"
      />

      <button
        type="submit"
        className="bg-black text-white px-6 py-3 rounded-lg"
      >
        Join
      </button>
    </form>
  );
}
