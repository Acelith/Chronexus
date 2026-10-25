# Current Models — M18, 25 October 2026

**Qwen3.8-27B is the first choice; Gemma 4 12B is secondary.** Setup, digest,
requirements and real measurements in [AI_MODELS.md](AI_MODELS.md). The old Qwen3 4B
is no longer executable/selectable in the app: the M7 sections below are historical
evidence, not current rollback instructions. The 018 migration disables the
old choices while preserving responses and citations. No automatic activation.
The `scripts/Start-LocalAI.ps1` launcher only starts the already present runtime;
the model is explicitly prepared as described in the new guide.

# M7 — Local D&D Assistant on GPU

> M8: Gemma 4 12B, settings for campaign and QLoRA training are documented
> in [AI_TRAINING.md](AI_TRAINING.md). The M7 Qwen profile described here remains
> only as historical evidence; M18 withdraws that rollback. Model and sources are chosen for campaign.

Status: functions implemented and tested on Windows; physical offline acceptance
and additional platforms still to be verified. Configuration initially disabled;
the app remains usable without Ollama. Updated results in
[STATUS.md](STATUS.md) and [QA.md](QA.md).

## Approved model choice

The specific D&D candidate [dnd-unified-1.5b](https://huggingface.co/chendren/dnd-unified-1.5b),
[GGUF Q4_K_M](https://huggingface.co/mradermacher/dnd-unified-1.5b-GGUF), was
actually loaded on the RTX 4080 SUPER: 29/29 GPU layers, about 999 MiB resident,
2048 context. SHA-256 weights:
`3cc578dabc0e30a8e7d51d2b27d5e46f5abd118e16fe0e67123ea064fe17b77e`.
It failed three initial Italian tests, repeating prompt/response without concluding.
The sheet declares Apache-2.0, English and 5e/3.5 data; metrics and provenance of
its datasets are not independently validated. Excluded from UI selection.

The user has therefore **explicitly approved a more capable multilingual model
with D&D sources and local campaigns and citations**. The chosen model is
[Qwen3:4b-instruct](https://ollama.com/library/qwen3:4b-instruct), based on
[Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507).
It is multilingual, **not fine-tuned for D&D**. Apache-2.0 license declared by the manufacturers;
no weights redistributed in the repository or in the installer.

- Ollama Manifest: `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
- SHA-256 weights: `85e4a5b7b8ef0e48af0e8658f5aaab9c2324c76c1641493f4d1e25fce54b18b9`.
- Q4_K_M Quantization, approximately 2,5 GB on disk; app context 8192, output 512 tokens.
- Ollama portable 0.40.10; official package verified with release checksum.
- RTX 4080 SUPER, 16.376 MiB, driver 621.01: `/api/ps` reports
  3.710.428.118 bytes resident **all in VRAM**, approximately 3539 MiB at context 8192.
  Hardware and observed consumption are test data, not universal requirements.
- Qwen3:4b standard exhibited reasoning instead of direct answers: use the
  **instruct** variant. Other selectable models are not qualified by these tests.

## Windows Startup

A package with the two installers and all AI files is also available in the
root folder `installers/Chronexus-0.1.0-Windows-x64/`; see [INSTALLERS.md](INSTALLERS.md).
It contains the wrapper manifest updated by Ollama, with the same verified weights.
On an already configured archive, it may be necessary to check and reactivate
the model, as expected by the digest verification; no automatic change.

The runtime and weights downloaded for this session are isolated in
`.tools/m7-runtime`, excluded from Git. No global installation, account or
cloud service. Do not move that folder if you want to reuse them.

1. From the project, run `powershell -File scripts/Start-LocalAI.ps1`.
   The script does not install or download software, does not stop existing services and
   starts Ollama hidden with `OLLAMA_NO_CLOUD=1`, loopback host and isolated weights.
   For a different runtime, pass `-OllamaPath` and, if necessary, `-ModelsPath`.
2. Start Chronexus (`pnpm desktop` in the configured development environment).
3. Open a campaign → **Local Assistant** → **Check Ollama**.
4. Choose `qwen3:4b-instruct`, confirm the multilingual profile with local sources
   and press **Activate local model**. The model remains associated with the digest.
5. Write a question with names/terms present in the notes. In
   **Local D&D Rules** mode, choose the edition and up to six items already open in the Wiki.

For a new machine, a compatible runtime must be installed and the model explicitly
downloaded before offline use. With the portable of this
session, started as above, the command is:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11434'
& .tools/m7-runtime/ollama/ollama.exe pull qwen3:4b-instruct
```

On macOS/Linux, set `OLLAMA_NO_CLOUD=1` and `OLLAMA_HOST=127.0.0.1:11434`
before starting `ollama serve`. These platforms have not been tested here.
Old runtimes that do not expose verifiable cloud status are rejected.
Consult the [official configuration](https://docs.ollama.com/faq).

## Security and Quality Boundaries

- Rust Adapter with fixed host `http://127.0.0.1:11434`, proxy and redirect excluded.
  React uses only Tauri commands: no new host in the CSP, account or telemetry.
- `/api/status` must confirm cloud disabled; `/api/show` must confirm
  GGUF without remote forwarding and SHA-256 of the weights; manifest digest fixed to consensus.
- Preloading **without notes**, then `/api/ps` verification. Exclusive CPU locked
  before source submission; mixed GPU/CPU declared. GPU not inferred from name.
- One generation at a time, timeout, limited NDJSON, cancellation and partial
  saves. Navigation/closing cancel and wait for draft preservation.
- FTS5 Retrieval of the campaign only: sessions, pages, Party, sheet and assets.
  Known names/aliases restrict relevant results; they are not inferences in the graph.
  Up to eight extracts of 1200 characters; summary/block not duplicated as evidence.
  Overall prompt conservatively limited to 7000 bytes, before the runtime.
- It is not a full reading of the campaign, a D&D engine, or a semantic search.
  With a few common words or notes not found, a response present
  elsewhere may be missing. Reformulate with precise names and aliases and check the provided extracts.
- Rules only from the selected Wiki cache: 5e-2014, 5e-2024, 3.5 separate.
  No automatic online search to answer, no collection of commercial
  manuals. Clipped text declared from the copy actually provided.
- Sources with stable ID, block (even Logseq), title, revision and hash; immutable
  copies stored with the response. Citations reopen the source, distinguishing
  current, modified, or missing version. No citation to non-provided IDs accepted.
- Instructions in the documents are data, not commands. No tool or model access to
  DB, file, or shell. Never modifies notes, relations, counters, or assets.
- A prudent lexical gate excludes extracts with explicit instruction signals
  directed at the model before submission and shows their number. Other clean sources
  remain usable; if all are suspicious, the request stops and preserves
  copies for review. Metadata records excluded IDs and context submission.
  Possible false positives and unrecognized attacks: it is not an infallible defense.
- Citation checking is structural, **does not verify truth**. The model
  may be verbose, misinterpret a doubt, or cite a less relevant source.
An error response remains an unverified draft, visible for inspection.

## Persistence and portability

Additive 012 migration: settings and individual questions/answers with sources and metrics.
Maximum 1000 responses per campaign, paginated history at 50; explicit deletion.
The history is not used as a source or hidden memory for new responses.
Restart recovers interrupted generations. No writing of responses in the profile
activated by a restore while an old generation is still in progress.

`.nodex` Backup: includes conversations, sources, configuration/digest in the DB and in the
manifest; **excludes runtime and weights**. ZIP Export: `assistantConversations` in JSON
and Markdown per response, with copies/hashes of sources. Old backups migrated to copy;
new backups require a version compatible with the 012 schema. Legacy identifiers
preserved. Lack of runtime does not prevent consultation or restoration of notes.

## Verifications and repetition

Rust Tests: campaign isolation, names/aliases, blocks/renames, Party, editions,
limits, HTTP/redirect/cloud protocol, invalid citations, persistence, recovery,
backup/restore and export. React Tests: consent, no runtime contact on opening,
streaming/cancellation/guard, changed sources and confirmed deletion.

Final Benchmark: 40/40 scenarios with expected outcome, namely 20 campaign, 10 original
test rules in conflict between editions and 5 questions without response with
real GPU inference; 5 malicious instructions blocked before the model. Canonical data
unchanged. Does not mean universal accuracy: the first tests without gates have
shown invented citations, repetition of attacks, and misleading doubts.
With 8192 context: observed times 365–3060 ms, average about 1499 ms on the 35
questions of the last execution; GPU load and first startup may change them.
Verified 63 Rust tests, 55 React, cancellation after GPU token and restore/restart
of 90 conversations with sources without Ollama. Simulated OOM/CPU errors, not physical faults.
`node scripts/qa/local-ai-evaluation.mjs` requires `CHRONEXUS_AI_QA=isolated`, profile
debug **empty** `NODEX_DEV_DATA_DIR`, CDP 9223, Vite 1420 and configured Ollama.
Create only fictitious campaigns; results in `.tools/m7-runtime`. Keyword checks are a first
measure: also review responses/citations; do not
mistake a formally valid citation for semantic accuracy.

Local testing with cloud disabled, external proxies unreachable, and connection
checks is not equivalent to a physically disconnected network or firewall blocking.
The latter verification and the macOS/Linux packages remain to be executed; do not alter
computer connectivity or user processes to complete a test.

Primary sources consulted on October 23 2026:
[Ollama API](https://docs.ollama.com/api/introduction),
[GPU and configuration](https://docs.ollama.com/faq),
[portable release](https://github.com/ollama/ollama/releases/tag/v0.40.10),
[model and license](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507).


### M10 — global linguistic preferences

Changing the UI language does not activate Ollama/GPU, does not send notes, and does not change the
model or campaign permissions. Public checks and diagnostics have
local catalogs; questions, answers, citations, and sources retain the original texts.
Interface translation drafts were prepared on UI strings only,
not on campaign datasets. Do not confuse this development step with a
new training of the D&D model. Details and limits: I18N.md.
