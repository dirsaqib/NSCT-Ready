export const dynamic = "force-dynamic";

/** The AI tutor is switched off for students. */
export async function POST() {
  return Response.json({ error: "The AI tutor is not available." }, { status: 404 });
}
