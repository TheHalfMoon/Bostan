import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@bostan/shared";
import { validateInstanceConfig } from "./plugin-config-validator.js";

describe("plugin instance configuration URI validation", () => {
  it("canonicalizes IDN-equivalent hosts through Ajv URI resolution", () => {
    // Match the constructor compatibility path used by the validator module.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AjvCtor = (Ajv as any).default ?? Ajv;
    const ajv = new AjvCtor();
    const uriResolver = ajv.opts.uriResolver;

    // IDEOGRAPHIC FULL STOP is a valid IDN separator and WHATWG URL parsing
    // canonicalizes this loopback host to the same ASCII hostname.
    expect(uriResolver.normalize("http://127\u30020\u30020\u30021/config.json")).toBe(
      uriResolver.normalize("http://127.0.0.1/config.json"),
    );
  });

  it("continues accepting valid URI settings and rejecting malformed ones", () => {
    const schema = {
      type: "object",
      properties: { endpoint: { type: "string", format: "uri" } },
      required: ["endpoint"],
      additionalProperties: false,
    } as unknown as JsonSchema;

    expect(validateInstanceConfig({ endpoint: "https://service.example/api" }, schema).valid).toBe(true);
    expect(validateInstanceConfig({ endpoint: "http://[::1" }, schema).valid).toBe(false);
  });
});
