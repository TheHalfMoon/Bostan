import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BootstrapPendingPage } from "./BootstrapPendingPage";
import { BOSTAN_BOOTSTRAP_PREVIEW_NOTICE } from "@/bootstrapSetup";

describe("Bostan first-admin bootstrap preview is honest about unsupported CLI paths", () => {
  for (const hasActiveInvite of [false, true]) {
    it("does not suggest donor npm execution when active invite is " + hasActiveInvite, () => {
      const markup = renderToStaticMarkup(
        <BootstrapPendingPage
          claimAvailable={false}
          hasActiveInvite={hasActiveInvite}
          session={null}
          claimState="idle"
          onClaim={() => {}}
        />,
      );
      expect(markup).toContain("This Bostan instance is waiting on its first admin");
      expect(markup).toContain(BOSTAN_BOOTSTRAP_PREVIEW_NOTICE);
      expect(markup).not.toMatch(/npx|paperclipai|bootstrap-ceo|Paperclip/);
      if (hasActiveInvite) expect(markup).toContain("startup logs");
      else expect(markup).toContain("Ask the instance operator");
    });
  }
});
