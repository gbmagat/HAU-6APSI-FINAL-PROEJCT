"use client";

import { PageHeading } from "@/components/page-heading";
import { ProfileSettings } from "@/components/profile-settings";
import { usePassport } from "@/components/passport-provider";

export default function ProfilePage() {
  const { ready, serverMode } = usePassport();

  return (
    <main className="page-shell profile-page">
      <PageHeading
        eyebrow="Private by default"
        title="Our Private Profile"
        description={serverMode ? "Two members, shared details, and private preferences." : "Two members, shared details, and simple browser-preview preferences."}
      />
      {ready ? (
        <ProfileSettings />
      ) : (
        <section className="profile-settings" aria-live="polite">
          <div className="empty-state">
            <p>Loading settings…</p>
          </div>
        </section>
      )}
    </main>
  );
}
