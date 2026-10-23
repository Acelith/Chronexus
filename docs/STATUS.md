# Stato Nodex — 23 ottobre 2026

## Milestone

M0 e M1 completate. M2 in corso: persistenza completata, UI da integrare.

Checkpoint M2: migrazione 003, pagine tipizzate, alias e menzioni con backlink
transazionali. `cargo test --offline --manifest-path src-tauri/Cargo.toml`:
PASS (13 test); Clippy con `-D warnings`: PASS. Nessuna nuova dipendenza.
Verifica desktop dei collegamenti ancora da eseguire.

Scenario verificato su desktop Windows: crea/rinomina campagna, crea sessioni 12
poi 2, scrive due paragrafi, chiude e riapre il processo; JSON e ID dei blocchi
identici, ordine 2/12 corretto. Anche la battuta aggiunta immediatamente prima
della chiusura è persistita. Grassetto, titoli ed elenchi verificati nell'editor.

## Funziona

- Shell italiana, campagne selezionabili/rinominabili e sessioni con numero,
  titolo e data facoltativa. Nessun dato dimostrativo nel profilo personale.
- Rust + SQLite locale con migrazioni 001/002, UUID e confini di campagna.
- BlockNote italiano, documento JSON canonico, autosave serializzato (500 ms),
  stato visibile, riprova e flush prima di navigazione/chiusura normale.
- Errori di accesso/salvataggio visibili; fallimento blocca la navigazione.
  Revisioni obsolete non possono sovrascrivere altre modifiche.
- Eseguibile release Windows prodotto e avviato con asset incorporati e DB reale.

## Verifiche effettive

| Comando / prova | Esito |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm format:check` | PASS |
| `pnpm test` | PASS, 8 test UI/autosave |
| `pnpm peers check` | PASS, nessun conflitto |
| `cargo test --offline --manifest-path src-tauri/Cargo.toml` | PASS, 7 test DB/migrazioni |
| `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `pnpm build` | PASS; avviso dimensione chunk editor |
| `pnpm build:desktop` | PASS Windows x64 release, senza installer |
| `node scripts/desktop-smoke.mjs prepare` / `verify` | PASS, WebView2 + Rust + SQLite reali |
| Avvio release `http://tauri.localhost/` | PASS, shell e lettura campagne senza server di sviluppo |
| macOS/Linux, installer e QA manuale estesa | NON ESEGUITI |

Rust locale in `.tools/` (ignorata). Per riusarlo: istruzioni PowerShell nel README.
Il sandbox impedisce scrittura dell'indice Git, TLS Cargo e accesso app-data:
le operazioni interessate sono state eseguite fuori sandbox. Il tentativo nativo
computer-use non ha ottenuto accesso alla finestra entro il timeout; QA reale
eseguita mediante collegamento alla WebView, con screenshot ispezionato.

## Commit

- `6b7c073 build(core): inizializza desktop Tauri e archivio SQLite locale`
- `34f480b feat(journal): persiste campagne e sessioni con revisioni sicure`
- Il commit editor M1 contiene questo checkpoint e il protocollo `docs/QA.md`.
- I documenti iniziali sono stati preservati; commit utente `5251e99`.
- Nessun push remoto.

## Limiti noti

1. Nessun backup/ripristino fino a M4; nessuna cancellazione o archiviazione esposta.
2. Chiusura forzata o blackout possono perdere modifiche non ancora salvate.
3. Conflitti tra istanze richiedono copia degli appunti e riapertura; nessun merge.
4. Editor caricato separatamente ma chunk ~947 kB minificati; ottimizzazione M6.
5. QA multipiattaforma, installer, note molto grandi e accessibilità manuale estesa pendenti.

## Prossimo passo esatto

**M2 — Codex pages, `[[links]]` and backlinks**. Verifica obiettivo: digitare
`[[Varek]]` nella Sessione 12, aprire la pagina, vedere il backlink, rinominarla
e ritrovare collegamento e backlink corretti dopo riavvio.

Skill applicate: frontend-design (tema e revisione visiva),
vercel-react-best-practices (caricamento differito editor e stato derivato).
computer-use consultata per QA; limite di accesso descritto sopra.
