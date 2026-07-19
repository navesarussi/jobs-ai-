import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/types";

export function parseLocale(value: string | null | undefined): Locale {
  if (value && isLocale(value)) return value;
  return DEFAULT_LOCALE;
}

export function localeFromRequest(req: Request): Locale {
  const url = new URL(req.url);
  return parseLocale(url.searchParams.get("locale"));
}
