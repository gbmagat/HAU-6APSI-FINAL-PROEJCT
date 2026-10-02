"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { MetricCard } from "@/components/metric-card";
import { PlaceCard } from "@/components/place-card";
import { PageHeading } from "@/components/page-heading";
import { VisitStatusBadge } from "@/components/status-badge";
import { usePassport } from "@/components/passport-provider";
import type { PassportMetric } from "@/lib/domain";
import { archiveTimeline, pickNextPlace } from "@/lib/places";

const archiveMetrics: PassportMetric[] = [
  { label: "Places visited", value: "", supportingText: "Museums, cafes, and walks", icon: "museum" },
  { label: "Shared stories", value: "", supportingText: "Notes worth keeping", icon: "star" },
];

export default function ArchivePage() {
  const { ready, places, posts } = usePassport();
  const visited = places.filter((place) => place.status === "visited");
  const timelinePlaces = archiveTimeline(places, posts);
  const nextPlace = pickNextPlace(places);

  return (
    <main className="page-shell passport-page">
      <PageHeading
        eyebrow="Everything we kept"
        title="Our Archive"
        description="A quiet record of where we went and what we kept."
      />

      <div className="passport-dashboard">
        <section className="passport-chapter" aria-labelledby="passport-chapter-title">
          <header>
            <div>
              <h2 id="passport-chapter-title">Our first chapter</h2>
              <p>{timelinePlaces.length ? "Our most recent visits." : "Nothing here yet. Log a visit to start the archive."}</p>
            </div>
            <strong>{String(visited.length).padStart(2, "0")} / {String(places.length).padStart(2, "0")}</strong>
          </header>
          <div className="progress-track" aria-label={`${visited.length} of ${places.length} places visited`}>
            <span style={{ width: `${places.length ? Math.round((visited.length / places.length) * 100) : 0}%` }} />
          </div>

          <div className="passport-timeline" id="timeline">
            {ready && timelinePlaces.map((place, index) => (
              <Link key={place.id} href={`/places/${place.slug}`} className="passport-timeline__item">
                <span className="passport-timeline__number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{place.name}</strong>
                  <small>{place.city} · {place.category}</small>
                </div>
                <VisitStatusBadge status={place.status} />
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <aside className="passport-summary" aria-label="Archive summary">
          <div className="passport-metrics">
            {archiveMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={{ ...metric, value: metric.label === "Places visited" ? String(visited.length).padStart(2, "0") : String(posts.length).padStart(2, "0") }} />
            ))}
          </div>
          {nextPlace && <><h2>Next place</h2><PlaceCard place={nextPlace} /></>}
        </aside>
      </div>
    </main>
  );
}
