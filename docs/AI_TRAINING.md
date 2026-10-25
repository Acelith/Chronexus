# Current Status M18

Qwen3.8-27B is primary for inference; Gemma 4 12B remains secondary and
**the only qualified base for QLoRA**. With Qwen, the retraining button
is disabled with an explanation, even though the worker is installed. The activation
of a Gemma adapter remains explicit, limited to the campaign and valid sources.
No training of the 27B is promised or performed. [Qualification](AI_MODELS.md).

# M8 — Gemma and campaign learning

M8 introduces local **Gemma 4 12B** and AI settings for a single campaign.
The model is multilingual: we do not present it as a model specifically trained
for D&D. Responses continue to use local sources with
citations; neither the base model nor an adapter become sources of facts.

## Verified models and runtime

- Inference: Ollama 0.40.10, `gemma4:12b`, Gemma 4 Unified 11.9B Q4_K_M.
  The checkpoint is available in the [Ollama](https://ollama.com/library/gemma4:12b) catalog
  and described by the [Google](https://ai.google.dev/gemma/docs/core) documentation.
- GGUF weights qualified for the merge:
  `bb722270d54346adc198f213851dbe0207e87c3ecf2a0aff4d92262726215391`.
  A tag update requires a new qualification: we do not accept weights
  different just because they have the same name.
- Training: Google `google/gemma-4-12B-it` checkpoint, revision
  `707f0a3b8a3c7ad586ed01e27eafbad8a27dd0f7`, safetensors SHA-256
  `5a84cb313260ac447237b890387116dfa8682e49a6b44bc585ae8353abbff18d`.
  The file weighs 23.919.549.408 bytes; it does not enter the campaign backup.
- The verified Ollama version has removed direct support for adapters:
  see `CreateRequest.Adapters` in the [runtime code](https://github.com/ollama/ollama/blob/v0.40.10/api/types.go).
  Chronexus keeps the compact adapter and applies its updates to a
  GGUF copy for inference. Unaffected tensors remain unchanged;
  updated ones are saved as F16. The base model remains immutable.
- Loading Gemma uses batch 256: the previous Qwen 64 batch caused
  a multimodal projector error in the verified runtime. No OCR or
  sending photographs to the model is introduced by M8.

## Use in the app

1. Start local Ollama with cloud disabled, as described in
   [AI_LOCAL.md](AI_LOCAL.md). The explicit model setup is
   `ollama pull gemma4:12b`, on the chosen runtime, before offline use.
2. Open the campaign → **Campaign Settings** → **Local AI**.
   Check Ollama, choose Gemma, confirm the multilingual model and
   activate it for that campaign. Qwen3.8-27B is the first choice for inference;
   the previous Qwen3 4B is retired.
3. Choose edition, note types, approved Wiki sources and
   context/response limits. Save. Excluded sources do not enter either the questions
   or the training. Wiki sources must already be local and from the same
   edition. The Assistant section uses this selection.
4. **Update knowledge** reconstructs the derived search and records the
   source footprints. It does not modify weights or adapters. Retrieval continues
   to read current notes even between two manual updates.
5. **Retrain on new data** shows the differences compared to the last
   successful training, then asks for confirmation. It uses the current complete
   snapshot of approved sources, instead of accumulating obsolete data in the old
   adapter. A preview changed in the meantime is rejected by the backend.
6. Preparation, training, import, and validation have distinct states.
   Only the actual training steps have a counter. It is possible to
   cancel; navigation waits for cancellation before changing pages.
7. After the checks, **Activate adapter** appears. Training alone does not
   change the active model. To go back, choose the base model,
   or a previous adapter still compatible with the current sources.

Opening the settings only reads SQLite. It does not start downloads, inference,
training, or requests to the runtime. The only endpoint used by the app is the loopback
Ollama already expected in M7; there are no cloud fallbacks.

## Optional backend preparation

Training requires a separate environment; the button remains disabled if
the necessary files are missing. The already generated M7 installer does not contain this
environment, the Google checkpoint, or the new M8 build.

On Windows with Python 3.12 and NVIDIA CUDA GPU:

```powershell
powershell -File scripts/Setup-Training.ps1 -PythonPath "C:\percorso\Python312\python.exe"
```

The script installs the dependencies in the environment only
`%APPDATA%/it.nodex.desktop/ai-training/venv` downloads the fixed revision in
`hf-base`. It does not install global services. Preparation requires a network and
several dozen GB of free space; starting the training is a separate action.
The script must not be executed from a campaign attachment.

Versions: PyTorch 2.14.1+cu130, Transformers 5.20.2, PEFT 0.21.2,
bitsandbytes 0.50.2; dependencies in `scripts/ai/requirements.txt`.
Licenses verified on the metadata and LICENSE files of the installed versions:
Transformers/PEFT/Accelerate and safetensors Apache 2.0, bitsandbytes and gguf MIT,
psutil BSD-3-Clause; PyTorch includes multiple permissive licenses listed in its
package. The [Google](https://huggingface.co/google/gemma-4-12B-it) checkpoint
is Apache 2.0. The licenses remain in the isolated environment; the new installer
app does not redistribute these libraries or the weights.

The worker distributed with the app uses only local files, `trust_remote_code=False`,
cache Hugging Face offline and telemetry disabled. Does not execute instructions
contained in the notes. The worker terminates even if the Chronexus process
that started it disappears.

In debug, `CHRONEXUS_TRAINING_HOME` can indicate an isolated environment; the override
does not exist in release builds. Windows NVIDIA is the tested platform;
CUDA not available produces an error, without CPU/cloud fallback. Training
macOS, other accelerators, and Linux are not yet verified.

## What the adapter learns

The initial profile uses QLoRA NF4, rank 4, alpha 8, q/output projections of the
last four blocks (44–47), from 8 to 8000 steps. The text of each extract is divided into windows of
64 tokens, without silently cutting off the ends; every fragment enters the
training at least once. Beyond 8000 fragments, the job is rejected, asking
to reduce the sources, rather than training only the first examples. The examples teach how to
report the notes by citing them and keeping the claims as testimonies.
It is not a full training of all weights, nor a reliable storage
proof of an entire campaign. Loss and tensor changes do not demonstrate
by themselves increased accuracy: response verifications are required.

AI conversations, images, and original Logseq are excluded as separate channels.
Only current supported extracts are used, with size and provenance limits.
Extracts with explicit model instruction signals
block training until they are excluded or separated from the narrative text.
This guard is not an absolute semantic guarantee.

If an extract or the source selection changes, a previous adapter does not
it can be used for new questions until it is retrained or one returns to the
base model. We do not claim that incremental training can automatically
erase what was previously learned.

## Persistence, backup, and recovery

- Schema 013: settings and knowledge footprints per campaign. It preserves
  the explicit M7 choice for existing campaigns; new campaigns are deactivated.
- Schema 014: training history, base model, source footprints,
  configuration, metrics, outcome, adapter, and checksum.
- Safetensors adapters and relative configuration are managed campaign
  attachments, with UUID and hash. The backup verifies properties and integrity; a
  missing or modified file stops the backup/restore. Archive limits remain:
  256 MiB for files and 512 MiB total; maximum M8 adapter 64 MiB.
- Base weights, Python environment, working dataset, logs, and derived GGUF copies
  remain outside the ordinary backup and Git. Temporary files are in the
  `ai-training/jobs` folder; they are not the canonical notes.
- After restoration, **Activate adapter** locally reconstructs the derived weights
  if missing in Ollama, using the saved adapter and the same base GGUF. It repeats
  validation before activation; it requires the local environment and the base model,
  without automatic downloads or new training.
- An interrupted job is flagged upon restart. No failed or canceled job
  replaces the active model. Previous backups are migrated in copy.

## Evidence and limitations

The Windows test on the RTX 4080 SUPER 16 GB actually completed eight
steps on four synthetic extracts: modified adapter tensors, peak
11.705.906.688 bytes allocated by PyTorch (approximately 10,9 GiB). Ollama merge and import
successful; three checks of responses/citations/GPU before activation.
A question without a source on the color of Arven's cloak did not yield an
invented fact; after adding the note, training, and activation, the response
reported **indigo** with citation. These are tests on synthetic data, not a
quality guarantee on any campaign.

The initial comparison performed four cases with Qwen and the same four
with Gemma in the app, all with the expected outcome. The VRAM count of `/api/ps` of the
runtime with draft MTP does not always describe the entire model: offload logs
and GPU measurements are distinct pieces of evidence. Do not interpret the sole ratio between
`size_vram` and `size` as a complete measure of physical memory.

Further checks, current checkpoint, and acceptance limits are in
[STATUS.md](STATUS.md). The physical offline/firewall and macOS/Linux test remain
separate from the libraries' offline options and loopback observations.


Further real test: 74 synthetic extracts, 74 examples, and 74 GPU steps, with
coverage check, activation, and question on the last source successful. The
original test profile was then restored. The previous limit
of 64 steps, discovered in review, was corrected and covered by regression.


## Repeat native checks

Only on an isolated and initially empty debug profile under `.tools/`, with
Ollama cloud-off, Qwen/Gemma installed, and backend prepared. Start Vite and
Chronexus debug with `NODEX_DEV_DATA_DIR` absolute, separate WebView, and debug port
9223; the worker can use `CHRONEXUS_TRAINING_HOME` in debug. Set
`NODEX_DEV_BACKUP_FILE` and `NODEX_DEV_RESTORE_FILE` on the same new file
`.tools/m8/native-trained.nodex`, never on personal backups.

Set `CHRONEXUS_AI_QA=isolated`, then run separately:

```sh
node scripts/qa/m8-local-ai.mjs seed
node scripts/qa/m8-local-ai.mjs train
node scripts/qa/m8-local-ai.mjs recover
node scripts/qa/m8-local-ai.mjs boundaries
node scripts/qa/m8-local-ai.mjs coverage
```

Restart the same isolated app before each phase; `recover` verifies
the restart as well. `seed` requires an empty archive; the following phases check
the fixture names. `recover` and `coverage` remove only derived models
of the fixture to test reconstruction and cleaning; do not use on personal data.
Reports and screenshots remain in `.tools/m8`, not in Git. The M8 installer
contains the updated worker but not the weights or the CUDA backend; the M8 installation
was not repeated.
