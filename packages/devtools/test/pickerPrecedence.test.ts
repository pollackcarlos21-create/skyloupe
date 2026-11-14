import { expect, test } from "vitest";
import { skyloupeModule } from "../src/polyfill/picker";

test("devtools/polyfill/picker module loads", () => {
  expect(skyloupeModule).toBe("devtools/polyfill/picker");
});
