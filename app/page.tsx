"use client";
import Image from "next/image";
import { useState } from "react";

export default function Page() {
  const [status, setStatus] = useState<null | "ok" | "error" | "sending">(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    try {
      setStatus("sending");
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("ok");
        const email = (payload as any).email as string;
        // Redirect to /thank-you page with email as query param
        window.location.href = `/thank-you?email=${encodeURIComponent(email)}`;
        return;
      } else {
        console.error("Subscribe error:", data);
        setStatus("error");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setStatus("error");
    }
  }

  return (
    <main id="top">
      {/* NAV */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-red-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="#top" className="text-2xl font-extrabold">
            SNPL<span className="text-redbrand">🎁</span>
          </a>
          <nav className="space-x-5 text-sm font-semibold">
            <a href="#how" className="hover:text-redbrand">
              How It Works
            </a>
            <a href="#benefits" className="hover:text-redbrand">
              Why It Helps
            </a>
            <a href="#faq" className="hover:text-redbrand">
              FAQ
            </a>
            <a
              href="#cta"
              className="inline-flex items-center justify-center px-5 py-3 font-semibold rounded-xl shadow bg-redbrand text-white"
            >
              Join the Holiday Waitlist
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-50 to-cream pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Lock In Holiday Gifts Now.
              <br />
              Pay When You’re Ready.
            </h1>
            <p className="mt-4 text-lg text-gray-700">
              Avoid last-minute shopping stress and price hikes. Reserve your
              gifts today—don’t pay until they ship.
            </p>
            <div className="mt-8 space-x-3">
              <a
                href="#cta"
                className="inline-flex items-center justify-center px-5 py-3 font-semibold rounded-xl shadow bg-redbrand text-white"
              >
                Join the Holiday Waitlist
              </a>
              <a
                href="#how"
                className="inline-flex items-center justify-center px-5 py-3 font-semibold rounded-xl shadow bg-white text-redbrand border-2 border-redbrand"
              >
                How It Works
              </a>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              By joining, you agree to our{" "}
              <a className="underline" href="#terms">
                Terms
              </a>{" "}
              &{" "}
              <a className="underline" href="#privacy">
                Privacy Policy
              </a>
              .
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <Image
              alt="Wrapped gifts with a reserved tag under a holiday tree"
              src="https://images.unsplash.com/photo-1543589077-47d81606c1bf?q=80&w=1600&auto=format&fit=crop"
              width={1600}
              height={1066}
              priority
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-white border-t">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-extrabold text-center">How It Works</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            <div className="bg-red-50 rounded-2xl p-6">
              <div className="text-4xl">🛍️</div>
              <h3 className="mt-3 font-bold text-lg">Pick Your Gift</h3>
              <p className="text-gray-700">
                Choose from participating partner stores or paste a product
                link.
              </p>
              <a
                className="inline-block mt-3 text-redbrand font-semibold underline"
                href="#partners"
              >
                View partner stores →
              </a>
            </div>
            <div className="bg-green-50 rounded-2xl p-6">
              <div className="text-4xl">🏷️</div>
              <h3 className="mt-3 font-bold text-lg">Lock in Today’s Price</h3>
              <p className="text-gray-700">
                Schedule your order now and secure current pricing.
              </p>
              <a
                className="inline-block mt-3 text-greenbrand font-semibold underline"
                href="#price-protection"
              >
                How price protection works →
              </a>
            </div>
            <div className="bg-yellow-50 rounded-2xl p-6">
              <div className="text-4xl">💳</div>
              <h3 className="mt-3 font-bold text-lg">Pay Later, Stress-Free</h3>
              <p className="text-gray-700">
                We charge only when your order ships on your chosen date.
              </p>
              <a
                className="inline-block mt-3 text-yellow-700 font-semibold underline"
                href="#billing"
              >
                Billing & timing →
              </a>
            </div>
          </div>
          <div className="text-center mt-10">
            <a
              href="#cta"
              className="inline-flex items-center justify-center px-5 py-3 font-semibold rounded-xl shadow bg-redbrand text-white"
            >
              Get Early Access
            </a>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="benefits" className="bg-white">
        <div className="max-w-6xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-3xl font-extrabold">Why Shoppers Love This</h2>
            <ul className="mt-6 space-y-3 text-lg">
              <li>✔️ Protects you from price hikes</li>
              <li>✔️ Helps spread out holiday costs</li>
              <li>✔️ Eliminates last-minute shopping panic</li>
              <li>✔️ Pay only when you’re ready</li>
            </ul>
          </div>
          <aside className="bg-cream border rounded-2xl p-6 shadow-sm">
            <blockquote className="italic">
              “I used this to grab toys for my kids early without blowing my
              November budget.”
            </blockquote>
            <p className="mt-2 font-semibold">— Lisa, NY</p>
          </aside>
        </div>
      </section>

      {/* CALLOUT */}
      <section className="relative">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="rounded-2xl bg-gradient-to-r from-greenbrand to-redbrand text-white p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <p className="text-xl font-semibold">
              Popular toys and electronics sell out fast. Schedule yours today
              and relax while everyone else scrambles.
            </p>
            <a
              href="#cta"
              className="inline-flex items-center justify-center px-5 py-3 font-semibold rounded-xl shadow bg-white text-redbrand mt-4 lg:mt-0"
            >
              Reserve My Spot
            </a>
          </div>
        </div>
      </section>

      {/* CTA FORM */}
      <section id="cta" className="bg-white border-t">
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl font-extrabold">Join the Holiday Waitlist</h2>
          <p className="mt-2 text-gray-700">
            Get early access and pilot-only perks. We’ll email you as soon as
            your invite is ready.
          </p>
          <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 gap-3">
            <input
              required
              name="name"
              type="text"
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl border"
            />
            <input
              required
              name="email"
              type="email"
              placeholder="Your email"
              className="w-full px-4 py-3 rounded-xl border"
            />
            <select name="interest" className="w-full px-4 py-3 rounded-xl border">
              <option value="holiday">Holiday gifts</option>
              <option value="bts">Back-to-School</option>
              <option value="events">Weddings & Events</option>
              <option value="smallbiz">Small Business</option>
            </select>
            <button
              className="inline-flex items-center justify-center px-5 py-3 font-semibold rounded-xl shadow bg-redbrand text-white"
              type="submit"
            >
              {status === "sending" ? "Sending..." : "Get Early Access"}
            </button>
            {status === "error" && (
              <p className="text-red-700 text-sm">
                Something went wrong. Try again.
              </p>
            )}
            <a
              className="text-sm underline text-gray-600"
              href="mailto:hello@example.com?subject=SNPL%20Holiday%20Pilot"
            >
              Prefer email? Contact us
            </a>
          </form>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white border-t">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-extrabold text-center">FAQ</h2>
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border">
              <h3 className="font-bold">Do I pay anything today?</h3>
              <p className="text-gray-700 mt-2">
                No. During the pilot, you only pay when your order ships.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border">
              <h3 className="font-bold">What if I change my mind?</h3>
              <p className="text-gray-700 mt-2">
                You can cancel a scheduled purchase any time before it ships.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border">
              <h3 className="font-bold">Is there a fee?</h3>
              <p className="text-gray-700 mt-2">
                Pilot access is free. Future convenience fees may apply.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS / POLICY */}
      <section id="partners" className="bg-white border-t">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-extrabold">Partner Stores (Sample)</h2>
          <ul className="mt-3 list-disc ml-6 text-gray-700">
            <li>
              <a
                className="underline"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Demo link – replace with real partner URL");
                }}
              >
                ToyGalaxy
              </a>
            </li>
            <li>
              <a
                className="underline"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Demo link – replace with real partner URL");
                }}
              >
                GizmoHub
              </a>
            </li>
            <li>
              <a
                className="underline"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Demo link – replace with real partner URL");
                }}
              >
                CozyHome
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section id="price-protection" className="bg-white border-t">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-extrabold">Price Protection</h2>
          <p className="mt-2 text-gray-700">
            We secure today’s listed price at time of scheduling. If the price
            drops before ship date, we honor the lower price.*
          </p>
          <p className="text-xs text-gray-500 mt-2">
            *Sample policy for mockup purposes. Replace with your real terms.
          </p>
        </div>
      </section>

      <section id="billing" className="bg-white border-t">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-extrabold">Billing & Timing</h2>
          <p className="mt-2 text-gray-700">
            Choose a ship window at checkout. We’ll charge your saved payment
            method when the order ships.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-xl font-extrabold">SNPL</div>
            <p className="mt-2 text-sm text-gray-400">
              Holiday pilot mockup for demonstration.
            </p>
          </div>
          <div>
            <h4 className="font-bold">Company</h4>
            <ul className="space-y-2 mt-2 text-sm">
              <li>
                <a className="underline" href="#partners">
                  Partners
                </a>
              </li>
              <li>
                <a className="underline" href="#price-protection">
                  Price Protection
                </a>
              </li>
              <li>
                <a className="underline" href="#billing">
                  Billing & Timing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold">Legal</h4>
            <ul className="space-y-2 mt-2 text-sm">
              <li>
                <a
                  id="terms"
                  className="underline"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Terms placeholder – replace with real URL");
                  }}
                >
                  Terms
                </a>
              </li>
              <li>
                <a
                  id="privacy"
                  className="underline"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Privacy placeholder – replace with real URL");
                  }}
                >
                  Privacy
                </a>
              </li>
              <li>
                <a
                  className="underline"
                  href="mailto:hello@example.com?subject=SNPL%20Support"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 text-center text-xs py-4">
          © {new Date().getFullYear()} SNPL Holiday Pilot
        </div>
      </footer>
    </main>
  );
}
