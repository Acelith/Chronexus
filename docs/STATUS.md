# Stato Chronexus — 23 ottobre 2026

## Milestone

**M0–M5 completate. Estensione scheda/catalogo richiesta in corso. M6 non iniziata.**

Revisione corrente: persistenza aggiuntiva della scheda ispirata al PDF e cache
SRD opzionale, migrazione 006 additiva. Interfaccia e verifica desktop ancora da
completare; i risultati sotto riguardano la precedente consegna M5.

Ultimo scenario reale: Neme riceve la chiave da Varek nella Sessione 12; dal
proprio inventario apre il PNG e il blocco fonte, poi torna all'oggetto selezionato.
PF, risorse/slot, quantità, equipaggiamento, capacità e marcatori restano identici
dopo riavvio. Backup M5 con PNG ripristinato su profilo vuoto e riavviato: scheda,
asset, documenti, UUID, grafo, fonti e hash immagine coincidono con la sorgente.

## Funziona

- Nome pubblico, finestra, pacchetti ed eseguibile: Chronexus/chronexus.
  Identificatore `it.nodex.desktop`, database `.sqlite3`, `.nodex` e variabili
  debug legacy conservati. Il profilo M4 è stato riaperto senza spostare dati.
- Campagne, diario/autosave, Codex, `[[`, backlink e grafo M0–M3 conservati.
- Personaggio generico per campagna: identità, sistema libero, livello/esperienza,
  PF, condizioni/note e statistiche configurabili. Risorse/slot con UUID stabili
  e contatori +/− salvati immediatamente, senza formule o consumi automatici.
- Inventario: CRUD con revisioni, quantità anche zero, equipaggiamento, categoria,
  peso/valore liberi, consumabili e note; provenienza sessione/blocco/PNG/luogo/
  missione e pagina Codex. Eliminazione confermata, fonti conservate.
- Incantesimi/capacità manuali, conosciuta/preparata indipendenti, metadati e
  filtri nome/rango/stato/tipo. Contratto adattatori locale, solo modalità manuale.
- Moduli con salvataggio esplicito, errori che conservano input, guardie contro
  navigazione/chiusura, stati vuoti/lettura fallita e Tab/Escape nelle conferme.
  Navigazione alle fonti con ritorno alla voce selezionata.
- Backup/ripristino M4 esteso a tutti i dati M5 e conteggi player. Migrazione 005
  additiva, FK composite, transazioni e controlli Rust. Backup schemi 1–5 leggibili;
  DB 005 richiede M5 o successivo. Vecchi manifest conteggi interpretati con zero.

## Verifiche effettive

| Comando / prova | Esito |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | PASS |
| `pnpm test` | PASS, 30 test in 6 file |
| `pnpm peers check` | PASS, nessun conflitto |
| `cargo test --offline --manifest-path src-tauri/Cargo.toml` | PASS, 38 test (9 player) |
| `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo build --offline --manifest-path src-tauri/Cargo.toml` | PASS, debug Windows x64 |
| `pnpm build:desktop` (include `pnpm build`) | PASS, release Windows x64 senza installer |
| `scripts/player-smoke.mjs prepare/verify/restore/verify-restored` | PASS, desktop/SQLite/ZIP reali |
| Riapertura profilo M4 con eseguibile rinominato | PASS, documenti/grafo/fonti/hash PNG identici |
| Tre viste player a 760 px e screenshot a 1200 px | PASS, nessun overflow orizzontale |
| Release: avvio, titolo Chronexus, lettura archivio e schermata backup | PASS, asset incorporati; CSP offline e variabili debug escluse |
| macOS/Linux, installer, rete/disco esterno e QA assistiva estesa | NON ESEGUITI |

La prova desktop usa solo la scelta file predefinita nel debug con profilo
esplicito: persistenza, comandi, ZIP e validazioni sono reali. La procedura nativa
completa dei selettori rimane da verificare (limite QA M4). Dati sintetici in
`.tools/m5-source-final` e `.tools/m5-restored`, ignorati da Git. Nessun dato di
prova creato nel profilo personale. Nessun push remoto.

## Commit recenti

- `9eabd4d refactor(brand): rinomina il prodotto in Chronexus`
- `e756ea4 feat(player): persiste scheda, risorse e asset con provenienza`
- Il commit UI M5 contiene questo checkpoint, le viste e lo smoke ripetibile.
- Base M4: `8277c78 feat(backup): integra backup e ripristino guidato`.

## Limiti noti

1. Un personaggio per campagna; nessun motore di regolamento, riposo o catalogo
   commerciale. Moduli player espliciti, nessun autosave implicito delle schede.
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

Skill applicate: frontend-design per continuità visiva e revisione screenshot;
vercel-react-best-practices per caricamento differito e stato derivato. Nessuna
Skill specializzata database/testing disponibile; test Rust e Playwright ordinari.
Istruzioni: README; QA ripetibile: docs/QA.md; contratto adattatori: docs/RULESETS.md.
