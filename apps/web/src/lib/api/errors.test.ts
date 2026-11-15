import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/en.json";
import tr from "@/i18n/tr.json";
import { ApiRequestError } from "./client";
import { errorKey } from "./errors";

describe("engine errors in the UI language", () => {
  it("maps known engine messages to locale keys present in both languages", () => {
    const key = errorKey(new ApiRequestError("current_rotation is longer than horizon_years.", 422, "invalid_request"));
    expect(key).toBe("error.currentTooLong");
    expect((tr as Record<string, string>)[key]).toBeTruthy();
    expect((en as Record<string, string>)[key]).toBeTruthy();
  });
  it("falls back to a generic message and logs unknown errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(errorKey(new ApiRequestError("Something nobody mapped", 500, "internal_error"))).toBe("error.generic");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
  it("uses the error code when the message is not known", () => {
    expect(errorKey(new ApiRequestError("Slow down", 429, "rate_limited"))).toBe("error.rateLimited");
  });
});
