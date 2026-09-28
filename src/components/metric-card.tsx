import { Clock3, Landmark, MapPinned, Star } from "lucide-react";
import Link from "next/link";

import type { PassportMetric } from "@/lib/domain";

const metricIcons = {
  museum: Landmark,
  map: MapPinned,
  star: Star,
  clock: Clock3,
};

export function MetricCard({ metric }: { metric: PassportMetric }) {
  const Icon = metricIcons[metric.icon];

  return (
    <article className="metric-card">
      <div className="metric-card__top">
        <span>{metric.label}</span>
        <span className={`metric-icon metric-icon--${metric.icon}`}>
          <Icon size={25} aria-hidden="true" />
        </span>
      </div>
      <strong>{metric.value}</strong>
      <p>{metric.supportingText}</p>
      <Link href="/archive#timeline" className="text-button">View details</Link>
    </article>
  );
}
