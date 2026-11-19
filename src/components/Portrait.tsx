import Image from "next/image";
import type { Persona } from "@/lib/personas";

/** Illustrated portrait (not a photo) with a thin ring in the persona's accent colour. */
export function Portrait({ persona, size = 40 }: { persona: Persona; size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-white"
      style={{ width: size, height: size, ["--tw-ring-color" as string]: `${persona.accent}55` }}
    >
      <Image
        src={persona.portrait}
        alt={`Illustration of ${persona.name}, a simulation inspired by ${persona.inspiredBy}`}
        width={size}
        height={size}
        unoptimized
      />
    </span>
  );
}
