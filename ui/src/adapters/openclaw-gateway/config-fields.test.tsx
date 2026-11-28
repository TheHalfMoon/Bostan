// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OpenClawGatewayConfigFields } from "./config-fields";
import type { AdapterConfigFieldsProps } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("OpenClawGatewayConfigFields branding examples", () => {
  const roots: Root[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.innerHTML = "";
  });

  it("uses the Bostan API example while preserving the runtime credential path", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const props: AdapterConfigFieldsProps = {
      mode: "edit",
      isCreate: false,
      adapterType: "openclaw_gateway",
      values: null,
      set: null,
      config: {},
      eff: (_group, _field, original) => original,
      mark: vi.fn(),
      models: [],
    };

    act(() => {
      root.render(
        <TooltipProvider>
          <OpenClawGatewayConfigFields {...props} />
        </TooltipProvider>,
      );
    });
    roots.push(root);

    expect(container.querySelector('input[placeholder="https://bostan.example"]')).toBeTruthy();
    // This path is a runtime default; changing its example alone would mislead operators.
    expect(container.querySelector('input[placeholder="~/.openclaw/workspace/paperclip-claimed-api-key.json"]')).toBeTruthy();
  });
});
