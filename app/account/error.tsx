'use client'

export default function AccountError({ reset }: { error: Error; reset: () => void }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
    <h2 className="font-semibold text-red-900">We couldn’t load your account</h2>
    <p className="mt-2 text-sm text-red-700">Please try again. Your purchase information has not been changed.</p>
    <button onClick={reset} className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white">Try again</button>
  </div>
}
