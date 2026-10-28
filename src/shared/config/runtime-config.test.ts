import { describe, expect, it } from "vitest";
import { resolveRuntimeConfig } from "./runtime-config";

describe("runtime mode selection", () => {
  it.each([undefined, "", "   "])("uses Demo mode for %s", (value) => {
    expect(resolveRuntimeConfig(value)).toEqual({ mode: "demo", apiBaseUrl: null });
  });

  it("uses API mode for a configured URL and normalizes its trailing slash", () => {
    expect(resolveRuntimeConfig(" https://api.example.test/v1/// ")).toEqual({
      mode: "api",
      apiBaseUrl: "https://api.example.test/v1",
    });
  });
});
