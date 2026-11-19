import type { ReactNode } from "react";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-3xl border border-black/[0.04] bg-white shadow-card ${className}`}>
      {children}
    </section>
  );
}

/** Small numbered heading used for each step of the lesson. */
export function StepLabel({
  step,
  title,
  hint,
  action,
}: {
  step?: number;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          {step !== undefined && (
            <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] font-medium text-white">
              {step}
            </span>
          )}
          {title}
        </h2>
        {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
