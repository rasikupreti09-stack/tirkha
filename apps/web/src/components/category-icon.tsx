import { Wrench, Zap, Sparkles, WashingMachine, PaintRoller, Grid2X2 } from "lucide-react";
const icons = { wrench: Wrench, zap: Zap, sparkles: Sparkles, "washing-machine": WashingMachine, "paint-roller": PaintRoller };
export function CategoryIcon({ name }: { name: string | null }) {
  const Icon = icons[name as keyof typeof icons] || Grid2X2;
  return <Icon aria-hidden="true" className="size-7" strokeWidth={1.5} />;
}
