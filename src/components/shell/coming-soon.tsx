/** Phase-2 scaffold placeholder for surfaces whose real content lands later.
 *  Deleted as each phase fills in its page. */
export function ComingSoon({ phase }: { phase: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
      <p className="font-display text-lg text-muted-foreground">Arriving in {phase}</p>
      <p className="mt-1.5 text-sm text-muted-foreground/70">
        This surface is scaffolded — real data and controls land soon.
      </p>
    </div>
  );
}
