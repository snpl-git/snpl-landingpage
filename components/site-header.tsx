import Link from "next/link";

type SiteHeaderProps = {
  showDemoLink?: boolean;
};

export default function SiteHeader({
  showDemoLink = true,
}: SiteHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <span
            className="text-lg font-semibold tracking-tight text-slate-900"
            style={{ letterSpacing: "-0.02em" }}
          >
            SNPL
          </span>
        </Link>

        {showDemoLink ? (
          <Link
            href="/demo"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Demo
          </Link>
        ) : null}
      </div>
    </header>
  );
}
