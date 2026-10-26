# Current local models — M18

Qwen3.8-27B is the primary model for assistant, wiki translation, and tool
string translation locale. Gemma 4 12B is the faster secondary option
and remains the only qualified base for M8 training. Both are multilingual,
not specifically trained for D&D. No external AI services are called.

## Explicit Preparation

Install a compatible Ollama runtime, start it with cloud disabled, and download
only the chosen model before offline use:

```powershell
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_HOST = '127.0.0.1:11434'
ollama serve
# In another terminal, using the same runtime:
ollama pull qwen3.8:27b-q4_K_M
# Optional, only if you want the alternative:
ollama pull gemma4:12b
```

The download of the qualified 27B includes approximately 17,74 GB of weights/projector.
Allow space for runtime, temporary files, and data; no weights are included
in the app installer, in Git, or in backups. Ollama verifies the downloaded blobs;
Chronexus checks the approved local identity before sending the context.
If a tag changes weights, it is not automatically approved: a new qualification is required.

In the app, press **Check Ollama and GPU**, select the model, confirm consent
and activate it for the campaign. Gemma already active remains so; it is not replaced
silently. The old Qwen choices are disabled by the migration
018, leaving name, digest, conversations, and citations intact. The 017 backups
remain restorable; a 018 schema requires this version or later.

The wiki has an independent selector, with Qwen as primary and Gemma as secondary:
**Translate** is always required to generate. No alternative model is attempted
automatically. Already generated copies are read without runtime. Historical v1
copies remain in the archive, but are not attributed to the new model.

## Identity and provenance

Verified sources on October 25 2026: [official Qwen](https://huggingface.co/Qwen/Qwen3.8-27B) checkpoint,
[official Ollama](https://ollama.com/library/qwen3.8/tags) tags.
Qwen license declared Apache-2.0. The **non MTP** tag is used
`qwen3.8:27b-q4_K_M`, text only, without images/OCR or exposed reasoning.
The shared policy is `src/ai-models.json`; the qualified hashes are:

| Model | Identity | SHA-256 |
| --- | --- | --- |
| Qwen3.8-27B | Ollama Manifest | `25b843619e944cd0ae6069f94ff4e5e26a16e109ccbc0a66a0f05979ed70098e` |
| Qwen3.8-27B | GGUF, 16.810.714.464 byte | `f5f1dd8920d417aac2718b0bda3403da274301efdd6760b4f0f4b864ff2ad57d` |
| Qwen3.8-27B | Projector, 931.146.016 byte | `ac3714bfdddeca31351f2752bf1a63f266f4df87c0b68c895e44945ca704448e` |
| Gemma 4 12B | Ollama Manifest | `6114515d63c17436a7c0417d82820ac65ad643e2806c5a3c89cb62846436ed0b` |
| Gemma 4 12B | GGUF | `bb722270d54346adc198f213851dbe0207e87c3ecf2a0aff4d92262726215391` |

The Qwen GGUF was reread and also independently verified with SHA-256.
Gemma provenance/license and QLoRA checkpoint remain in [AI_TRAINING.md](AI_TRAINING.md).
Qwen3.8-Max is not this model and is not supported.

## Actual Windows Qualification

RTX 4080 SUPER 16 GB, RAM 61,6 GiB (approx. 31 GiB free at startup), Ollama
0.40.10. With Q4_K_M, context 8192, batch 256 and **48 GPU layer**, the runtime
reports 17.628.533.879 bytes loaded of which 12.211.349.093 GPU: execution
**mixed GPU/RAM**, never presented as entirely GPU. `nvidia-smi` measures
approximately 12,7 GB used and 3,3 GB free during the test. Other loads reduce the
margin. 99 layer configuration discarded: memory pressure and 105,104 s
for a short response; the full comparison uses only the 48 profile.

| Test with identical synthetic sources | Qwen 27B, 48 layer | Gemma 12B, 99 layer |
| --- | --- | --- |
| 20 campaign, 10 rules/editions, 5 absences | 35/35 | 35/35 |
| Median short response | 3,016 s | approximately 0,27 s |
| p95 short response | 4,570 s | approximately 0,51 s |
| Loading with hot disk cache | 4,568 s | 4,439 s |
| Full benchmark via app | 40/40 | 40/40 |

The five additional cases of malicious instructions are blocked by the app before
inference. Valid citations, campaign/edition separation and canonical data
unchanged; no reasoning exposed. It is not a general assessment of
knowledge or a guarantee of rule correctness. `/api/ps` of Gemma MTP
reports only the draft component: do not use it as total VRAM consumption.

Synthetic translations Qwen Italian/German/Arabic: numbers, negation and radius
preserved after a prompt correction (the first Arabic output confused radius
and diameter). Numerical control does not certify meaning: all remain
drafts. Gemma produced a first Italian response with an additional number,
correctly refused; no weakening of control. QA wiki in the app:
Italian, original intact, cache without runtime, cancellation/cache clear and axe
0 violations. It does not equate to a physical test without network/firewall.

## Repeatability and boundaries

`scripts/qa/local-ai-evaluation.mjs` uses isolated empty synthetic profiles,
`CHRONEXUS_AI_QA=isolated`, CDP port 9227; for comparison explicitly choose
`CHRONEXUS_TEST_MODEL=gemma4:12b`. The report excludes real data.
`scripts/qa/m18-migration.mjs` restores only the synthetic backup schema
017 prepared in testing and verifies deactivation, history/citations, consent,
Gemma preserved and training enablement. Fixtures and reports are outside Git.

Fixed loopback, no proxy/redirect/cloud fallback, GPU preflight before
text. CPU only, runtime/model absent, cloud not verified or identity changed
produce an error. In case of insufficient memory, do not change model
automatically. Retrieval refresh remains distinct from training; QLoRA Qwen
not qualified. Other GPUs, macOS/Linux, real installation and physical offline
test remain pending.


## Guided installation (M22)

**App Settings → Local AI: components** allows, always after a click:
component control; installation of Ollama 0.40.10 from the official
GitHub with SHA-256 `d52aea2d323bdd324bf66a4b1226844aa5fb665cc5974fbcceceda1ce3d934eb`
(1.586.229.413 bytes) in `ai-runtime/ollama-0.40.10` of the data folder; managed start and
stop of the runtime (closes with Chronexus, `OLLAMA_NO_CLOUD=1`, models in
`ai-runtime/models`); download of only the chosen model via the active runtime,
declared ready only with qualified weights. A runtime already active and without cloud
is used without restarting or reconfiguring it. Installing does not enable the assistant:
the choice remains in the campaign settings. QLoRA remains on Gemma and its
components are not downloaded here.
