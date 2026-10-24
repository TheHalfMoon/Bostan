import { describe, expect, it } from "vitest";
import { bostanStandaloneArgs } from "./local-standalone.js";

describe("Bostan OpenCode source-only private daemon contract", () => {
  it("injects one standalone flag for local Bostan runs", () => {
    expect(bostanStandaloneArgs([], false, { BOSTAN_OPENCODE_STANDALONE: "1" })).toEqual(["--standalone"]);
  });
  it("does not inject for remote/SSH/sandbox targets", () => {
    expect(bostanStandaloneArgs([], true, { BOSTAN_OPENCODE_STANDALONE: "1" })).toEqual([]);
  });
  it("does not inject outside explicit isolated Bostan mode", () => {
    expect(bostanStandaloneArgs([], false, { BOSTAN_OPENCODE_STANDALONE: "0" })).toEqual([]);
    expect(bostanStandaloneArgs([], false, {})).toEqual([]);
  });
  it("never duplicates an operator-provided standalone option", () => {
    expect(bostanStandaloneArgs(["--standalone"], false, { BOSTAN_OPENCODE_STANDALONE: "1" })).toEqual([]);
  });
  it("keeps injected option ahead of positional terminator", () => {
    expect(bostanStandaloneArgs(["--", "--standalone"], false, { BOSTAN_OPENCODE_STANDALONE: "1" })).toEqual(["--standalone"]);
  });
});
