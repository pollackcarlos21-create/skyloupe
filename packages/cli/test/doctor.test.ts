import { expect, test } from "vitest";
import { skyloupeModule } from "../src/doctor/astScanner";

test("cli/doctor/astScanner module loads", () => {
  expect(skyloupeModule).toBe("cli/doctor/astScanner");
});
