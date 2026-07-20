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

/** Batch-register field definitions in a single statement (deduped by field_key). */
export async function registerFieldQuestionDefinitions(
  client: PoolClient,
  questions: FieldQuestion[],
): Promise<void> {
  if (questions.length === 0) return;
  const byKey = new Map<string, string>();
  for (const q of questions) {
    const fieldKey = `fq_${slugKey(q.question) || q.id.slice(0, 8)}`;
    byKey.set(fieldKey, q.question); // last write wins; dedupes conflicting rows in one insert
  }
  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const [fieldKey, label] of byKey) {
    params.push(randomUUID(), fieldKey, label);
    const n = params.length;
    tuples.push(`($${n - 2}, 'candidate', $${n - 1}, $${n}, 'employer', 200)`);
  }
  await client.query(
    `insert into card_field_definitions (id, card_type, field_key, label_he, source, priority)
     values ${tuples.join(",")}
     on conflict (card_type, field_key) do update set label_he = excluded.label_he`,
    params,
  );
}
