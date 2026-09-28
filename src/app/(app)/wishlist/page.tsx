"use client";

import { ArrowRight, Heart } from "lucide-react";
import Link from "next/link";

import { PlaceCard } from "@/components/place-card";
import { PageHeading } from "@/components/page-heading";
import { usePassport } from "@/components/passport-provider";

export default function WishlistPage() {
  const { ready, places } = usePassport();
  const savedPlaces = places.filter((place) => place.favorite || place.status !== "visited");

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

      {ready ? <section className="place-grid" aria-label="Saved places">
        {savedPlaces.map((place) => <PlaceCard key={place.id} place={place} />)}
        {!savedPlaces.length && <div className="empty-state"><h2>No saved places yet</h2><p>Use the map to save a place for later.</p></div>}
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
