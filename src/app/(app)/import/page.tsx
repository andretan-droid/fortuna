import { PageHeader } from "@/components/shell/page-header";
import { Reveal } from "@/components/motion/reveal";
import { ImportWizard } from "@/components/import/wizard";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Onboarding"
        title="Import your data"
        description="Bring in an existing budget from a spreadsheet — the template's tabs and columns map straight in, validated before anything is written."
      />
      <Reveal>
        <ImportWizard />
      </Reveal>
    </div>
  );
}
