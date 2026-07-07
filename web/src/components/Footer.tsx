import { RELEASES_LATEST_PAGE } from "../lib/releases";

export function Footer({ version }: { version: string | null }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-txt-secondary md:flex-row">
        <span>이지 하네스 · needslab.ai</span>
        <div className="flex items-center gap-4">
          <a href={RELEASES_LATEST_PAGE} className="transition hover:text-txt-primary">
            GitHub 릴리스
          </a>
          {version && <span className="font-mono">{version}</span>}
          <span>© 2026 needslab</span>
        </div>
      </div>
    </footer>
  );
}
