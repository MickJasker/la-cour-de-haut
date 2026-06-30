import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleStatus } from "./locale-status";

// ---------------------------------------------------------------------------
// Behavior 1: all four locales are translated
// ---------------------------------------------------------------------------

describe("LocaleStatus", () => {
  describe("all locales present", () => {
    it("shows the translated checkmark icon and aria-label for every locale", () => {
      const html = renderToStaticMarkup(
        <LocaleStatus
          source={{ nl: "human", en: "machine", fr: "machine", de: "machine" }}
        />,
      );

      expect(html).toContain('aria-label="Nederlands: vertaald"');
      expect(html).toContain('aria-label="Engels: vertaald"');
      expect(html).toContain('aria-label="Frans: vertaald"');
      expect(html).toContain('aria-label="Duits: vertaald"');

      // Four check icons, no warning icon
      expect(html.split("lucide-check").length - 1).toBe(4);
      expect(html).not.toContain("lucide-triangle-alert");
    });
  });

  // -------------------------------------------------------------------------
  // Behavior 2: one locale missing
  // -------------------------------------------------------------------------

  describe("one locale missing", () => {
    it("shows the warning icon and 'ontbreekt' for the missing locale; checkmark and 'vertaald' for the rest", () => {
      const html = renderToStaticMarkup(
        <LocaleStatus source={{ nl: "human", en: "machine", de: "machine" }} />,
      );

      // fr is absent
      expect(html).toContain('aria-label="Frans: ontbreekt"');
      expect(html).toContain("lucide-triangle-alert");

      // The other three are still translated
      expect(html).toContain('aria-label="Nederlands: vertaald"');
      expect(html).toContain('aria-label="Engels: vertaald"');
      expect(html).toContain('aria-label="Duits: vertaald"');

      // Only one warning icon
      expect(html.split("lucide-triangle-alert").length - 1).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Behavior 3: locales render in nl → en → fr → de order
  // -------------------------------------------------------------------------

  describe("rendering order", () => {
    it("renders NL before EN before FR before DE", () => {
      const html = renderToStaticMarkup(<LocaleStatus source={{}} />);

      const positions = {
        nl: html.indexOf("NL"),
        en: html.indexOf("EN"),
        fr: html.indexOf("FR"),
        de: html.indexOf("DE"),
      };

      expect(positions.nl).toBeGreaterThan(-1);
      expect(positions.nl).toBeLessThan(positions.en);
      expect(positions.en).toBeLessThan(positions.fr);
      expect(positions.fr).toBeLessThan(positions.de);
    });
  });
});
