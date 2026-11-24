import datasetJson from "@/data/ee-curriculum.json";
import type { CurriculumDataset } from "@/types/curriculum";
import { AppShell } from "@/components/AppShell";

export default function HomePage() {
  const dataset = datasetJson as unknown as CurriculumDataset;
  return <AppShell dataset={dataset} />;
}
