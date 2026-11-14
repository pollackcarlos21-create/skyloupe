import { expect, test } from "vitest";
import { skyloupeModule } from "../src/surfaceGuard";

test("core/surfaceGuard module loads", () => {
  expect(skyloupeModule).toBe("core/surfaceGuard");
});
