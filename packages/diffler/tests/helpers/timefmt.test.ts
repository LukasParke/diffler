import { describe, it, expect } from "vitest";
import { humanize, shortDate } from "../../src/helpers/timefmt.js";

describe("timefmt", () => {
  describe("humanize", () => {
    it("returns just now for recent times", () => {
      const now = new Date().toISOString();
      expect(humanize(now)).toBe("just now");
    });

    it("returns minutes ago", () => {
      const date = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(humanize(date)).toBe("5 minutes ago");
    });

    it("returns hours ago", () => {
      const date = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(humanize(date)).toBe("2 hours ago");
    });

    it("returns days ago", () => {
      const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(humanize(date)).toBe("3 days ago");
    });

    it("returns the original string for invalid input", () => {
      expect(humanize("not-a-date")).toBe("not-a-date");
    });
  });

  describe("shortDate", () => {
    it("formats ISO dates", () => {
      expect(shortDate("2024-01-15T12:00:00Z")).toBe("Jan 15, 2024");
    });

    it("returns original for invalid input", () => {
      expect(shortDate("invalid")).toBe("invalid");
    });
  });
});
