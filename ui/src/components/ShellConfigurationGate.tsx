import { Outlet } from "@/lib/router";
import { BostanLoading } from "./BostanLoading";

/** Keep shell selection stable while the independent access gate loads. */
export function ShellConfigurationGate({ loaded }: { loaded: boolean }) {
  return loaded ? <Outlet /> : <BostanLoading />;
}
