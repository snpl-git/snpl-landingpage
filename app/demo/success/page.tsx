export default function Success() {
  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-2xl font-semibold">You're all set!</h1>
      <p className="mt-2">
        Your card is authorized and your purchase is scheduled (test mode).
        We’ll charge your card on your selected date.
      </p>
      <a className="underline mt-6 inline-block" href="/demo">
        Back to demo
      </a>
    </main>
  )
}

