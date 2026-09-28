"use client";

import { MapExplorer } from "@/components/map-explorer";
import { PageHeading } from "@/components/page-heading";
import { usePassport } from "@/components/passport-provider";

export default function MapPage() {
  const { ready, places, settings } = usePassport();
  return (
    <main className="page-shell map-page">
      <PageHeading
        eyebrow="Explore together"
        title="Our Shared Map"
        description="Find saved places, filter by status, and choose what comes next."
      />
      {ready ? <MapExplorer places={places} locationEnabled={settings.locationEnabled} /> : <div className="loading-panel" role="status">Loading our places map…</div>}
    </main>
  );
}
