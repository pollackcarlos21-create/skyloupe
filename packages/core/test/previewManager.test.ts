import { expect, test } from "vitest";
import { skyloupeModule } from "../src/previewManager";

test("core/previewManager module loads", () => {
  expect(skyloupeModule).toBe("core/previewManager");
});
