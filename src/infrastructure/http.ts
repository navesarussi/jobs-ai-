import { NextResponse } from "next/server";
import { DomainError } from "@/domain/errors";
import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/types";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(error: unknown, locale: Locale = DEFAULT_LOCALE) {
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: getMessages(locale).api.internalError }, { status: 500 });
}
