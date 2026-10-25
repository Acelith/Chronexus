# M9 — Tiradadi and the circle of dragons

Open a campaign and select **Tiradadi** in the left menu. Add dice by clicking
their icon or the +/- buttons, or type the quantity. Available
dice are d4, d6, d8, d10, d12, d20, and d100; they can be combined in the same roll.
The d100 gives an integer from **1 to 100**, including the extremes: zero is not a result.

## Compose and roll

Maximum 50 dice per type and 100 total. Quantities must be integers,
non-negative, with at least one die selected. The composition is shown before
the roll. **Roll the dice** records the results in SQLite before starting the scene;
only after confirmation do the quantities all become zero. An error preserves the
selection: retrying with the same composition reuses the request ID.

While the roll is being recorded or animated, a second one cannot be started.
Normal closing waits for the ongoing recording. An interrupted scene,
a view change, or a restart leave the roll viewable in the chronicles.

The sequence lasts about 2,5 seconds: rolling, landing, dragon fire,
revelation, and fast-scrolling digits. **Skip animation** shows the same result
immediately. The system's reduced movement avoids rolling, flames, and
scrolling of digits. The total is not shown in advance in the history during
the scene; the roll is nevertheless already saved. Once the sequence is finished, stable
values remain, independent of the graphic effects.

In the scene, a maximum of 14 dice are shown, distributed among the chosen types.
The actual quantity and all values, subtotals, and the total are in the result detail.
The numbers 6 and 9 have a lower reference; the type is indicated
also as text. For large rolls, the duration does not increase with the number of dice.

## Chronicles, backup and export

Chronicles belong to the current campaign and load 30 rolls at a time.
Expand a row to read all values; **Show in circle** reviews the roll
without generating or recording another. **Load previous rolls** continues the history.
The confirmation of a roll is permanent: no deletion/modification is provided in M9.

The history is included in the full backup `.nodex`, with counting and validation,
and in the `diceRolls` field of the campaign's JSON export. Restoration accepts the
previous archives: they are migrated with an initially empty history. The additive migration
**015** adds `dice_rolls` and the history index; existing documents and UUIDs
do not change. The 015 archives require a version of Chronexus that
supports this schema; previous versions must not open them for writing.
Graphic assets are app resources, not campaign attachments.

## Randomness, integrity and protocol

`src-tauri/src/dice.rs` uses 32-bit words from `getrandom::fill` (operating system randomness).
Rejection sampling discards the tail not divisible by the number of faces before the modulo:
avoids modulo bias on uniform words.
Deterministic tests cover extremes, outliers, and errors; the few observed rolls
are not presented as a statistical demonstration of the generator's quality.
The intermediate digits of the slot effect are only graphics and not extractions.

Local commands:

- `roll_dice`: `campaignId`, UUID `requestId`, `selections: [{sides, quantity}]`.
  Returns UUID, campaign, UTC date, groups with values/subtotals and total.
  Same ID/campaign/composition returns the previous record without new
  values. A reused ID with a different campaign or composition is rejected.
- `list_dice_rolls`: `campaignId`, `before: null | {createdAt,id}`. Returns
  `rolls` and `nextCursor`. Stable sorting for descending date/ID.

Transaction and unique constraint ensure a single record. UI and backend
validate quantities and types; reading and restoration verify values, subtotals,
total, and correspondence between payload and columns. No AI service or Internet
connection is required to pull. Dragons/fire/WebP material are included in the package;
geometries and figures are rendered by the code. Provenance: `assets/dice/README.md`.

## Repeatable Verifications

- `pnpm test`: includes components, retry, zeroing, errors, and timeline.
- `./scripts/Dev.ps1 -Task test:rust`: includes extremes, rollback, idempotent IDs,
  isolation, index/pagination, restart, backup/restore, and 014 compatibility.
- For native testing, use Vite on port 1420 and a **debug** executable with
  `NODEX_DEV_DATA_DIR` and `WEBVIEW2_USER_DATA_FOLDER` set to absolute folders
  empty under `.tools/m9/`; `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` must contain
  `--remote-debugging-port=9223`. Do not use the personal archive.
- Set `NODEX_DEV_BACKUP_FILE` and `NODEX_DEV_RESTORE_FILE` to the absolute path
  `.tools/m9/qa.nodex`, and `NODEX_DEV_EXPORT_FILE` to `.tools/m9/export.zip` before
  starting. Set `$env:CHRONEXUS_DICE_QA='isolated'` and start
  `node scripts/qa/m9-dice.mjs check`, then `restore`. Close and reopen the app with
  the same folders and start `restart`. Default selection paths are
  available only in debug and the harness rejects campaigns other than the fixtures.
- `check` tests all dice, compares values with SQLite, verifies times, limits,
  interruption/skip, reduced movement, pagination, isolation, windows, axe, and
  blocked remote traffic. Keep previous backups/exports by renaming them in the
  testing folder. Reports and images remain in `.tools/m9`, ignored.
- The **synthetic graphics** fixture, not persisted as a real throw, is available
  with Vite at `/scripts/qa/dice-gallery.html`: shows all types and 6/9/100 for the
  manual verification of figures. It is not an app input or a rigged die.

Windows evidence of 24 October 2026: 85 frontend test, 77 Rust, clippy, lint,
types, format, and desktop build PASS. In native testing, 187 synthetic throws of the
campaign and one of the second were retrieved identical after backup and restart; times
2528/2520/2524 ms for 1/7/100 dice. Axe detected no WCAG A/AA violations in the
tested views; keyboard and 6/9/100 fixtures also verified visually. No
complete certification, NVDA test, macOS/Linux test, new installation, or
test with physically disconnected network declared. Vite warning on pre-existing editor chunk.
The previous installer was not replaced.

Skills applied: impeccable/imagegen for visual identity and offline assets;
accessibility/react-testing for interactions and states; rust-best-practices,
sqlite-expert, and tauri-v2 for persistence/IPC; systematic-debugging/react-doctor
for correcting labels, timers, and the anticipated total.


## Planned Extension M12 — not implemented

For a single overall die: maximum d4/d6/d8/d10/d12/d20 celebrates with both
living dragons and flames around; minimum 1 makes both turn toward the screen and fly
menacingly toward the player spitting fire. Inverted D100: 1 celebrates, 100 threatens.
Intermediate values and multiple/mixed throws do not trigger these special effects.
Saved results, history, and retry remain unchanged; skip and reduced movement
are mandatory. Requirements and verification matrix in ROADMAP.md. No new animation
was realized in this documentary modification.


## M12 — React implementation in final verification

Special outcomes exclusively for a die: d4/6/8/10/12/20 celebrates,
1 threatens; d100 1 celebrates and 100 threatens. Two original bronze SVG actors,
articulated wings/tail, fire breath and front face with approach in
threat. Effects begin upon revelation of the already saved result;
no anticipation before the reveal phase. Ordinary duration 2,5 s,
extremes 3,6 s; skip, static outcome with reduced movement and stop in hidden sheet.
Local replay of the same roll, no new value/RPC/history or modification to the
selection. Physical geometry LTR independent of navigation language.
22 domain/React test PASS, typecheck/lint PASS; desktop visual testing and
expected packages after M13, as requested by the user. No publication.
Skill: frontend-design/impeccable for feedback and actors consistent with the theme,
accessibility for skip/reduced movement, react-testing/react-doctor for verifications.

M12 testing concluded on Windows in isolated debug build 0.2.0: fourteen
extremes obtained from real RNG, two visible actors, replay without new rolls,
ordinary mix, skip/reduced, restart and byte-exact backup/restore of data.
The rotation of the right dragon now uses its own center to stay within the frame.
Screenshots and synthetic reports remain in .tools; no personal data in Git.
