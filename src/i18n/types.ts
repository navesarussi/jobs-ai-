export type Locale = "en" | "he";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "shidukh_locale";

export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "he", label: "עברית" },
];

export function isLocale(value: string): value is Locale {
  return value === "en" || value === "he";
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return locale === "he" ? "rtl" : "ltr";
}
