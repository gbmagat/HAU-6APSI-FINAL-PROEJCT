import { PageHeading } from "@/components/page-heading";
import { VisitForm } from "@/components/visit-form";
import { places } from "@/lib/mock-data";

export const metadata = {
  title: "Log an experience",
};

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string }>;
}) {
  const { place } = await searchParams;

  return (
    <main className="page-shell log-page">
      <PageHeading
        eyebrow="Add to the archive"
        title="Save This Place to Our Story"
        description="Review the visit, add your private rating, and publish it for just the two of you."
      />
      <VisitForm places={places} initialPlaceSlug={place} />
    </main>
  );
}
