import {
  AsYouType,
  getCountryCallingCode,
  parsePhoneNumber,
  type CountryCode,
} from "libphonenumber-js/min";
import { getCountryOptions } from "./countries";

export type DialCodeOption = { code: string; name: string; dialCode: string };

/**
 * Compose a selected country + the raw local-number text into an E.164 string
 * (e.g. "+33612345678"). Returns "" when there is no number to store, so a
 * preselected country never serializes to a bare dial code.
 */
export function composePhone(country: string, input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  // AsYouType applies the country's national numbering rules (drop France's
  // trunk 0, keep Italy's) and, when the input starts with "+", parses it as an
  // international number regardless of the selected country.
  const formatter = new AsYouType(country as CountryCode);
  formatter.input(trimmed);
  return formatter.getNumber()?.number ?? "";
}

/**
 * The ISO country of a pasted/typed international number (one starting with
 * "+"), or `undefined` for a national-format input. Lets the picker follow a
 * pasted number instead of forcing the user to fix the country by hand.
 */
export function detectCountry(input: string): CountryCode | undefined {
  const trimmed = input.trim();
  if (!trimmed.startsWith("+")) return undefined;
  const formatter = new AsYouType();
  formatter.input(trimmed);
  return formatter.getNumber()?.country;
}

/**
 * Split a stored E.164 value back into `{ country, national }` so the control
 * can re-hydrate after a server round-trip (e.g. a validation bounce). Falls
 * back to `fallbackCountry` when the value is empty or unparseable.
 */
export function parsePhone(
  value: string,
  fallbackCountry: string,
): { country: string; national: string } {
  const trimmed = value.trim();
  if (!trimmed) return { country: fallbackCountry, national: "" };
  try {
    const parsed = parsePhoneNumber(trimmed);
    return {
      country: parsed.country ?? fallbackCountry,
      national: parsed.nationalNumber,
    };
  } catch {
    // Never surface a raw "+..." in the local-number field on a parse failure.
    return {
      country: fallbackCountry,
      national: trimmed.startsWith("+") ? "" : trimmed,
    };
  }
}

/**
 * All countries that have a phone calling code, as `{ code, name, dialCode }`.
 * Names are localized + sorted by `getCountryOptions`; dial codes are derived
 * from libphonenumber-js (the single source of truth), so a country with no
 * known calling code is dropped rather than shown without a code.
 */
export function getDialCodeOptions(locale: string): DialCodeOption[] {
  const result: DialCodeOption[] = [];
  for (const { code, name } of getCountryOptions(locale)) {
    try {
      const dialCode = `+${getCountryCallingCode(code as CountryCode)}`;
      result.push({ code, name, dialCode });
    } catch {
      // libphonenumber-js has no calling code for this ISO code — drop it.
    }
  }
  return result;
}
