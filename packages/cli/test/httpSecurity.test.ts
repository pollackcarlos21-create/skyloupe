import { expect, test } from "vitest";
import { skyloupeModule } from "../src/bridge/httpServer";

test("cli/bridge/httpServer module loads", () => {
  expect(skyloupeModule).toBe("cli/bridge/httpServer");
});
