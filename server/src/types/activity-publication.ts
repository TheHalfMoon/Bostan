import type { PluginEvent } from "@bostan/plugin-sdk";

export interface ActivityPublication {
  companyId: string;
  payload: Record<string, unknown>;
  pluginEvent: PluginEvent | null;
}
