# Stato Nodex

## M0 — completata

- Shell italiana Tauri 2 / React / TypeScript strict, tema scuro e stato vuoto.
- SQLite Rust, migrazione 001 tracciata e smoke test scrittura/chiusura/riapertura.
- Verificati: `pnpm lint`, `pnpm typecheck`, `pnpm test` (1 test), `pnpm build`: PASS.
- Rust locale `.tools/`; Cargo necessita accesso fuori sandbox per TLS Windows.
- `cargo test --offline --manifest-path src-tauri/Cargo.toml`: PASS (1 test DB).
- `cargo build --offline --manifest-path src-tauri/Cargo.toml`: PASS Windows debug.
- `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: PASS.
- Avviato eseguibile Windows fuori sandbox, processo attivo senza errori; verifica
  visiva non ancora eseguita. Il sandbox nega la directory app-data: serve esecuzione normale.
- macOS/Linux: NON ESEGUITI. Installer rinviati a M6.
- Documenti iniziali preservati, nel frattempo registrati dall'utente in `5251e99`.
- Passo successivo: M1, campagne/sessioni/editor e autosave con persistenza reale.

## M1 — persistenza completata, interfaccia in corso

- Comandi Rust: creazione/elenco/rinomina campagne, creazione/elenco sessioni,
  salvataggio documento con revisione. Migrazione 002 additiva.
- `cargo test --offline --manifest-path src-tauri/Cargo.toml`: PASS, 5 test
  (riapertura con 2 paragrafi, ordine, migrazione M0, isolamento, validazione,
  conflitti e DB non scrivibile).
- Ultimo commit: `6b7c073 build(core): inizializza desktop Tauri e archivio SQLite locale`.
- Prossimo passo: completare e verificare editor BlockNote e autosave M1.
