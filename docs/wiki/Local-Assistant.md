# Local assistant (optional)

The assistant answers questions about **one campaign's notes** — "where did we last see
the cartographer?" — with citations you can reopen. It runs on your computer by default;
you can explicitly choose a compatible sharing server for one campaign instead.

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

## Running it on the sharing server instead

If the campaign is linked to a sharing server whose operator enabled **server AI**,
**Campaign settings → Where the assistant runs** lets you choose *On the campaign's sharing
server*. Press **Check the server AI**, pick one of the installed models and **Use this
choice**. Questions then go to the server with the model name; it answers only from what you
can read there in this campaign (synchronized items and what others share), never from notes
kept only on your computer, and it stores neither questions nor answers. If the server is
busy, over your hourly limit or unavailable, the app says so and offers **Switch this
campaign to local AI**; it never switches by itself. Server models are not qualified yet.

## Campaign retraining (advanced)

With Gemma, **Campaign settings → Local AI → Retrain on new data** prepares a small
campaign-specific adapter on your GPU. It is activated only when you choose so. **Update
knowledge** refreshes the search index without retraining. Adapters are included in
backups; model weights are not.
