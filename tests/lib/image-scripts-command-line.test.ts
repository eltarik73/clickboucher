// @vitest-environment node
// parseCommandLine (scripts/images/shared.ts): the owner scripts read their arguments with
// node:util parseArgs in strict mode, and every refusal reaches the owner as a French UsageError.
import { describe, expect, it } from "vitest";
import { parseCommandLine, UsageError } from "../../scripts/images/shared";

function repairCommandLine(args: string[]) {
  return parseCommandLine({
    args,
    options: {
      apply: { type: "boolean", default: false },
      journal: { type: "string" },
      "allow-host": { type: "string", multiple: true, default: [] },
    },
  });
}

function thrown(read: () => unknown): unknown {
  try {
    read();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("parseCommandLine", () => {
  it("reads flags, values and repeated options, with their defaults", () => {
    expect(repairCommandLine([]).values).toEqual({ apply: false, "allow-host": [] });
    const args = [
      "--apply",
      "--journal",
      "j.jsonl",
      "--allow-host",
      "a.fr",
      "--allow-host",
      "b.fr",
    ];
    expect(repairCommandLine(args).values).toEqual({
      apply: true,
      journal: "j.jsonl",
      "allow-host": ["a.fr", "b.fr"],
    });
  });

  it.each([
    [["--dry-run"], "Option inconnue : --dry-run"],
    [["-a"], "Option inconnue : -a"],
    [["--apply", "--journal"], "--journal attend une valeur."],
    [["--journal", "--apply"], "--journal attend une valeur."],
    [["--apply=oui"], "--apply ne prend pas de valeur."],
    [["j.jsonl"], "Argument inattendu : j.jsonl"],
  ])("%j : %s", (args, message) => {
    expect(thrown(() => repairCommandLine(args))).toStrictEqual(new UsageError(message));
  });

  it("takes a positional argument only from a script that declares one", () => {
    const purge = parseCommandLine({
      args: ["https://exemple.fr/a.webp", "--apply"],
      options: { apply: { type: "boolean", default: false } },
      allowPositionals: true,
    });
    expect(purge).toEqual({ values: { apply: true }, positionals: ["https://exemple.fr/a.webp"] });
  });
});
