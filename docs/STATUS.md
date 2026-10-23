# Stato Chronexus — 23 ottobre 2026

## Milestone e prossimo passo

M0–M5 e funzioni M6 consegnate su Windows, incluse estensioni grafo/tema/Party/wiki.
Continuazione M6 eseguita: package NSIS, installazione silenziosa, avvio e
rimozione senza perdita dati verificati. **Restano M6 macOS/Linux/CI reali e
revisione visuale del wizard interattivo**. Nessun push autorizzato/eseguito.
**M7 in corso su richiesta successiva dell'utente**: adapter Ollama locale,
retrieval e conversazioni SQLite, backup/export con fonti. Modello D&D provato
su GPU ma scartato per qualità; l'utente ha approvato Qwen multilingue con fonti
locali. UI e valutazione completa in verifica; non dichiarare ancora M7 conclusa.

## Funziona

- Campagne, diario/autosave, Codex UUID/backlink, relazioni con fonte/certezza,
  scheda estesa generica, inventario e incantesimi personali/SRD 2014.
- Tema pergamena/cuoio/ottone; grafo iniziale ordinato (18 nodi), alternativa
  organica, filtri/nodo centrale, evidenza vicini e dettaglio prima dell'apertura.
  Solo coordinate/stili, nessuna relazione inferita. Limite dati 150 nodi/400 archi.
- Party: crea/collega personaggi Codex, giocatore/ruolo/presenza, note autosalvate
  nella stessa pagina, immagini e navigazione. Rimozione mantiene tutti gli appunti.
- Wiki D&D Open5e v2: ricerca pubblica esplicita, testo completo, fonte/edizione/
  licenze, cache SQLite offline (100 risposte), aggiornamento con fallback visibile.
  Nessun upload degli appunti o modifica implicita degli incantesimi personali.
- FTS5 locale e rebuild, Ctrl/⌘K / Ctrl/⌘ShiftN, riepilogo, immagini originali
  gestite e backuppate, ZIP Markdown/JSON con immagini e sorgenti Logseq immutabili.
- Schema corrente **012**: impostazioni e conversazioni AI additive. Vecchi
  backup migrati in copia; nuovi richiedono versione compatibile. Percorsi e
  identificatore legacy it.nodex.desktop/.nodex conservati.

## Verifiche effettive

Checkpoint M7 backend: 59 test Rust superati, Clippy con warning negati e build
debug superati; 55 test React, lint, typecheck superati nella stessa esecuzione.
La valutazione nativa iniziale di 40 domande ha richiesto miglioramenti a
concisione/gestione istruzioni malevole; ripetizione e prove UI ancora in corso.
I risultati M6 sottostanti restano riferiti al checkpoint precedente.

- pnpm lint / typecheck / format:check: PASS.
- pnpm test: PASS, 52 test / 18 file. Dopo l'ultima correzione visuale grafo,
  rieseguiti i 5 test pertinenti, typecheck/lint/format e build: PASS.
- cargo test --offline --manifest-path src-tauri/Cargo.toml: PASS, 49 test.
- cargo fmt e clippy --all-targets -- -D warnings: PASS; build debug Windows PASS.
- pnpm build / package:desktop: PASS, release e NSIS Windows x64.
- Smoke estensione prepare/verify/restore/verify: PASS, Party/nota/PNG/wiki/API
  e backup reali, UUID e cache identici dopo i riavvii; offline simulato solo
  bloccando la rete e selettori predefiniti debug, mai SQLite/dati simulati.
- Sei viste a 1584/1200/760 px senza overflow; screenshot ispezionati. Selezione
  canvas, dettagli, esplorazione e cambio layout grafo reali PASS.
- Installer NSIS: installato in .tools dopo controllo assenza installazioni,
  eseguibile installato aperto e GET Open5e 200 da tauri.localhost PASS;
  disinstallazione silenziosa rimuove executable/registrazione e mantiene
  2 database personali con SHA-256 identico. Wizard interattivo non ispezionato.
- macOS/Linux/CI: NON ESEGUITI, matrice predisposta. Installer non firmato.
- Inferenza AI/GPU: NON ESEGUITA. Solo hardware rilevato: RTX 4080 SUPER,
  16376 MiB, driver 621.01. Modelli D&D ricercati, non scaricati né installati.

## Campagna privata e compatibilità

Speratia: 84 sessioni, 209 pagine, 18 asset, 36 immagini, 207 Markdown originali.
Backup schema 009 ripristinato nella build 011: tutti i dati/UUID/checksum identici.
Due alias ambigui conservati nel testo; trascrizione Oran parziale e foto incluse.
PF attuali non leggibili: zero tecnico segnalato, da aggiornare prima dell'uso.
Non dedurre automaticamente membership Party dal solo tipo player di Logseq.
Profili/testdata/foto restano in .tools ignorata, nessuna campagna fittizia
aggiunta al profilo personale. Backup già consegnato e ancora compatibile:
C:/Users/Joel/Downloads/Speratia_Chronexus_M6_2026-10-23.nodex (52.321.017 byte),
SHA-256 58a3e5fdc05670b46536c911eb92e5c83d7b8f86b5721c3c3adda5b893fd714c.
Ripristinare sostituisce l'intero archivio con copia preventiva, non fonde campagne.

## Commit di questa estensione

- b22a033 feat(ui): ridisegna il grafo e introduce il tema medievale
- dc29fe6 feat(party): aggiunge membri e conoscenze condivise con il Codex
- f5bb67b fix(party): sincronizza le guardie dopo il rendering
- d765db1 feat(wiki): integra Open5e con fonti e consultazione offline
- 409c3ab docs(roadmap): pianifica assistente D&D locale con GPU in M7
- 6735251 fix(graph): mantiene leggibili i nomi nelle campagne dense
- Checkpoint documentazione: vedere git log.

## Avvio, Skill e limiti

`pnpm desktop` con Rust; `pnpm package:desktop` per il pacchetto.
Installer: src-tauri/target/release/bundle/nsis/Chronexus_0.1.0_x64-setup.exe.
Skill applicate: find-skills per ricerca CLI/catalogo; frontend-design e ui-taste
per direzione e verifica visuale; vercel-react-best-practices per caricamento
su richiesta; imagegen solo per riferimento fittizio. webapp-testing consultata,
non installata/applicata come workflow Python. Dettagli in docs/RESEARCH_DND.md.
Limiti: wiki principalmente inglese e fonti commerciali non tutte disponibili;
cache wiki espellibile; un solo PG giocabile (Party usa pagine Codex);
bundle editor grande, backup manuali, import Logseq solo strumento debug.
