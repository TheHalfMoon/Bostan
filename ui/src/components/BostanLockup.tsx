import type { SVGAttributes } from "react";
import { cn } from "../lib/utils";
import { BostanLockupGraphic } from "./brand/BostanMark";

type BostanLockupProps = Omit<SVGAttributes<SVGSVGElement>, "children" | "viewBox">;

/** Bostan horizontal lockup (tree + Newsreader wordmark). Follows the theme via currentColor. */
export function BostanLockup({ className, ...props }: BostanLockupProps) {
  return <BostanLockupGraphic title="Bostan" className={cn("h-8 w-auto text-foreground", className)} {...props} />;
}
