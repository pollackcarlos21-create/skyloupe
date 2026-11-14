import { expect, test } from "vitest";
import { adapter, version } from "./index";

test("names the dom adapter", () => {
  expect(version).toBe("0.0.0");
  expect(adapter).toBe("dom");
});
