# Stato Chronexus — 23 ottobre 2026

## Milestone

**M0–M5 ed estensione scheda/catalogo completate. M6 non iniziata.**

Ultimo scenario reale Windows: scheda Neme compilata nelle sezioni del PDF,
Magic Missile scaricato dall'API e personalizzato come Dardi di Neme; creazione
di Segnale delle memorie con testo originale. Ricerca classi, equipaggiamento e
regole/sottosezioni. Riavvio, consultazione offline, backup e ripristino su profilo
vuoto, secondo riavvio: scheda, incantesimi, fonti, UUID e cache identici.
Gli aggiornamenti API falliti mostrano l'avviso della copia locale.

## Funziona

- Nome pubblico, finestra, pacchetti ed eseguibile: Chronexus/chronexus.
  Identificatore `it.nodex.desktop`, database `.sqlite3`, `.nodex` e variabili
  debug legacy conservati. Il profilo M4 è stato riaperto senza spostare dati.
- Campagne, diario/autosave, Codex, `[[`, backlink e grafo M0–M3 conservati.
- Personaggio generico per campagna: identità, sistema libero, livello/esperienza,
  PF, condizioni/note e statistiche configurabili. Risorse/slot con UUID stabili
  e contatori +/− salvati immediatamente, senza formule o consumi automatici.
- Scheda estesa: combattimento/sensi, competenza/maestria e modificatori manuali,
  ispirazione/tiri morte, armi/munizioni, storia e competenze, denaro/carico e
  magia. Preset etichette D&D 2014 senza sostituzioni; slot 1–9 inizialmente a zero.
- Inventario: CRUD con revisioni, quantità anche zero, equipaggiamento, categoria,
  peso/valore liberi, consumabili e note; provenienza sessione/blocco/PNG/luogo/
  missione e pagina Codex. Eliminazione confermata, fonti conservate.
- Incantesimi/capacità manuali, rituale/concentrazione, conosciuta/preparata
  indipendenti. Catalogo SRD 2014 opzionale, filtri locali, anteprima e importazione
  esplicita modificabile con fonte e attribuzione. Ricerca dal modulo personale;
  nessun upload. GET solo sull'host approvato, 10 s / 2 MiB e cache SQLite 150 voci.
- Moduli con salvataggio esplicito, errori che conservano input, guardie contro
  navigazione/chiusura, stati vuoti/lettura fallita e Tab/Escape nelle conferme.
  Navigazione alle fonti con ritorno alla voce selezionata.
- Backup/ripristino M4 comprende scheda estesa e cache. Migrazioni 005/006
  additive, FK composite, transazioni e controlli Rust. Backup schemi 1–6 leggibili;
  nuovi archivi richiedono una build che supporti lo schema 006. JSON M5 ha default
  per i campi aggiunti; niente cancellazioni o rinomina dei percorsi dati legacy.

## Verifiche effettive

| Comando / prova | Esito |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | PASS |
| `pnpm test` | PASS, 39 test in 10 file |
| `cargo test --offline --manifest-path src-tauri/Cargo.toml` | PASS, 40 test; test cache ripetuto dopo aggiunta caso orologio arretrato |
| `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo build --offline --manifest-path src-tauri/Cargo.toml` | PASS, debug Windows x64 |
| `pnpm build:desktop` (include `pnpm build`) | PASS, release Windows x64 senza installer |
| `scripts/sheet-catalog-smoke.mjs prepare/verify/restore/verify-restored` | PASS, API e desktop/SQLite/ZIP reali; solo indisponibilità rete simulata nei passi offline |
| Scheda caricata a 760/1200 px e screenshot compendio | PASS, nessun overflow, lettura visiva completata |
| Collegamento API nella release con origine `tauri.localhost` | NON ESEGUITO; build release compilata, ricerca provata nel desktop debug |
| macOS/Linux, installer, rete/disco esterno e QA assistiva estesa | NON ESEGUITI |

La prova desktop usa solo la scelta file predefinita nel debug con profilo
esplicito: persistenza, comandi, ZIP e validazioni sono reali. La procedura nativa
completa dei selettori rimane da verificare (limite QA M4). Dati sintetici in
`.tools/sheet-catalog-final-source` e `.tools/sheet-catalog-final-restored`, ignorati da Git. Nessun dato di
prova creato nel profilo personale. Nessun push remoto.

## Commit recenti

- `9eabd4d refactor(brand): rinomina il prodotto in Chronexus`
- `e756ea4 feat(player): persiste scheda, risorse e asset con provenienza`
- `e964e94 feat(player): integra scheda e inventario con fonti navigabili`
- `a15366e feat(player): estende scheda e persiste la cache SRD opzionale`
- Il commit della UI estesa contiene questo checkpoint e lo smoke ripetibile.

## Limiti noti

1. Un personaggio per campagna, nessun motore di formule/riposi. Catalogo SRD
   2014 in inglese, incompleto rispetto ai manuali commerciali; API read-only.
   Nuove voci richiedono rete, copie importate e voci già in cache funzionano offline.
2. Backup manuali non cifrati/firmati: 256 MiB/file, 512 MiB totali, 9998 allegati.
   Gestore allegati UI, pianificazione ed export Markdown/JSON ancora assenti.
3. Generazioni/copie preventive non rimosse automaticamente. DB non apribile:
   recuperare su cartella vuota conservando prima l'intera cartella danneggiata.
4. Chiusura forzata può perdere input non salvati. Nessun merge automatico;
   grafo limitato a 150 nodi/400 archi, chunk editor ~966 kB e canvas ~438 kB.
5. Build/QA verificati solo Windows; installer e QA nativa completa pendenti.

## Prossimo passo esatto

**M6 — Search, polish and cross-platform release**: ricerca FTS5 locale e rebuild
indice, rifinitura/accessibilità, completamento export/allegati e pipeline CI con
build Windows/macOS/Linux dove disponibili. Verifica: trovare una nota nel testo,
riavviare, fare backup/ripristino, navigare grafo/provenienza e verificare i pacchetti.

Skill applicate: PDF per estrazione e lettura visiva delle quattro pagine;
frontend-design per continuità visiva e revisione screenshot;
vercel-react-best-practices per caricamento differito e stato derivato. Nessuna
Skill specializzata database/testing disponibile; test Rust e Playwright ordinari.
Istruzioni: README; QA ripetibile: docs/QA.md; contratto adattatori: docs/RULESETS.md.
