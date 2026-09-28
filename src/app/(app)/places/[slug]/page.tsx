import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PlaceDetail } from "@/components/place-detail";

type PlacePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PlacePage({ params }: PlacePageProps) {
  const { slug } = await params;

  return (
    <main className="page-shell place-page">
      <Link href="/feed" className="back-link"><ArrowLeft size={17} aria-hidden="true" /> Back to Feed</Link>
      <PlaceDetail slug={slug} />
    </main>
  );
}
