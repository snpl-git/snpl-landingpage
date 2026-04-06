export default function Success() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-300">
            Authorization Complete
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            You’re all set
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-lg leading-8 text-slate-300">
            Your card was successfully authorized and your demo purchase is now scheduled.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white text-2xl">
              ✓
            </div>

            <h2 className="text-2xl font-semibold tracking-tight">
              Your purchase is scheduled
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-600">
              In this demo, your payment method has been securely authorized in Stripe test mode.
              Your scheduled payment will be processed on the date you selected.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-500">Step 1</p>
              <p className="mt-2 font-medium">Product selected</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-500">Step 2</p>
              <p className="mt-2 font-medium">Card authorized</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-500">Step 3</p>
              <p className="mt-2 font-medium">Payment scheduled</p>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-2xl font-semibold tracking-tight">
              Want early access to the full product?
            </h3>

            <p className="mt-4 text-base leading-7 text-slate-600">
              We’re building version 2 of SNPL now. Join the waitlist to get updates,
              follow progress, and be first to try what comes next.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="/#waitlist"
                className="inline-flex rounded-xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-800"
              >
                Join the Waitlist
              </a>

              <a
                href="/demo"
                className="inline-flex rounded-xl border border-slate-300 px-6 py-3 text-slate-900 transition hover:bg-slate-50"
              >
                Back to Demo
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
