import Link from "next/link";
import WaitlistForm from "@/components/waitlist-form";

export default function HomePage() {
  return (
    <main className="bg-white text-black">
      
      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-semibold tracking-tight mb-6">
          Buy now. Pay on your schedule.
        </h1>

        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          Plan your purchases around your paycheck — not your credit limit.
          No interest. No stress. Just control.
        </p>

        <div className="flex justify-center gap-4">
          <Link href="/demo">
            <button className="bg-black text-white px-6 py-3 rounded-lg">
              Try the Demo →
            </button>
          </Link>

          <a href="#waitlist">
            <button className="border px-6 py-3 rounded-lg">
              Get Early Access
            </button>
          </a>
        </div>
      </section>

      {/* PRODUCT PREVIEW */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <img
          src="/demo-preview.png"
          alt="SNPL Demo"
          className="rounded-xl shadow-lg"
        />
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-semibold mb-12">How it works</h2>

          <div className="grid md:grid-cols-4 gap-8 text-left">
            <div>
              <h3 className="font-medium mb-2">1. Choose</h3>
              <p className="text-gray-600">
                Pick what you want to buy.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2">2. Schedule</h3>
              <p className="text-gray-600">
                Select the date that works for you.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2">3. Authorize</h3>
              <p className="text-gray-600">
                Securely save your payment method.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2">4. Done</h3>
              <p className="text-gray-600">
                We charge you on your chosen date.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold mb-6">
          Because timing matters
        </h2>

        <p className="text-gray-600 text-lg">
          Most “buy now, pay later” tools lock you into fixed schedules.
          <br /><br />
          Your life doesn’t work that way.
          <br /><br />
          SNPL lets you plan purchases around your real cash flow.
        </p>
      </section>

      {/* DEMO CTA */}
      <section className="bg-black text-white py-20 text-center">
        <h2 className="text-3xl font-semibold mb-4">
          Try it yourself
        </h2>

        <p className="text-gray-300 mb-6">
          See how simple it is to schedule a purchase.
        </p>

        <Link href="/demo">
          <button className="bg-white text-black px-6 py-3 rounded-lg">
            Launch Demo →
          </button>
        </Link>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" className="py-24 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-4">
          Be first to use SNPL
        </h2>

        <p className="text-gray-600 mb-8">
          Get early access and updates as we build.
        </p>

        <WaitlistForm />
      </section>

    </main>
  );
}
