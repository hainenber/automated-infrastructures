import assert from "node:assert";
import test from "node:test";
import { CommandData, hasCommands } from "./common.ts";

test("hasCommands returns array of Promisified CommandData for existing and non-existent commmands", async () => {
  const actual = await hasCommands(["invalid_command", "grep"]);
  const expected: CommandData[] = [{ name: "invalid_command", exists: false }, {
    name: "grep",
    exists: true,
  }];
  assert.deepEqual(actual, expected);
});
