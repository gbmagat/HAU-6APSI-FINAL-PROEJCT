import { redirect } from "next/navigation";

import { places } from "@/lib/mock-data";

export function generateStaticParams() {
  return places.map((place) => ({ slug: place.slug }));
}

export default async function LegacyMuseumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/places/${slug}`);
}
