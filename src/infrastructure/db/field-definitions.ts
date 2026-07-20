import type { PoolClient } from "pg";
import { randomUUID } from "crypto";
import type { FieldQuestion } from "@/domain/types";

function slugKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\u0590-\u05ff-]/g, "")
    .slice(0, 80);
}

export async function registerFieldQuestionDefinition(
  client: PoolClient,
  question: FieldQuestion,
): Promise<void> {
  const fieldKey = `fq_${slugKey(question.question) || question.id.slice(0, 8)}`;
  await client.query(
    `insert into card_field_definitions (id, card_type, field_key, label_he, source, priority)
     values ($1, 'candidate', $2, $3, 'employer', 200)
     on conflict (card_type, field_key) do update
       set label_he = excluded.label_he`,
    [randomUUID(), fieldKey, question.question],
  );
}
