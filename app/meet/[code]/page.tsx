import { redirect } from "next/navigation";

export default async function MeetRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/session/${encodeURIComponent(code)}`);
}
