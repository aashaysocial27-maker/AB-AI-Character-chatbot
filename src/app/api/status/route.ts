export const dynamic = "force-dynamic";

/** Tells the UI whether a server-side GEMINI_API_KEY exists. Never returns the key. */
export function GET() {
  return Response.json(
    { serverKey: Boolean(process.env.GEMINI_API_KEY?.trim()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
