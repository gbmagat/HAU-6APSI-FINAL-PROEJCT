"use client";

import { ArrowRight, Heart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PlaceCard } from "@/components/place-card";
import { PageHeading } from "@/components/page-heading";
import { usePassport } from "@/components/passport-provider";
import { filterByScope, type PlaceScope } from "@/lib/places";
import { byUpcomingPlan } from "@/lib/plans";

const scopes: { value: PlaceScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "local", label: "Local" },
  { value: "international", label: "International" },
];

export default function WishlistPage() {
  const { ready, places } = usePassport();
  const [scope, setScope] = useState<PlaceScope>("all");
  // Upcoming plans lead, soonest first.
  const savedPlaces = byUpcomingPlan(filterByScope(places.filter((place) => place.favorite || place.status !== "visited"), scope));

  return (
    <main className="page-shell wishlist-page">
      <PageHeading
        eyebrow="The next chapter"
        title="Places We Saved"
        description="A short list for the next free afternoon."
        action={
          <Link href="/map" className="button button--primary">
            <Heart size={18} aria-hidden="true" /> Find places
          </Link>
        }
        align="left"
      />

      <div className="filter-row" role="group" aria-label="Where">
        {scopes.map(({ value, label }) => (
          <button key={value} type="button" className={scope === value ? "filter-chip is-selected" : "filter-chip"} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>
        ))}
      </div>

      {ready ? <section className="place-grid" aria-label="Saved places">
        {savedPlaces.map((place) => <PlaceCard key={place.id} place={place} />)}
        {!savedPlaces.length && <div className="empty-state"><h2>{scope === "international" ? "No places abroad yet" : scope === "local" ? "No local places yet" : "No saved places yet"}</h2><p>Use the map to save a place for later.</p></div>}
      </section> : <div className="loading-panel" role="status">Loading saved places…</div>}

      <aside className="planning-strip">
        <strong>Plan the next date</strong>
        <Link href="/map" className="button button--secondary">
          Open map <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </aside>
    </main>
  );
}
