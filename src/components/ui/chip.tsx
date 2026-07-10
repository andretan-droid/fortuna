import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/colors";

/** One small colored badge — the single chip primitive every colored label
 *  (category, payment method, provider, plan status) renders through. */
export function Chip({
  label,
  tone,
  className,
}: {
  label: string;
  tone: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        tone.bg,
        tone.text,
        className,
      )}
    >
      {label}
    </span>
  );
}
