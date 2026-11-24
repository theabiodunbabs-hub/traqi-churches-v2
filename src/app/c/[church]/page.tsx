import { redirect } from "next/navigation";

/** The old church address now points to the one church page: traqi.church/{church}. */
export default async function OldChurchPage({ params }: { params: Promise<{ church: string }> }) {
  const { church } = await params;
  redirect(`/${church}`);
}
