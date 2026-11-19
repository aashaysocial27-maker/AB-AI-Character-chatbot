import { PROVIDERS, type ProviderId } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** Tells the UI which providers have a server-side key in .env.local. Never returns a key. */
export function GET() {
  const serverKeys = Object.fromEntries(
    PROVIDERS.map((p) => [p.id, Boolean(process.env[p.envVar]?.trim())]),
  ) as Record<ProviderId, boolean>;
  return Response.json({ serverKeys }, { headers: { "Cache-Control": "no-store" } });
}
