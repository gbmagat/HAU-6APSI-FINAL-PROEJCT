"use client";

import { ExperienceFeed } from "@/components/experience-feed";
import { PageHeading } from "@/components/page-heading";
import { usePassport } from "@/components/passport-provider";

export default function FeedPage() {
  const { ready } = usePassport();

  return (
    <main className="page-shell feed-page">
      <PageHeading
        eyebrow="Shared stories"
        title="The Memory Wall"
        description="A shared place for meals, exhibits, walks, and the small details we never want to lose."
      />
      {ready ? <ExperienceFeed /> : <div className="loading-panel" role="status">Loading our shared places…</div>}
    </main>
  );
}
