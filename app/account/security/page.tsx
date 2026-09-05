import PasskeyManager from './passkey-manager'

export default function AccountSecurityPage() {
  return <section>
    <h2 className="text-2xl font-semibold">Security</h2>
    <p className="mt-2 text-slate-600">Use a passkey for your fastest, phishing-resistant sign-in.</p>
    <PasskeyManager />
  </section>
}
