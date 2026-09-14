import { describe, expect, it } from "vitest";
import { ACADEMY_NAV } from "../academy";

describe("academy nav", () => {
  it("uses Practice for learners and includes mock exams", () => {
    expect(ACADEMY_NAV.some((i) => i.label === "Practice")).toBe(true);
    expect(ACADEMY_NAV.some((i) => i.label === "Question Bank")).toBe(false);
    expect(ACADEMY_NAV.some((i) => i.label === "Mock Exams")).toBe(true);
  });
});
