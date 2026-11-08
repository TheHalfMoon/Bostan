import { describe, expect, it } from "vitest";
import { resolveBostanAnnouncementPolicy as resolve } from "./announcement-policy.js";

describe("Bostan announcements network policy", () => {
  it("defaults to disabled even if inherited environment claims enabled", () => {
    expect(resolve({})).toEqual({ enabled: false, feedUrl: "" });
    expect(resolve({
      PAPERCLIP_ANNOUNCEMENTS_ENABLED: "true",
      PAPERCLIP_ANNOUNCEMENTS_FEED_URL: "https://pages.paperclip.ing/announcements/v1/current.json",
    })).toEqual({ enabled: false, feedUrl: "" });
  });

  it("requires explicit Bostan enablement and explicit HTTPS destination", () => {
    expect(resolve({ BOSTAN_ANNOUNCEMENTS_ENABLED: "1" })).toEqual({ enabled: false, feedUrl: "" });
    expect(resolve({ BOSTAN_ANNOUNCEMENTS_FEED_URL: "https://news.example.invalid/" })).toEqual({ enabled: false, feedUrl: "" });
    expect(resolve({
      BOSTAN_ANNOUNCEMENTS_ENABLED: "1",
      BOSTAN_ANNOUNCEMENTS_FEED_URL: "https://news.example.invalid/feed",
    })).toEqual({ enabled: true, feedUrl: "https://news.example.invalid/feed" });
  });

  it("rejects insecure protocols, credentials and malformed destinations", () => {
    for (const feedUrl of ["http://example.com", "ftp://example.com", "https://a:b@example.com", "not a URL"]) {
      expect(resolve({ BOSTAN_ANNOUNCEMENTS_ENABLED: "1", BOSTAN_ANNOUNCEMENTS_FEED_URL: feedUrl }))
        .toEqual({ enabled: false, feedUrl: "" });
    }
  });
});
