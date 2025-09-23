export default function ThankYouPage() {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow p-10 max-w-lg text-center">
        <h1 className="text-3xl font-extrabold">You're on the list! 🎉</h1>
        <p className="mt-3 text-gray-700">
          Thanks for joining the SNPL Holiday waitlist. We just sent a confirmation email.
        </p>
        <a href="/" className="inline-flex items-center justify-center px-5 py-3 font-semibold rounded-xl shadow mt-6 bg-redbrand text-white">Back to Home</a>
      </div>
    </main>
  );
}
