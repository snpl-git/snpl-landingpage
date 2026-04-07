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
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-slate-900"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-sm text-white">
            ✓
          </div>
          <span>SNPL</span>
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
