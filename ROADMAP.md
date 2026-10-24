# ROADMAP.md - Chronexus incremental execution plan

## Working method
- Execute one milestone or bounded related slice at a time. Avoid an everything-at-once generation attempt.
- For each milestone: inspect repo and relevant docs -> implement -> validate -> fix -> commit with detailed body -> update `docs/STATUS.md` -> summarize.
- If a milestone is large, split it into independently testable and separately committed subphases.
- Keep no-op UI mocks out of completed feature claims.
- Record real decisions in `docs/DECISIONS.md` when they materially constrain later work.
- First Codex invocation: implement **M0 and M1 only**, if the environment permits. Stop after reporting those results; do not begin M2 automatically. If resource or environment limits block M1, finish M0 responsibly and document next steps.

## M0 - Foundation and real local database
Goal: a bootable Tauri 2 / React / TypeScript desktop app backed by a real Rust + SQLite persistence layer.

Deliverables:
- Initialize or safely adapt repo, package manager (prefer pnpm), Vite + React + TypeScript strict, Tauri 2 Rust project.
- Cohesive app shell in Italian: sidebar, navigation, dark theme, empty states, no fake product data presented as real.
- SQLite initialization in OS app-data directory and first reversible/traceable versioned migration.
- Typed bridge to Rust commands; clear error handling, no raw SQL in React.
- Basic read/write smoke operation proving data survives app relaunch (test or repeatable manual smoke procedure).
- Scripts for dev, lint, typecheck, test, Rust test and build; gitignore, README setup for Windows/macOS/Linux, `docs/STATUS.md`.
- Initial focused tests and a meaningful Git commit with exhaustive message body.

Acceptance:
- Dev app boots (if build environment supports Tauri).
- Typecheck and available local tests pass; startup with empty DB is handled.
- DB schema is migrated once and remains valid on second startup.
- No remote API required at runtime.

## M1 - Campaign/session first useful vertical slice
Goal: create campaigns and journal sessions with **real, local persistence**.

Deliverables:
- Create, select, rename campaign (archive optional until later).
- Session list and new session form: sequence number, title, optional date.
- Editor supports at least plain note blocks and basic formatting via chosen block-editor integration; SQLite stores canonical editor document.
- Autosave with saved/saving/error indicators; journal reopens accurately after app restart.
- Delete/archive needs confirmation and no accidental cross-campaign data access.
- Tests for DB round trip, campaign boundaries, autosave logic and basic screen behaviors.
- Commit important units separately (e.g. persistence, session editor) with detailed bodies.

Acceptance:
- Create campaign -> create session -> write 2 paragraphs -> restart app -> see identical saved notes and session order.
- Invalid input and data-write failures generate an intelligible UI error, not silently erased notes.

## M2 - Codex pages, `[[links]]` and backlinks
Goal: the first useful Logseq-style knowledge workflow.

Deliverables:
- Typed knowledge pages, optional aliases and stable IDs.
- `[[` mention autocomplete, select existing or create new/stub page, link display and navigation.
- Persist mention index derived from canonical editor content.
- Backlinks with source session and block preview.
- Rename page -> backlinks/links still resolve; ambiguous aliases are resolved explicitly.
- Tests for link extraction, creation, missing/renamed page, ambiguous name, campaign separation.

Acceptance:
- Type `[[Varek]]` from Session 12, navigate to Varek, see Session 12 backlink, rename Varek, link remains valid after restart.

## M3 - Meaningful graph
Goal: navigable graph with evidence-aware typed relationships, not a decorative network.

Deliverables:
- Cytoscape graph sourced from the database with separate mention and asserted-relationship edges.
- Manual add/edit/remove asserted relationship, direction, label, certainty and optional session/block evidence.
- Node click -> page; edge click -> relationship/source evidence.
- Filters by entity type, certainty and depth (1-2 hops), graph legend, loading/empty states.
- Tests for graph data query and no accidental conversion of co-occurrences into factual assertions.

Acceptance:
- Varek and Guild can both occur in a note without an inferred alliance; an explicit suspected accusation appears as a labeled, differently styled graph edge.

## M4 - Portable backup and recovery (protect the data early)
Goal: preserve a campaign before adding more character complexity.

Deliverables:
- SQLite-consistent snapshot + attachments archive, manifest, checksums, ZIP-based `.nodex`.
- User-triggered backup; safe backup destination chooser; visible errors and overwrite rules.
- Restore validation, path traversal protection, DB integrity checks and pre-restore safety copy.
- Basic Markdown/JSON export if it can be done without blocking recovery work.
- Automated backup->restore round-trip test with pages, sessions and references.

Acceptance:
- Export `.nodex`; simulate a fresh test profile; restore; compare sessions, links, relationships and attachment counts.

## M5 - Player character, inventory and spells
Goal: integrate playable data with knowledge, without inventing rules.

Deliverables:
- System-agnostic PC model and editable stats/HP/resources with persistence.
- Inventory CRUD, quantity and equipment state, acquisition provenance linking session/NPC/place/quest.
- Spellbook/manual ability entries, known/prepared flags and configurable resource/slot counters.
- Links from inventory and spells into knowledge pages; context navigation back to the campaign journal.
- Ruleset adapter interface and documentation, but NO unverified automatic D&D/Pathfinder formulas.
- Tests for changing counters, persistence, data validation, provenance links.

Acceptance:
- Add key received from Varek in Session 12 -> item page can open source note and NPC; restart and data still present.

### User-requested extension to M5, before M6

- Expand the manual sheet using the four-page PDF reference: combat, abilities/
  skills/saves and training, biography/proficiencies, wealth/equipment and magic.
- Add optional SRD 2014 catalog search/preview, local response cache and explicit
  editable spell import; retain homebrew creation and lookup from a custom entry.
- No automatic formulas or publication of personal content to the read-only API.
- Acceptance: fill extended sheet, import/customize a real API spell, create a
  homebrew spell, restart offline and restore backup to a fresh profile. Compare
  new fields, source identity, UUIDs and cache; errors must preserve open drafts.
- Schema 006 and previous backups must remain supported by the current build.

## M6 - Search, polish and cross-platform release
Goal: reliable daily-use experience across all target OSes.

Deliverables:
- FTS5 search and tested index rebuild across notes, page titles and supported character assets.
- Keyboard shortcuts, refined dashboard, visual usability/accessibility, performance tuning.
- Markdown/JSON export completion and attachment handling.
- User-requested images for PC/NPCs, maps and items: managed local copies,
  previews/zoom, ownership, safe decoding and tested image-inclusive backup.
- After implementation, prepare a separate test campaign from the supplied
  Logseq archive and Oran photos; keep originals/private fixtures out of Git,
  preserve uncertainty, verify restore and save its `.nodex` backup in Downloads.
- CI pipeline to run tests; actual Windows/macOS/Linux build matrix if runners available.
- Package installers (.exe/.msi, .dmg/.app, .deb/.AppImage as supported by tools), verify names and packaging constraints.
- README with real local install/backup/restore instructions, limitations and manual QA checklist.

Acceptance:
- Search source note, restart, run backup/restore, navigate graph, validate on supported OS build environments without presenting untested builds as verified.

## M7 - Assistente D&D locale con GPU

Richiesta esplicita: domande e analisi della propria campagna con inferenza
locale Ollama/adapter equivalente, modello specifico D&D quando disponibile,
GPU reale verificata e nessun cloud. Specifica, candidati e accettazione in
[docs/AI_LOCAL.md](docs/AI_LOCAL.md).

- M7.1: valutare modello D&D/licenze e compatibilità GPU/VRAM con benchmark reale.
- M7.2: retrieval locale per campagna e regole separate per edizione, risposte
  italiane con citazioni riapribili, incertezza e rifiuto di fatti inventati.
- M7.3: streaming/cancellazione/errori, configurazione esplicita, privacy,
  conversazioni eventualmente persistenti e backup senza pesi dei modelli.
- Accettazione: inferenza reale sulla GPU e offline, domande con fonti e senza
  risposta, isolamento campagne/edizioni, fonti rinominate e documenti malevoli.
- Nessun fatto, relazione, contatore o appunto modificato senza revisione utente.
- Implementazione M7 successivamente autorizzata: adapter Rust Ollama, schema
  012, retrieval, UI e cronologia/backup/export presenti. Il candidato D&D
  specifico è stato provato su GPU ma scartato per qualità; l'utente ha approvato
  Qwen3:4b-instruct multilingue con fonti locali, non fine-tuned D&D.
- Guard aggiuntiva prima dell'inferenza: estratti con segnali espliciti di
  manipolazione esclusi e segnalati; se mancano fonti pulite la richiesta viene
  fermata. Nessuna modifica degli appunti e nessuna garanzia semantica assoluta.
- Evidenza corrente, conteggi e limiti: docs/STATUS.md e docs/AI_LOCAL.md.
  Rimane la prova di accettazione con rete fisicamente disconnessa/firewall;
  proxy non raggiungibili e osservazione loopback sono verifiche distinte.

## M8 - Gemma 4 12B e riaddestramento locale per campagna

**Stato: pianificata, non avviata.** Questa richiesta aggiorna soltanto la
roadmap; non sostituisce il modello installato e non avvia addestramenti.

### M8.1 - Qualifica e sostituzione del modello

- Target richiesto: **Gemma 4 12B**, in sostituzione di Qwen3:4b-instruct.
  Prima dell'implementazione verificare su fonti ufficiali esistenza, nome
  esatto, licenza, pesi disponibili e supporto dei runtime locali. Non sono
  ancora attestati disponibilità, requisiti hardware o specializzazione D&D.
- Misurare inferenza e addestramento sulla GPU disponibile, con consumo VRAM,
  quantizzazione e qualità delle risposte italiane confrontati con M7. Non
  presumere che un modello eseguibile in inferenza sia anche addestrabile sulla
  stessa GPU. Se il target non è disponibile o compatibile, documentare il
  blocco e richiedere una scelta all'utente senza sostituzioni implicite.
- Mantenere il modello precedente utilizzabile fino alla validazione e
  all'attivazione esplicita del nuovo; prevedere ripristino della configurazione.
  Preservare retrieval locale, citazioni, separazione delle edizioni e delle
  campagne, senza chiamate cloud o modifiche automatiche ai fatti.

### M8.2 - Impostazioni della campagna

- Aggiungere un accesso riconoscibile alle **Impostazioni della campagna** dalla
  campagna selezionata, creando il menu se assente. La configurazione richiesta
  deve essere raggiungibile qui, anche se esistono impostazioni AI globali.
- Sezione **AI locale**: abilitazione per campagna, modello e adapter attivi,
  versione, stato del runtime/GPU, limiti di contesto e memoria compatibili con
  l'hardware. Distinguere preferenze della campagna da configurazioni del runtime
  condiviso; nessun cambiamento implicito alle altre campagne.
- Impostazioni utili correlate: edizione D&D, fonti di regole approvate,
  inclusione/esclusione di appunti e altri contenuti locali supportati,
  data dell'ultimo aggiornamento delle conoscenze e dell'ultimo addestramento,
  riepilogo dei dati nuovi, modificati o eliminati.

### M8.3 - Nuovi dati e vero riaddestramento

- Inserire il pulsante **Riaddestra sui nuovi dati** in **Impostazioni della
  campagna → AI locale**. Prima dell'avvio mostrare fonti incluse, differenze
  dall'ultimo addestramento riuscito, dimensioni e requisiti misurabili. L'avvio
  deve essere esplicito; nessun addestramento automatico in background.
- Implementare un vero aggiornamento dei pesi o di un adapter dedicato alla
  campagna, con backend locale compatibile, ad esempio LoRA/QLoRA se supportati
  dal modello e dalla GPU. Verificare separatamente il backend di addestramento:
  non presumere che l'API di inferenza Ollama offra questa funzione.
- Mantenere distinto **Aggiorna conoscenze**, che aggiorna il retrieval per i
  normali cambiamenti agli appunti: ricostruire un indice non è riaddestrare il
  modello e non soddisfa da solo questa milestone.
- Conservare pesi base immutabili e adapter versionati per campagna. Per fonti
  corrette, escluse o eliminate, ricostruire quando necessario l'adapter da uno
  snapshot approvato: un aggiornamento incrementale non garantisce di rimuovere
  informazioni già apprese. Il retrieval corrente resta il riferimento per le
  risposte con citazioni, anche dopo l'addestramento.
- Trattare i documenti come dati, preservando provenienza e distinzione tra
  fatti e affermazioni dei personaggi; escludere di default risposte generate
  dall'AI. Non includere campagne diverse né introdurre OCR non previsto.
- Mostrare stati reali di preparazione, addestramento, validazione, successo,
  errore e annullamento. Gestire memoria insufficiente, runtime assente e
  interruzioni senza perdere dati; mantenere l'adapter attivo fino a una nuova
  validazione riuscita e consentire il ritorno alla versione precedente.
- Registrare modello/versione, identificativi e revisioni delle fonti,
  configurazione, esito e impronte di dataset e adapter. Definire backup e
  ripristino degli adapter e dei metadati con dimensioni dichiarate e limiti
  compatibili con gli archivi; i pesi base restano esclusi dal backup ordinario.
  Eventuali migrazioni saranno versionate e non distruttive.

### Accettazione M8

- Gemma richiesto verificato ed eseguito realmente sulla GPU, con confronto
  documentato con M7; addestramento reale dimostrato da artefatti e verifiche
  dei pesi/adapter, senza scambiare un aggiornamento dell'indice per training.
- Su dati sintetici, aggiungere informazioni alla campagna, aggiornare le
  conoscenze e avviare il riaddestramento dal suo menu; verificare risposte
  italiane con citazioni riapribili e assenza di contaminazione tra campagne.
- Verificare correzioni/eliminazioni delle fonti, incertezza, edizioni diverse,
  documenti malevoli, annullamento, errori GPU, riavvio, rollback e backup/restore.
- Provare il funzionamento senza rete esterna; dichiarare separatamente le
  piattaforme effettivamente testate e i vincoli hardware rimasti aperti.
- Le verifiche residue M6/M7 restano tracciate separatamente: questa milestone
  non le dichiara completate.

## M9 - Tiradadi interno e cerchio dei draghi

**Stato: pianificata, non avviata.** Questa richiesta aggiunge soltanto la
milestone; il tiradadi e le sue animazioni non sono ancora implementati.

### M9.1 - Composizione e risultato del tiro

- Tiradadi utilizzabile interamente offline, con d4, d6, d8, d10, d12, d20
  e d100. Il d100 produce valori da 1 a 100, senza ambiguità sullo zero.
- Selezionare separatamente la quantità di ogni tipo di dado nello stesso
  tiro: per esempio 3d6 oppure 2d20 + 3d6 + 1d100. Mostrare la composizione
  prima della conferma, con controlli accessibili anche da tastiera.
- Validare quantità intere non negative, richiedere almeno un dado e definire
  un limite ragionevole documentato per evitare blocchi con tiri molto grandi.
- Ogni tiro confermato riparte con tutte le quantità azzerate per il successivo:
  non mantenere selezioni implicite e non ripetere automaticamente il tiro.
  In caso di errore prima della registrazione, conservare la selezione per
  consentire un nuovo tentativo senza perdere la composizione.
- Generare risultati casuali uniformi nel backend locale e registrarli una sola
  volta; l'animazione rappresenta quei risultati senza modificarli. Mostrare
  il valore di ciascun dado, i subtotali per tipo e il totale complessivo.

### M9.2 - Storico persistente

- Conservare lo storico per campagna in SQLite, con ID stabile, data e ora,
  composizione, risultati individuali, subtotali e totale. Deve rimanere
  consultabile dopo chiusura e riavvio, senza dipendere dal modello AI.
- Mostrare gli ultimi tiri con dettaglio espandibile e uno stato vuoto chiaro.
  Includere lo storico nel backup/ripristino della campagna tramite una
  migrazione versionata non distruttiva, preservando i backup precedenti.
- Registrare il tiro prima dell'animazione; se questa viene interrotta, il
  risultato resta recuperabile. Segnalare gli errori di salvataggio senza
  presentare come conservato un tiro che non lo è.

### M9.3 - Animazione medievale: cerchio dei draghi

- Progettare un set coerente di dadi medievali di forte impatto visivo: forme
  riconoscibili per tipo, materiali come pietra, metallo e incisioni draconiche,
  dettagli controllati e numeri grandi e contrastati. Ornamenti, riflessi e
  fiamme non devono coprire i valori; distinguere chiaramente 6 e 9 e rendere
  espliciti tipo di dado e valore del d100, senza affidarsi al solo colore.
- Prevedere la generazione di illustrazioni originali per draghi, cornice,
  texture dei dadi ed effetti con la skill imagegen quando servono asset raster;
  usare geometrie e numeri renderizzati dall'app per facce e risultati esatti,
  senza dipendere da cifre disegnate dal generatore. Preparare asset separati,
  con trasparenza dove necessaria, dimensioni e peso contenuti, inclusi nel
  pacchetto locale. La generazione avviene durante lo sviluppo, mai a runtime:
  nessun invio di dati di campagna, download o servizio esterno richiesto al tiro.
- Usare impeccable per direzione visiva e ritmo, accessibility per tastiera,
  contrasto e movimento ridotto, e react-testing per gli stati interattivi.
  Il risultato finale deve essere disponibile anche come testo stabile separato
  dalla scena, leggibile con screen reader e indipendente dagli effetti grafici.
- Far rotolare i dadi dentro un cerchio delimitato da draghi, coerente con il
  tema medievale dell'app. All'atterraggio i draghi sprigionano fiamme che
  avvolgono e consumano visivamente i dadi, rivelandone i risultati.
- Presentare i numeri con un rapido scorrimento da slot machine, quindi
  fermarli sui valori effettivi e completare il conteggio del totale. Mantenere
  i risultati finali leggibili finché l'utente avvia un altro tiro.
- Ritmo vivace ma leggibile: obiettivo iniziale di circa 2–3 secondi per tutta
  la sequenza, da verificare nell'app. Per molti dadi raggruppare animazioni e
  conteggi, senza allungare la durata in proporzione al numero di dadi.
- Impedire invii duplicati durante il tiro; distinguere selezione azzerata,
  animazione in corso e risultato precedente. Consentire di saltare l'animazione
  senza generare nuovi valori e rispettare la preferenza di movimento ridotto
  con una rivelazione breve, senza rotolamento o lampeggiamenti intensi.

### Accettazione M9

- Verificare tiri singoli e multipli di ogni tipo, incluso d100, e composizioni
  miste con quantità differenti; controllare intervalli, subtotali e totale.
- Testare azzeramento dopo ogni tiro confermato, quantità non valide, tiro
  vuoto, limiti, doppi invii ed errori di persistenza senza duplicazioni.
- Verificare storico dopo riavvio, isolamento tra campagne e backup/restore,
  inclusa compatibilità con archivi precedenti privi di storico.
- Verificare corrispondenza tra risultati salvati e animati, interruzione o
  salto della sequenza, movimento ridotto e uso da tastiera. Valutare realmente
  ritmo, leggibilità e fluidità con pochi e molti dadi sulle piattaforme provate.
- Usare test deterministici con generatore sostituibile per la logica dei tiri;
  documentare la sorgente casuale usata in produzione. Non dichiarare equità
  statistica dimostrata soltanto da pochi tiri manuali.
- Verificare visivamente tutti i tipi di dado alle dimensioni effettive dell'app,
  con pochi e molti dadi: numeri, 6/9 e d100 devono restare distinguibili senza
  zoom, anche durante la rivelazione e su materiali decorati. Controllare il
  contrasto dei valori finali e la resa con movimento ridotto; draghi e fiamme
  non devono ostacolare lettura, controlli o dettaglio testuale del tiro.
- Verificare che gli asset generati siano presenti nel pacchetto e che l'intera
  scena funzioni offline, senza richieste di rete o generazione durante il tiro.

## Future (not MVP)
Automatic ruleset adapters (D&D 5e 2014/2024, Pathfinder), optional portable sync with conflict handling, advanced timeline, maps, PDF character exports, OCR, AI-assisted suggestions requiring user consent, multi-PC campaigns, extensions. Manual D&D 2014 labels and optional SRD catalog belong to the requested M5 extension above.

## Status/checkpoint minimal template
Codex maintains `docs/STATUS.md` with:
- Current milestone: done/in progress/blocked.
- Last completed user-visible scenario.
- Relevant checks: exact command, PASS/FAIL/NOT RUN + reason.
- Last meaningful Git commits (hash and subject).
- Up to 5 known issues/blockers.
- Next single actionable milestone + a concrete verification target.
Do not turn status into a transcript or paste build logs into it.

## Checkpoint M6 — 23 October 2026

Windows features and private Logseq campaign/backup acceptance delivered.
Schema 009, 47 frontend tests and 47 Rust tests verified; NSIS package built.
Remaining M6 release validation: interactive installation/uninstallation and
actual macOS/Linux CI/package checks. M7 is now explicitly planned in docs/AI_LOCAL.md; implementation starts only
after the requested M6 continuation and a subsequent user instruction. See docs/STATUS.md for evidence.


## Checkpoint precedente — M6 extension and M7 plan

M6 Windows extension delivered: medieval reading theme, readable/organic graph,
Party linked to Codex, Open5e wiki/cache, additive schemas 010/011. Native
restart/restore and older Speratia backup verified. Windows NSIS silent install,
installed launch/API access and uninstall preserving data passed. Remaining M6:
actual macOS/Linux CI/package validation and interactive wizard visual review;
no remote push authorized. M7 local GPU D&D assistant is planned, not implemented.
Questo è il checkpoint precedente all'autorizzazione M7. Stato aggiornato,
verifiche e limiti: docs/STATUS.md. La prossima attività della roadmap dopo
questa implementazione resta completare M6 sui runner macOS/Linux e il wizard
interattivo Windows. M8 è ora definita sopra come attività futura per Gemma
e riaddestramento locale per campagna; la sua implementazione non è avviata.
