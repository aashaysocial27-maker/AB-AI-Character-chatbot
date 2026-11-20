/** Display helpers. They only format numbers that came from a tool. */

export function fmtPrice(v: number | null | undefined, currency?: string | null): string {
  if (v === null || v === undefined) return "—";
  const n = v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${n} ${currency}` : n;
}

export function fmtCompact(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(v);
}

export function fmtSigned(v: number | null | undefined, suffix = ""): string {
  if (v === null || v === undefined) return "—";
  const s = v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v > 0 ? "+" : ""}${s}${suffix}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
}

export function fmtDate(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Short, readable one-line summary of tool arguments, e.g. symbol: "AAPL". */
export function fmtArgs(args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
}
