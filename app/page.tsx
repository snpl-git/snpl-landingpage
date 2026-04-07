import Link from "next/link";
import WaitlistForm from "@/components/waitlist-form";
import SiteHeader from "@/components/site-header";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-slate-300">
            Schedule Now, Pay Later
          </p>

          <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Buy now. Pay on your schedule.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Choose what you want today. Pick the date that works for you.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex rounded-xl bg-white px-6 py-3 text-slate-900 transition duration-200 hover:bg-slate-100"
            >
              Try the Demo
            </Link>

            <a
              href="#waitlist"
              className="inline-flex rounded-xl border border-slate-500 px-6 py-3 text-white transition duration-200 hover:bg-slate-800"
            >
              Get Early Access
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <img
            src="/demo-preview.png"
            alt="SNPL demo preview"
            className="w-full object-cover"
          />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              How it works
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["1", "Choose", "Pick the product you want."],
              ["2", "Schedule", "Select the date that works for you."],
              ["3", "Authorize", "Save your payment method securely."],
              ["4", "Done", "Your purchase is charged on that date."],
            ].map(([step, title, text]) => (
              <div
                key={step}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {step}
                </div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          Timing matters
        </h2>

        <p className="mt-6 text-lg leading-8 text-slate-600">
          Most payment options tell you when to pay.
          <br />
          SNPL lets you choose.
        </p>
      </section>

      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Try the product
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            See how simple it is to schedule a purchase in seconds.
          </p>

          <div className="mt-8">
            <Link
              href="/demo"
              className="inline-flex rounded-xl bg-white px-6 py-3 text-slate-900 transition duration-200 hover:bg-slate-100"
            >
              Launch Demo
            </Link>
          </div>
        </div>
      </section>

      <section id="waitlist" className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
          Early access
        </p>

        <h2 className="mt-3 text-4xl font-semibold tracking-tight">
          Be first to try SNPL
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Join the waitlist to get launch updates, early access, and help shape what comes next.
        </p>

        <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Early access</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Be first to try the product as it evolves.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Launch updates</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Follow the build and know what’s coming next.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Shape version 2</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Help influence how the product grows from here.
            </p>
          </div>
        </div>

        <div className="mt-10">
          <WaitlistForm />
        </div>
      </section>
    </main>
  );
}
