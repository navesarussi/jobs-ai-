# CODE QUALITY — shidukh-poc

Architecture: Domain ← Application ← Infrastructure / App.

- Max ~200 lines per file where practical
- Domain has zero framework imports
- AI provider swappable (Gemini / heuristic)
- Product chat behavior is defined in `docs/SSOT/CHAT_AGENTS.md` and SRS FR-CHAT-*

[PENDING REFACTOR]: split `app_store` jsonb blob into normalized tables when concurrency / querying needs grow.

[PENDING REFACTOR]: align intake prompts + heuristic with FR-CHAT-01..08 (no fill-count speech; adaptive/natural; free-text narrative field).
