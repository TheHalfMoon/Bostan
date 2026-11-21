import { createRequire } from "node:module";
import { expect, it } from "vitest";
import { loadJSDOM } from "../lazy-jsdom.js";

const require = createRequire(import.meta.url);

it("loads the DOM implementation only when a caller requests it", () => {
  const jsdomPath = require.resolve("jsdom");
  expect(require.cache[jsdomPath]).toBeUndefined();
  expect(typeof loadJSDOM().JSDOM).toBe("function");
  expect(require.cache[jsdomPath]).toBeDefined();
});
