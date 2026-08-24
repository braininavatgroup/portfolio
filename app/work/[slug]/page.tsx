import { redirect } from "next/navigation";

export default async function LegacyCaseStudy({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/index/${slug}`);
}
