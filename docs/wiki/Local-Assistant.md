# Local assistant (optional)

The assistant answers questions about **one campaign's notes** — "where did we last see
the cartographer?" — with citations you can reopen. It runs entirely on your computer.

## What it is and is not

- **Off by default**, enabled per campaign by you.
- Runs on your **graphics card** (NVIDIA) through Ollama, with cloud features verified
  off. If no suitable GPU is available, it refuses before sending any note to the model.
  There is no cloud fallback.
- Uses only the notes of the campaign you ask about and the wiki entries you approved.
- **Never changes** notes, relationships, the sheet or inventory.
- Models: **Qwen3.8-27B** (primary) and **Gemma 4 12B** (secondary). They are general
  multilingual models, **not trained on D&D**. A valid citation does not make an answer
  true — check the source.

## Setting it up

1. **App settings → Local AI: components** installs Ollama and the chosen model from their
   official sources, with integrity checks. Downloads start only when you press the
   button.
2. In the campaign, open **Local assistant**, check the runtime and activate the model.

## Campaign retraining (advanced)

With Gemma, **Campaign settings → Local AI → Retrain on new data** prepares a small
campaign-specific adapter on your GPU. It is activated only when you choose so. **Update
knowledge** refreshes the search index without retraining. Adapters are included in
backups; model weights are not.
