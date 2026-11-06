import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "KaamParchi | Repair job desk",
  description: "Voice-assisted customer instructions, repair handovers and maintenance approvals across service businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="app-header no-print">
          <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">k<span>p</span></span><span>KaamParchi<small>REPAIR JOB DESK</small></span></Link>
          <nav aria-label="Main navigation"><Link href="/">Job desk</Link><Link className="button small" href="/intake">+ New intake</Link></nav>
        </header>
        <main id="main">{children}</main>
        <footer className="app-footer no-print"><span>Built for the conversation before the repair.</span><span>Hackathon prototype · Browser-local records</span></footer>
      </body>
    </html>
  );
}
