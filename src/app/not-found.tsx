import { MapPin } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="centered-state">
      <MapPin size={44} aria-hidden="true" />
      <p className="eyebrow">Place not found</p>
      <h1>We don’t have that place yet.</h1>
      <p>Return to the Feed or choose another place from the Map.</p>
      <Link href="/feed" className="button button--primary">
        Return to the feed
      </Link>
    </main>
  );
}
