import { Heart } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { SignOutButton } from "@/components/sign-out-button";
import { DataStatus } from "@/components/data-status";
import { PassportProvider } from "@/components/passport-provider";
import { getCurrentSession } from "@/lib/session";

export default async function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") {
    let session;
    try {
      session = await getCurrentSession();
    } catch {
      redirect("/login?reason=unavailable");
    }
    if (!session) redirect("/login");
  }
  return (
    <PassportProvider serverMode={Boolean(process.env.DATABASE_URL)}><div className="app-shell">
      {!process.env.DATABASE_URL && <div className="preview-banner" role="status">
        Frontend preview · changes are saved only in this browser
      </div>}
      <SiteHeader />
      <DataStatus />
      {children}
      <footer className="site-footer">
        <div>
          <p>Two perspectives. One shared story.</p>
          <span>© 2026 Our Places</span>
          <Link href="/profile" aria-label="Privacy and profile settings">
            <Heart size={18} aria-hidden="true" />
            Private to both of you
          </Link>
          <SignOutButton />
        </div>
      </footer>
    </div></PassportProvider>
  );
}
