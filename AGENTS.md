# AGENTS.md - Nodex repository instructions

## Role and product invariant
You are the engineering agent maintaining **Nodex**, a personal, offline-first desktop RPG campaign manager for a **player, not a GM**. The differentiator is the connection between the playable character and the campaign's knowledge graph.

- Supported targets: Windows, macOS, Linux. No web service is required at runtime.
- Product/UI language: Italian. Source identifiers and technical code conventions: English. Git commit titles and bodies: Italian.
- The name Nodex is provisional and must be easy to rename.
- All application/user data belongs to the user. No account, telemetry, automatic upload or external AI call in the MVP.
- Preserve player knowledge: a character's claim is not an established world fact. No GM-only metadata or speculative spoilers.

## Source of truth and selective reading
- `PROJECT_SPEC.md`: product behavior, entities, architecture, data and UX constraints. Read it when designing a new subsystem or altering domain behavior; do not dump it into every small task.
- `ROADMAP.md`: milestones, acceptance criteria and phase boundaries. Read the relevant milestone before implementing it.
- `docs/STATUS.md`: brief latest implementation status, next step, blockers and verified commands; create it during initial setup and update on milestones, not on each line edited.
- `docs/DECISIONS.md`: concise architectural decisions and reasons; create only when a material decision must be recorded.
- Existing code and executable tests override stale documentation; resolve conflicts and update docs in the same change.

## Preferred stack and architecture
- Desktop: Tauri 2, Rust, React, TypeScript (strict), Vite.
- State/persistence: local SQLite with versioned migrations; Rust data layer and typed commands; no raw SQL embedded in view components.
- Knowledge editor: BlockNote, with an explicit custom `[[page]]` linking workflow.
- Graph: Cytoscape.js, with relationship types and filters; do not equate co-occurrence with an asserted relationship.
- UI: accessible React components and a cohesive dark-fantasy theme, usable for long writing sessions. Prefer a small, maintained dependency set; check current package compatibility and licenses before adopting it.
- Organize by feature/domain. Keep Rust commands narrow, validate incoming payloads, propagate actionable errors to the UI. Avoid overengineering generic frameworks.
- Avoid using remote services to store application data. Network is permitted for installing build dependencies only when explicitly available.

## Non-negotiable engineering rules
1. Respect the working tree. Run `git status --short` first; never overwrite unrelated user changes, force-push, reset hard, or rewrite history.
2. Implement a coherent, testable vertical slice per milestone. Do not fake working screens with only in-memory data when persistence is in scope.
3. Prefer explicit stable IDs (UUIDs) to names as relational keys; references and backlinks must survive renames.
4. Use parameterized SQL, foreign keys, schema migrations, validated input, safe file paths, and careful error handling.
5. Autosave must persist reliably and surface failure. No silent data loss, no destructive migration without a recovery path.
6. A note mention and a factual relationship are different edge types. Every asserted relationship should be attributable to its source when possible and support certainty: confirmed, suspected, disproven or unknown.
7. Use a generic character model initially. Do not invent D&D/Pathfinder rules or bundle copyrighted spell text. Future ruleset adapters belong behind an interface.
8. Handle empty, loading, error, confirmation and keyboard states; consider accessibility and navigation.
9. Add focused automated tests with domain changes. Repair test/build/type errors caused by your changes before declaring completion.
10. Never claim a check passed if it was not actually executed. Mark unsupported-platform verification as pending, not successful.
11. Do not commit secrets, DB files, backups, personal campaign notes, local images, generated output, or `node_modules`.
12. Keep a brief, truthful `docs/STATUS.md` checkpoint after meaningful milestones so fresh Codex sessions can continue cheaply.

## Required Git workflow - mandatory
Create a Git commit **after every important, coherent implementation or change** (feature, DB migration, major fix, meaningful refactor, significant UI feature, architecture decision). Avoid micro-commits for each tiny edit; split unrelated changes into independent commits.

Before every commit:
- Review `git status --short`, relevant `git diff` and `git diff --check`.
- Execute relevant checks: lint, TypeScript typecheck, targeted tests, Rust tests, and app build where feasible.
- Stage **only relevant files** explicitly, check `git diff --cached`, and keep unrelated modifications untouched.
- If a required validation fails, try to fix it before committing. Never disguise known regressions. If the environment prevents running a check, document precisely why and what was verified instead.
- If Git identity is missing, **do not invent a name/email**: explain the required `git config user.name` / `git config user.email` commands. Complete the code and report the pending commit honestly.
- **Never push to a remote** without user authorization. Do not use destructive Git commands.

Commit format:

```
feat(knowledge): aggiunge collegamenti e backlink alle pagine

Motivo:
- Permette di navigare dai diari alle entita' della campagna.

Modifiche:
- Introduce riferimenti persistenti basati su ID stabili.
- Mostra i backlink raggruppati per pagina e sessione.
- Gestisce pagine mancanti e rinominate.

Verifiche:
- pnpm typecheck: superato.
- pnpm test: superato (test link e rename).
- cargo test: non eseguito; toolchain non disponibile [only if true].

Impatto e note:
- Migrazione DB 002 aggiunta; nessuna cancellazione dei dati.
- Nessuna modifica incompatibile [only if true].
```

Use Conventional Commit title `type(scope): titolo breve` (e.g. `feat`, `fix`, `refactor`, `test`, `docs`, `build`), ideally <= 72 characters. Body MUST be substantial and specific: reason, what changed, test evidence, migrations/compatibility, outstanding limitations. Never use generic messages like "fixes" or "updates". Use `git commit -m ... -m ...` or a commit message file, preserving the full body. No empty commits.

## Completion response contract
Respond in Italian, briefly and honestly:
- What works now (not what is merely planned).
- Which relevant checks were actually run, pass/fail/blocked.
- Git commit hashes + complete subjects, or why commits are blocked.
- Known constraints and the next exact milestone from `ROADMAP.md`.
Avoid printing entire files or huge build logs; refer to paths and meaningful diffs.

## Utilizzo delle Skill

Prima di iniziare una nuova attività, identifica le Skill effettivamente disponibili nell'ambiente Codex.

- Valuta se esistono Skill pertinenti alla richiesta.
- Quando una Skill è pertinente, consulta il relativo SKILL.md e applicane le istruzioni.
- Utilizza Skill specializzate per frontend, design, architettura, testing, debugging, database e sicurezza quando disponibili e appropriate.
- Non richiamare Skill prive di attinenza con l'attività.
- Non dichiarare di aver utilizzato una Skill senza averne realmente letto e seguito le istruzioni.
- Se una Skill non è disponibile, continua utilizzando gli strumenti ordinari e segnala la limitazione soltanto se rilevante.
- Le Skill non sostituiscono i requisiti di Nodex, i test obbligatori o le regole Git definite in questo repository.

Nel riepilogo di ogni implementazione importante, indica brevemente quali Skill sono state utilizzate e per quale motivo.
  