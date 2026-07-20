# שידוך POC

אתר POC לשידוך עובדים/מעסיקים **בלי חיפוש**.

## מה יש

- כניסה עם Google (Auth.js) + דמו בלי Google
- צ׳אט AI מתוחכם לעובד ולמעסיק
- כרטיסים מפורטים מראש (עשרות שדות) + **שדות דינמיים בזמן ריצה** (`extras`)
- דירוג התאמות + גמישות 1–10
- שמירה ב־Supabase Postgres (טבלאות מנורמלות + JSONB לכרטיסים)
- מעסיק: מאשר / דוחה / שאלת תחום
- עובד: רק משרות שאושרו עבורו

## ארכיטקטורת בסיס הנתונים

**גישה היברידית** (מומלצת ל-POC):

| שכבה | מה | למה |
|------|-----|-----|
| שדות ליבה | ~50 שדות מוגדרים ב-TypeScript | התאמות, UI, AI intake יציבים |
| `extras` (JSONB) | שדות חדשים בזמן ריצה | שאלות מעסיק, פרטים ייחודיים לתפקיד |
| `card_field_definitions` | רישום מטא-דאטה לשדות דינמיים | תוויות בעברית ב-UI בלי מיגרציה |
| טבלאות מנורמלות | users, profiles, matches, chat… | שאילתות, אינדקסים, צמיחה |

מיגרציה אוטומטית מ-`app_store` (blob ישן) לטבלאות החדשות בפעם הראשונה.

## הגדרת סביבה

```bash
cp .env.example .env.local
```

ראו `.env.example` עבור:
- `GOOGLE_GENERATIVE_AI_API_KEY` (אופציונלי)
- `AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL` (Supabase Postgres connection string)

Google OAuth redirect URIs:
- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://YOUR-DOMAIN/api/auth/callback/google`

## הרצה

```bash
npm install
npm run dev
```

## מיגרציות Supabase

קובץ SQL: `supabase/migrations/001_normalized_schema.sql`  
נרץ אוטומטית ב-startup דרך `ensureSchema()`. ניתן גם להריץ ידנית ב-SQL Editor.

## בדיקות

```bash
npm test
```
