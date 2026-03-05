import { describe, expect, it } from "vitest";
import { validateEmail, validatePassword, validateRequiredText } from "@/lib/validation";

describe("validation", () => {
  it("accepts valid email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(validateEmail("invalid-email")).toBe(false);
  });

  it("validates password length", () => {
    expect(validatePassword("12345678")).toBe(true);
    expect(validatePassword("1234")).toBe(false);
  });

  it("validates required text bounds", () => {
    expect(validateRequiredText("abc", 2, 5)).toBe(true);
    expect(validateRequiredText("a", 2, 5)).toBe(false);
    expect(validateRequiredText("abcdef", 2, 5)).toBe(false);
  });
});
