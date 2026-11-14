import { expect, test } from "vitest";
import { skyloupeModule } from "../src/polyfill/installPolyfill";

test("devtools/polyfill/installPolyfill module loads", () => {
  expect(skyloupeModule).toBe("devtools/polyfill/installPolyfill");
});
