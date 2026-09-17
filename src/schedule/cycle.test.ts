import { describe, expect, test } from "bun:test";
import { gcd, lcm } from "@/schedule/cycle";

describe("gcd", () => {
  test("finds the common factor", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
    expect(gcd(9, 9)).toBe(9);
  });

  test("treats zero as the identity", () => {
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(5, 0)).toBe(5);
  });
});

describe("lcm", () => {
  test("is the cycle length of two counts", () => {
    expect(lcm(3, 2)).toBe(6);
    expect(lcm(23, 22)).toBe(506);
  });

  test("collapses when one count divides the other", () => {
    expect(lcm(2, 2)).toBe(2);
    expect(lcm(6, 3)).toBe(6);
  });

  test("is zero when either count is zero, so it cannot loop forever", () => {
    expect(lcm(0, 5)).toBe(0);
    expect(lcm(5, 0)).toBe(0);
  });
});
