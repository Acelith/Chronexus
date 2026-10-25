# ROADMAP.md — Chronexus: milestone e ordine reale di consegna

Aggiornata il 25 ottobre 2026. La numerazione storica M0–M15 resta stabile per
non rendere ambigui commit, guide e release. I suffissi **a/b/c/d** identificano
estensioni inserite tra fasi esistenti: quelle già consegnate sono retrospettive;
M15a resta pianificata, mentre M16 è stata eseguita prima su richiesta esplicita
(la sua sezione resta dopo M15a per non spostare i riferimenti).
Le sezioni e la tabella seguono l’ordine delle implementazioni Git, non l’ordine
numerico degli ID: **M12 e M13 precedono M11**, eseguita alla fine su richiesta.
Le date indicano consegne/inizio dei lavori, non una certificazione multipiattaforma.
Le fasi parziali restano nel punto della prima implementazione; i completamenti
successivi sono indicati nello stato, senza fingere che siano avvenuti prima.

## Metodo e stato

- Eseguire soltanto le milestone o le parti autorizzate dall’utente. Il 25 ottobre
  l’utente ha chiesto esplicitamente di eseguire M16: è stata implementata prima
  di M15a, che resta pianificata senza cambiare il proprio ID.
- Suddividere il lavoro in parti verificabili: implementazione, test reali,
  correzioni, commit dettagliati e checkpoint in docs/STATUS.md.
- «Operativa Windows» non significa accettazione completa su macOS/Linux,
  revisione linguistica o installazione personale. Mantenere i residui visibili.
- Milestone originarie ed estensioni retrospettive condividono lo stesso codice:
  non sono funzionalità da implementare una seconda volta.
- La consegna M16 non ha ancora creato versioni, pacchetti o release.

## Registro cronologico

| Ordine | Milestone | Consegna | Data | Evidenza Git | Stato |
| --- | --- | --- | --- | --- | --- |
| 1 | M0 | Fondazione desktop e SQLite | 23/10/2026 | `6b7c073` | Windows |
| 2 | M1 | Campagne, sessioni, editor/autosave | 23/10/2026 | `34f480b → 414415b` | Windows |
| 3 | M2 | Codex, menzioni e backlink | 23/10/2026 | `e9c1fc0 → 5a8034d` | Windows |
| 4 | M3 | Relazioni e grafo navigabile | 23/10/2026 | `4e27374 → eecab02` | Windows |
| 5 | M4 | Backup e ripristino | 23/10/2026 | `02f77cd → 8277c78` | Windows |
| 6 | M4a | Rinomina Chronexus | 23/10/2026 | `9eabd4d` | Consegnata |
| 7 | M5 | Scheda, inventario e incantesimi | 23/10/2026 | `e756ea4 → e964e94` | Windows |
| 8 | M5a | Scheda di riferimento e catalogo SRD | 23/10/2026 | `a15366e → 55dea13` | Windows |
| 9 | M6 | Ricerca, immagini/backup, export, riepilogo, Logseq e prima distribuzione | 23/10/2026 | `70e7880 → f984a3c` | Windows; altri OS aperti |
| 10 | M6a | Primo tema medievale/restyling grafo | 23/10/2026 | `b22a033` | Windows |
| 11 | M6b | Party e conoscenze sui membri | 23/10/2026 | `dc29fe6 → f5bb67b` | Windows |
| 12 | M6c | Wiki Open5e multi-fonte | 23/10/2026 | `d765db1` | Windows |
| 13 | M6d | Leggibilità dei grafi densi | 23/10/2026 | `6735251` | Correzione consegnata |
| 14 | M7 | Assistente locale con GPU | 23/10/2026 | `e6f1763 → 4ac9f7f` | Windows; offline fisico aperto |
| 15 | M7a | Installer locali app + AI | 23/10/2026 | `24946bc` | Pacchetti locali |
| 16 | M8 | Impostazioni campagna, Gemma e QLoRA | 24/10/2026 | `a99355e → 9baee29` | Windows |
| 17 | M8a | Riparazione dopo spostamento C → D | 24/10/2026 | `313e056` | Consegnata |
| 18 | M8b | GUI di riferimento, menu impostazioni, scroll e grafo | 24/10/2026 | `d5b07a1 → f8d6b68` | Windows |
| 19 | M8c | Editor visuale e sorgente Markdown | 24/10/2026 | `64d65c6` | Windows |
| 20 | M9 | Tiradadi e storico | 24/10/2026 | `3b0e2ac → 6ef5222` | Windows |
| 21 | M10 | Lingue e scritture alternative | 24/10/2026 | `79376ee → 3eaf56a` | Windows; revisione aperta |
| 22 | M12 | Draghi animati sugli estremi | 24/10/2026 | `45c0268` | Windows |
| 23 | M13 | Espruar e Dethek | 24/10/2026 | `26d1c83` | Windows |
| 24 | M11 | Distribuzione Forgegit app/AI | 24/10/2026; app completata 25/10 | `43467fb → 4abb4e3; M15` | Parziale: AI grandi aperti |
| 25 | M14 | Assistenti esterni MCP nascosti | 25/10/2026 | `fa38d2e` | Windows |
| 26 | M15 | Updater, backup pre-installazione e release 0.4.0 | 25/10/2026 | `c7d95ca → ad7760d` | Windows; canale pubblico |
| 27 | M16 | Scraping Wikidot, scelta fonte e cache eliminabile | 25/10/2026 | `2fbf17a → 923516f` | Windows; altri OS aperti |
| 28 | M15a | Annuncio epico degli aggiornamenti: vassallo, trombetta e manifesto | Pianificata | — | Prossima milestone |


## M0 - Foundation and real local database

**Stato aggiornato:** Operativa su Windows. Fondazione e archivio reale; le piattaforme non provate non sono dichiarate accettate.

**Evidenze Git:** `6b7c073`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).
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

**Stato aggiornato:** Operativa su Windows: campagne/sessioni, editor e autosave persistenti.

**Evidenze Git:** `34f480b`, `414415b`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).
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

**Stato aggiornato:** Operativa su Windows: pagine, UUID, menzioni e backlink persistenti.

**Evidenze Git:** `e9c1fc0`, `5a8034d`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).
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

**Stato aggiornato:** Operativa su Windows: relazioni esplicite distinte dalle menzioni e navigazione delle fonti. I restyling successivi sono M6a/M6d/M8b.

**Evidenze Git:** `4e27374`, `eecab02`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).
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

**Stato aggiornato:** Operativa su Windows: backup portabile, validazione e ripristino protetto. Le immagini gestite sono state aggiunte in M6, i backup pre-update in M15.

**Evidenze Git:** `02f77cd`, `c95a861`, `8419bda`, `8277c78`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).
Goal: preserve a campaign before adding more character complexity.

Deliverables:
- SQLite-consistent snapshot + attachments archive, manifest, checksums, ZIP-based `.nodex`.
- User-triggered backup; safe backup destination chooser; visible errors and overwrite rules.
- Restore validation, path traversal protection, DB integrity checks and pre-restore safety copy.
- Basic Markdown/JSON export if it can be done without blocking recovery work.
- Automated backup->restore round-trip test with pages, sessions and references.

Acceptance:
- Export `.nodex`; simulate a fresh test profile; restore; compare sessions, links, relationships and attachment counts.

## M4a — Rinomina Nodex → Chronexus (retrospettiva)

**Stato:** consegnata prima dell’implementazione della scheda M5, su richiesta
contestuale a M5. **Evidenza Git:** `9eabd4d`.

Nome del prodotto, titoli e documentazione aggiornati a Chronexus. Identificatore
legacy `it.nodex.desktop`, percorsi dati e compatibilità `.nodex` conservati;
nessuna migrazione distruttiva o nuova campagna creata per il cambio di nome.

## M5 - Player character, inventory and spells

**Stato aggiornato:** Operativa su Windows: scheda manuale, risorse, inventario e incantesimi con provenienza. Estensione della scheda registrata separatamente in M5a.

**Evidenze Git:** `e756ea4`, `e964e94`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).
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

## M5a — Scheda di riferimento e catalogo D&D (retrospettiva)

**Stato:** operativa su Windows, consegnata prima di M6. La richiesta chiamava
«M4» la scheda; il backup M4 resta distinto e questa estensione riguarda M5.
**Evidenze Git:** `a15366e`, `55dea13`.

Perimetro: campi della scheda manuale a quattro pagine fornita come riferimento,
ricerca D&D/SRD 2014, importazione modificabile degli incantesimi e creazione di
incantesimi personalizzati usando una voce API come base. L’API resta in sola
lettura e non pubblica gli incantesimi personali. Conservare fonti e campi manuali.


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

**Stato aggiornato:** Consegna funzionale Windows verificata; accettazione multipiattaforma ancora parziale. Ricerca, immagini nei backup, export, riepilogo e preparazione della campagna Logseq sono inclusi.

**Evidenze Git:** `70e7880`, `0bf403b`, `858085a`, `ca0e79e`, `738eb62`, `f984a3c`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).
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

## M6a — Restyling medievale e prima revisione del grafo (retrospettiva)

**Stato:** operativa su Windows, dopo la prima consegna M6 e prima del Party.
**Evidenza Git:** `b22a033`.

- Tema medievale grafico: pergamena, cuoio, tipografia e ornamenti; navigazione
  ordinaria, leggibile e accessibile, senza trasformarla in una scena di gioco.
- Grafo ridisegnato con disposizione organica, dettagli e collegamenti navigabili;
  menzioni e relazioni fattuali restano distinte, senza dedurre legami nuovi.
- Le correzioni alle etichette delle campagne dense arrivano in M6d; il secondo
  passaggio sulla GUI di riferimento e sulle prestazioni è M8b.

## M6b — Party e conoscenze sui membri (retrospettiva)

**Stato:** operativa su Windows. **Evidenze Git:** `dc29fe6`, `f5bb67b`.

Sezione Party dedicata per membri, giocatori, ruolo e presenza; informazioni note
nel documento Codex canonico collegato tramite UUID, con immagini, backlink e
ricerca. Revisioni e guardie proteggono le bozze; rimuovere un membro dal Party
non elimina la pagina. Backup/export includono i dati (schema 010). Un solo PG
ha la scheda giocabile completa: non dichiarare schede complete per tutti i membri.

## M6c — Wiki multi-fonte Open5e (retrospettiva)

**Stato:** operativa su Windows, dopo Party e prima dell’assistente M7.
**Evidenza Git:** `d765db1`.

Wiki D&D tramite Open5e v2, ricerca esplicita, fonti/edizioni/licenze e cache
SQLite offline (schema 011). Catalogo SRD 2014 della scheda mantenuto separato.
Nessun invio di campagne, import automatico di fatti o copia silenziosa sugli
incantesimi personali. Lo scraping Wikidot non è stato implementato qui: è M16.

## M6d — Nomi leggibili nei grafi densi (retrospettiva)

**Stato:** correzione Windows consegnata dopo Open5e, prima di M7.
**Evidenza Git:** `6735251`.

Correggere sovrapposizioni e leggibilità dei nomi nelle campagne dense, mantenendo
selezione/dettagli e identità dei nodi. Non introdurre nuove relazioni o cambiare
le fonti per rendere più ordinata la visualizzazione.

## M7 - Assistente D&D locale con GPU

**Stato aggiornato:** Operativa su Windows con GPU e fonti locali; candidato D&D specifico scartato dopo le prove e sostituito, su scelta esplicita, da Qwen3 multilingue. Prova fisica senza rete e altri OS restano da verificare.

**Evidenze Git:** `e6f1763`, `a89874e`, `d63ba16`, `cf39425`, `4ac9f7f`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).

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

## M7a — Installer locali con AI offline (retrospettiva)

**Stato:** pacchetto Windows locale preparato dopo M7 e prima di M8.
**Evidenza Git:** `24946bc`. Guide: [docs/INSTALLERS.md](docs/INSTALLERS.md).

Raccogliere installer app e runtime/modello AI realmente disponibili in una
cartella `installers/` nella root, con avvio locale, istruzioni e licenze.
Runtime/pesi fuori Git e backup delle campagne; nessun addestramento, profilo o
contenuto personale nei pacchetti. Questa prima consegna locale non equivale
alla successiva pubblicazione Forgegit M11 o all’updater M15.

## M8 - Gemma 4 12B e riaddestramento locale per campagna

**Stato aggiornato:** Operativa su Windows: impostazioni per campagna, Gemma 4 12B e vero training QLoRA locale. Le impostazioni sono state implementate prima del training; non è un modello fine-tuned D&D.

**Evidenze Git:** `a99355e`, `1fde390`, `4d007f1`, `9baee29`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).

Restano pendenti prova fisica offline/firewall e verifica macOS/Linux. Impostazioni per campagna, inferenza Gemma e QLoRA reale con adapter
sono implementati e provati su dati sintetici; verifiche e limiti aggiornati in
[docs/STATUS.md](docs/STATUS.md) e [docs/AI_TRAINING.md](docs/AI_TRAINING.md).

### M8.1 - Qualifica e sostituzione del modello

- Target richiesto: **Gemma 4 12B**, in sostituzione di Qwen3:4b-instruct.
  Prima dell'implementazione verificare su fonti ufficiali esistenza, nome
  esatto, licenza, pesi disponibili e supporto dei runtime locali. Non sono
  attestati tutti i target hardware; disponibilità e checkpoint Windows sono
  verificati in AI_TRAINING.md. Non è un modello fine-tuned D&D.
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

## M8a — Riparazione dopo lo spostamento su D (retrospettiva)

**Stato:** verifica e correzione dell’ambiente consegnate prima del restyling.
**Evidenza Git:** `313e056`.

Controllare dipendenze Node/pnpm, moduli, toolchain Rust e comandi di avvio dopo
il taglia/incolla della cartella da C a D; correggere i riferimenti dipendenti dal
percorso senza ricreare o sovrascrivere archivi utente. Non garantire percorsi
immutabili: verificare la directory del checkout a ogni nuova esecuzione.

## M8b — GUI di riferimento, impostazioni laterali e scroll indipendente (retrospettiva)

**Stato:** implementazione Windows consegnata prima dell’editor M8c.
**Evidenze Git:** `d5b07a1`, `f8d6b68`.

- Riprendere la schermata di riferimento richiesta 1:1: cornici/pergamena,
  sidebar medievale e gerarchia della campagna. La consegna è una GUI concreta;
  non dichiarare una corrispondenza pixel-perfect certificata senza un confronto.
- Accesso alle impostazioni della campagna nel menu sinistro; impostazioni
  globali disponibili dalla stessa area e distinte dalla configurazione AI.
- Liste di sessioni/pagine Markdown e contenuto del documento con scorrimenti
  indipendenti: molte sessioni non obbligano a scorrere l’intera finestra.
- Limitare il costo della disposizione del grafo e verificare gli ID dei nodi;
  preservare selezione, dati e navigazione delle fonti.

## M8c — Editor visuale e codice Markdown (retrospettiva)

**Stato:** operativo su Windows, dopo GUI/scroll e prima del tiradadi M9.
**Evidenza Git:** `64d65c6`. Collaudi nel checkpoint editor di docs/STATUS.md.

- Editor usabile con il mouse come richiesto: barra comandi, titoli, formattazione,
  elenchi/checklist, tabelle, allineamento, collegamenti e annulla/ripeti.
- Mantenere anche modifica diretta del sorgente Markdown, con import/export e
  anteprima/applicazione controllata. Non ridurre la richiesta al solo editor visuale.
- Blocchi canonici, UUID, menzioni, autosave e bozze restano protetti; se una
  conversione non rappresenta un formato, segnalarlo invece di perdere contenuto.
- Conservare l’inserimento dei link Codex e le fonti. Non dichiarare tutte le
  funzionalità di Microsoft Word né un round trip illimitato di qualunque Markdown.

## M9 - Tiradadi interno e cerchio dei draghi

**Stato aggiornato:** Operativa su Windows: dadi misti/d100, storico e animazione persistente. M12 aggiunge successivamente gli effetti degli estremi.

**Evidenze Git:** `3b0e2ac`, `7aed999`, `5fba9fc`, `6ef5222`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).

**Checkpoint di consegna del 24 ottobre 2026:** schema 015,
85 test frontend e 77 Rust PASS, backup/restore e riavvio reali verificati.
Guida, limiti e collaudi: [docs/DICE.md](docs/DICE.md). Restano le verifiche su
macOS/Linux e della distribuzione, senza dichiararle eseguite.

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

## M10 — Multilingua, accessibilità e alfabeti alternativi (operativa Windows; revisione aperta)

**Stato aggiornato:** Operativa su Windows, revisione linguistica/dialettale e assistiva ancora aperta. Espruar/Dethek sono l’estensione successiva M13.

**Evidenze Git:** `79376ee`, `af92934`, `a2d0e1c`, `3eaf56a`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).

Obiettivo: cambiare lingua dalle impostazioni mantenendo inalterati gli appunti,
i nomi propri, gli UUID, le citazioni, i backup e le fonti della campagna.

- Localizzazione completa dell’interfaccia: italiano, inglese, tedesco, francese,
  spagnolo, portoghese, giapponese, coreano, cinese, arabo e dialetto ticinese.
  Varianti concordate: portoghese brasiliano, cinese semplificato, ticinese in
  bozza da revisionare; non presentare traduzioni automatiche come validate.
- Lingue/alfabeti di fantasia: Klingon, Romulano e Galactic alphabet.
  Varianti confermate: SGA di Minecraft e Rihannsu romanizzato del dizionario
  indicato dall’utente. Verificare licenze di font, mapping e lessico; distinguere
  traduzione da traslitterazione e segnalare i termini senza equivalente.
- Braille e Morse come modalità di resa/accessibilità, non semplici lingue.
  Mantenere testo semantico per screen reader/display Braille; definire grado,
  lingua e standard del Braille con collaudo assistivo. Per Morse offrire
  trascrizione testuale reversibile e, se prevista, audio disattivato inizialmente.
  Non convertire irreversibilmente il contenuto salvato né sostituire l’accessibilità
  reale con soli glifi Unicode.
- Separare stringhe UI dai dati, usare cataloghi con chiavi stabili, plurali,
  date/numeri locali e fallback esplicito italiano. Lingua selezionabile senza
  riavvio, preferenza persistente, funzionamento offline e font locali con licenze.
- Supportare arabo RTL e contenuti misti con isolamento bidirezionale; CJK,
  composizione IME, font fallback, ricerca e impaginazione senza troncamenti.
  Le fonti D&D mantengono lingua/edizione/provenienza originali; traduzioni
  assistite eventuali restano distinguibili, senza creare regole o fatti nuovi.
- Accettazione: tutte le viste, errori, conferme, editor visuale/Markdown,
  impostazioni, AI, backup e tiradadi; cataloghi completi e fallback, cambio lingua
  e riavvio, RTL, tastiera/screen reader, testi lunghi, IME e finestre minime.
  Verificare leggibilità degli alfabeti alternativi con font assente e ritorno
  alla lingua ordinaria. Verificare round trip dei dati e archivi precedenti.

Implementata il 24 ottobre 2026: preferenze globali persistenti, 13 lingue
selezionabili e tre scritture, cataloghi/font offline, dizionari editor, RTL,
laboratorio reversibile e recupero italiano. 1427 messaggi candidati per catalogo
naturale; Klingon/Rihannsu con lessico parziale dichiarato e glossario verificato.
113 test frontend, 79 Rust e collaudi nativi Windows descritti in docs/I18N.md.
Le traduzioni sono bozze: M10 non è dichiarata integralmente accettata finché
restano revisione linguistica/dialettale, lingue di fantasia complete dove
verificabili, prova assistiva fisica/IME reale e verifiche macOS/Linux.
Non viene avviata una nuova milestone senza richiesta dell’utente.

## M12 — Draghi animati per esiti estremi del singolo dado (implementata Windows)

**Stato aggiornato:** Operativa su Windows: celebrazione/minaccia dei due draghi sugli estremi del singolo dado, d100 invertito. Eseguita prima di M13 e della distribuzione M11.

**Evidenze Git:** `45c0268`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).

Rinnovare la schermata del tiradadi con animazioni dei due draghi per gli esiti
migliori/peggiori. Il trigger si applica solo quando il tiro contiene **un solo
dado complessivo**, non un dado estremo all’interno di un tiro multiplo o misto.

| Dado singolo | Esito celebrato | Esito minaccioso |
| --- | --- | --- |
| d4 | 4 | 1 |
| d6 | 6 | 1 |
| d8 | 8 | 1 |
| d10 | 10 | 1 |
| d12 | 12 | 1 |
| d20 | 20 | 1 |
| d100 | **1** | **100** |

- Celebrazione: entrambi i draghi prendono vita e sputano fiamme intorno al
  cerchio per festeggiare il risultato migliore.
- Minaccia: entrambi si girano verso lo schermo, volano verso il giocatore e
  sputano fiamme, come se volessero incendiarlo. Il risultato resta leggibile.
- Valori intermedi, tiri multipli e misti mantengono un’animazione ordinaria.
  L’inversione del d100 è una preferenza di presentazione richiesta dall’utente,
  non una nuova regola D&D né una modifica dei valori numerici registrati.
- Gli effetti partono soltanto dal risultato reale già salvato; non modificare
  casualità, storico, quantità, subtotali, totale o gestione del retry M9.
  Il replay usa lo stesso risultato e non genera un altro tiro.
- Animazioni brevi e fluide, asset locali con provenienza/licenze documentate,
  nessuna generazione o richiesta remota durante il tiro. Evitare lampeggiamenti
  intensi; offrire skip e movimento ridotto con indicazione statica dell’esito.
- Accettazione: verificare entrambi gli estremi di tutti i sette dadi, valori
  intermedi, d100 invertito, tiri multipli/misti senza trigger speciale, replay,
  retry/errore salvataggio, skip/movimento ridotto, cambio vista e riavvio. Storico
  e backup devono conservare esattamente il tiro originale.

## M13 — Alfabeti Elfico e Dethek (implementata Windows)

**Stato aggiornato:** Operativa su Windows: Espruar e Dethek, font locali, fallback e preferenze v2 compatibili con v1. Eseguita dopo M12 e prima di M11.

**Evidenze Git:** `26d1c83`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).

Aggiungere Elfico e Dethek alle opzioni di lingua/scrittura delle impostazioni
globali, mantenendo tutte le opzioni M10 esistenti. Sono alfabeti: non presentarli
come traduzioni automatiche complete delle lingue elfiche o naniche.

- Prima dell’implementazione identificare la variante esatta di «Elfico» e la
  fonte del mapping Dethek; documentare repertorio, direzione, maiuscole, numeri
  e punteggiatura, senza inventare simboli mancanti. La variante elfica è
  stata confermata dall’utente: Espruar di D&D / Forgotten Realms.
- Verificare font e licenze; includere asset locali per uso offline. Caratteri
  non rappresentabili e font assente devono conservare una resa leggibile.
- Integrare selezione persistente, anteprima/laboratorio e pacchetto reversibile
  M10. Definire esplicitamente la compatibilità/versione dei pacchetti e delle
  preferenze prima di estendere le whitelist; mantenere il recupero italiano.
- Testo semantico ordinario per tecnologie assistive; nessuna riscrittura di
  appunti, nomi, UUID, fonti, dati salvati o backup. Nessuna grammatica o lessico
  inventato per simulare una traduzione.
- Accettazione: mapping documentato e testato, cambio immediato e riavvio,
  round trip esatto dell’originale, caratteri non supportati, assenza del font,
  tastiera/accessibilità e compatibilità con preferenze/archivi precedenti.

## M11 — Release versionate e pacchetti su Forgegit

**Stato aggiornato:** Parziale: pacchetti app/AI 0.2.0 locali e bozza id 2; upload grandi interrotti dal gateway. La release app-only 0.4.0 è pubblica tramite M15, ma non completa la distribuzione AI M11.

**Evidenze Git:** `43467fb`, `3af0ef0`, `5431d28`, `4abb4e3`, `ad7760d` (consegna app M15). Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).

Repository dell’utente verificato nell’attuale `origin`:
`https://github.com/Acelith/Chronexus.git`. Non presumere API o funzionalità del
server: verificarle prima di realizzare la procedura di pubblicazione.

- Preparare un flusso ripetibile di versionamento coerente fra app, Cargo,
  configurazione Tauri, tag e pacchetti, partendo dalle versioni/tag realmente
  presenti. Non assegnare ora una versione a una funzionalità non implementata.
- A ogni futura consegna di milestone implementata e verificata, pubblicare sul
  repository dell’utente il codice della consegna e una release versionata con
  i pacchetti prodotti, salvo istruzione successiva di non pubblicare. Questa è
  l’autorizzazione permanente richiesta dall’utente, non un’autorizzazione a
  pubblicare la presente modifica documentale.
- Allegare installer/pacchetti dell’app e, quando previsto, il pacchetto AI locale
  con runtime, pesi redistribuibili e licenze; verificare limiti di dimensione,
  autenticazione disponibile e supporto del server. Non usare altri servizi o
  repository come destinazione alternativa senza autorizzazione.
- Accompagnare gli asset con checksum, istruzioni, note di rilascio in italiano,
  prove realmente eseguite, compatibilità/migrazioni e limiti. Pubblicare soltanto
  piattaforme e pacchetti effettivamente costruiti/verificati; distinguere firma
  e prove mancanti. Mai includere campagne, backup, profili, segreti o dati privati.
- Non fare force-push, riscrivere storia o sovrascrivere tag/release/asset
  esistenti. Su errore interrompere la pubblicazione, conservare i pacchetti
  locali e riportare quanto effettivamente caricato, senza dichiarare successo.
- Accettazione: verificare corrispondenza tag/commit/versione, download e checksum
  degli allegati pubblicati, installazione/avvio su piattaforme provate e accesso
  reale alla release. Non creare pubblicazioni finte per segnare la milestone fatta.

## M14 — Assistenti esterni, integrazione nascosta

**Stato aggiornato:** Operativa su Windows: integrazione MCP nascosta per assistenti esterni; assistente integrato escluso. La verifica di chiusura desktop rimasta aperta nel checkpoint iniziale è stata superata durante M15.

**Evidenze Git:** `fa38d2e`, `ad7760d` (verifica successiva). Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).

Collegamento consegnato su richiesta del 25 ottobre 2026,
separato dall'assistente integrato della campagna.

- Nessun controllo visibile: attivazione tramite parametri di avvio; predefinito
  disattivo, lettura/scrittura limitata esplicitamente a una singola campagna.
- Adattatore MCP stdio con strumenti tipizzati per appunti, sessioni, Codex,
  scheda, party, inventario, incantesimi e abilità. Nessun comando AI integrata,
  SQL arbitrario, cancellazione o caricamento remoto implicito.
- Autenticazione locale temporanea, loopback, confini delle campagne, revisioni
  e conflitti senza perdita delle bozze. Persistenza e backup reali esistenti.
- Accettazione: test di autorizzazioni, protocolli, riapertura archivio,
  ripristino con servizio attivo, validazione e refresh delle viste pulite.
- Implementazione e istruzioni: docs/AUTOMATION.md. Schema 015 invariato.
  Verifiche Windows e limiti effettivi: docs/STATUS.md.

## M15 — Aggiornamento interno con backup obbligatorio (operativa Windows)

**Stato aggiornato:** Operativa su Windows, release 0.4.0 pubblica con tre allegati e download anonimi verificati. Restano upgrade reale fra due release updater e accettazione macOS/Linux.

**Evidenze Git:** `c7d95ca`, `d75f5f3`, `db8fc68`, `ad7760d`. Verifiche e limiti in [docs/STATUS.md](docs/STATUS.md).

Implementata la richiesta del 25 ottobre 2026: controllo esplicito, download e
installazione dalle impostazioni globali, con canale pubblico Forgegit o server
HTTPS configurabile. Nessun login client, telemetria o invio di campagne.

- Scoprire l’ultima release stabile con API Forgejo e il suo `latest.json`, oppure
  leggere un manifesto Tauri statico. Rifiutare bozze/anteprime e URL insicuri.
- Verificare firma e versione firmata prima di rendere disponibile l’installazione;
  timeout, limiti, annullamento ed errori recuperabili. Nessun downgrade implicito.
- Creare e verificare un backup `.nodex` di tutte le campagne, con immagini e
  allegati, prima di ogni tentativo d’installazione. Ricevuta e preferenze a fianco;
  backup fallito blocca l’installer. Non eliminare automaticamente copie precedenti.
- Usare il componente ufficiale Tauri. Tenere chiavi private cifrate fuori Git,
  artefatti firmati e canale pubblico separati dai pacchetti AI grandi M11.
- Accettazione: firme/manomissioni/versioni, discovery anonima, backup/ripristino
  con immagini, concorrenza Store/AI/MCP, errori download/backup e test desktop.
  Primo bootstrap manuale; prova upgrade pubblico e altri OS restano distinte.

Istruzioni ed evidenze: docs/UPDATES.md e docs/STATUS.md. SQLite 015 invariato.

Checkpoint M15: release pubblica v0.4.0, tre allegati updater verificati con
accesso anonimo, sorgente compilato d75f5f3. Bootstrap manuale e discovery API/
manifesto, firme/versioni e backup verificati. Resta la prova di upgrade tra due
versioni updater pubbliche e l’accettazione macOS/Linux. Dettagli in STATUS.md.

## M15a — Annuncio epico degli aggiornamenti (pianificata)

**Stato:** richiesta dopo M15; non implementata. Era prevista prima di M16, ma
l’utente ha chiesto di eseguire M16 per prima: resta la prossima milestone.
Estende la presentazione dell’updater esistente, senza sostituire firme e backup.
L’ID M16 resta assegnato a Wikidot; non rinumerare i riferimenti precedenti.

### Annuncio e controllo reale della disponibilità

- Quando è disponibile una versione più recente e compatibile, mostrare un popup
  medievale epico: **un vassallo/araldo che suona la trombetta e presenta un
  manifesto in pergamena** per invitare all’aggiornamento, coerente con Chronexus.
- Basare l’annuncio sul canale reale M15: niente versioni simulate, bozze,
  anteprime non abilitate, reinstallazione della versione corrente o falso allarme
  quando il server non risponde. Titolo, versione e note da dati reali e resi sicuri.
- Aggiungere un controllo automatico leggero dopo l’avvio dell’interfaccia, oltre
  al controllo manuale, con preferenza per disabilitarlo. Nessun polling continuo
  o invio di campagne. È un’estensione futura rispetto al solo controllo esplicito
  della 0.4.0; non abilita richieste automatiche della wiki o dei modelli AI.
- Rinviare il popup durante scrittura, salvataggio, ripristino, addestramento o
  altri dialoghi/operazioni in corso; non cancellare bozze né rubare il focus
  mentre si prende nota. Evitare annunci duplicati della stessa versione.

### Presentazione e azioni

- Breve animazione del vassallo e della trombetta, manifesto leggibile con versione,
  novità e azione per aggiornare; asset locali con licenze/provenienza documentate.
  Nessuna generazione, download di asset o servizio AI durante l’annuncio.
- Breve suono di trombetta controllabile/disattivabile; rispettare preferenze audio
  e movimento ridotto. Se l’audio automatico è bloccato dalla piattaforma, mantenere
  annuncio visuale/testuale funzionante senza errori o riproduzioni ripetute.
- Consentire **Aggiorna**, **Ricordamelo più tardi** e chiusura del popup. Il rinvio
  rispetta una politica dichiarata senza ripresentare continuamente l’avviso;
  il controllo manuale nelle impostazioni resta disponibile.
- L’azione di aggiornamento riusa il flusso M15: download con avanzamento e
  annullamento, firma/versione verificate e backup obbligatorio prima di installare.
  Non avviare installer direttamente dall’animazione né aggirare un errore di backup.
- Dialogo accessibile: testo ordinario, tastiera, focus gestito e ripristinato,
  Escape/chiusura, contrasto e layout alle dimensioni minime. L’animazione non
  ostacola la lettura e può essere saltata; nessun lampeggiamento intenso.

### Accettazione M15a

- Update disponibile reale, stessa versione, versione vecchia/target incompatibile,
  errore server e offline; popup solo nel caso valido, controllo automatico
  disattivabile e nessuna richiesta automatica alle fonti D&D.
- Aggiornamento, rinvio/chiusura, riavvio, avvisi duplicati e arrivo della risposta
  durante una bozza o altro dialogo; nessuna perdita di contenuto o focus inatteso.
- Animazione/audio locale, audio disattivato/bloccato, movimento ridotto, tastiera
  e screen reader; versione e note sempre leggibili anche senza effetti.
- Regressione del percorso M15: firma errata e backup fallito bloccano l’installer;
  nessun download/installazione senza l’azione esplicita dell’utente.

## M16 — Scraping HTML Wikidot e scelta della wiki (operativa Windows)

**Stato aggiornato:** implementata il 25 ottobre 2026 su richiesta esplicita, prima
di M15a. Schema 016, adapter Rust, selettore globale, cache separata eliminabile,
proposta di cambio fonte su consenso e importazione esplicita degli incantesimi.
Evidenze, test, collaudo desktop reale e limiti in [docs/STATUS.md](docs/STATUS.md).
Restano macOS/Linux e la revisione delle nuove stringhe nelle altre lingue.
La release pubblicata 0.4.0 non contiene ancora M16.

Scelte di implementazione verificate: indici `spells`, homepage (talenti,
background, classi/sottoclassi), `lineage` e `wondrous-items`; robots.txt del
25/10/2026 vieta solo percorsi paginati `/p/`; la pagina dichiara CC BY-SA 3.0
salvo diversa indicazione, mostrata come licenza dichiarata, non garantita.

### M16.1 — Fonte selezionabile nelle impostazioni globali

- Aggiungere **Impostazioni dell’app → Fonti D&D / Wiki** con scelta almeno fra
  **Wikidot D&D** e **Open5e**; Wikidot è la fonte predefinita richiesta.
- Preferenza globale persistente e immediata, disponibile anche senza campagna:
  default Wikidot nei nuovi profili e in quelli migrati senza scelta esplicita.
  Conservare una preferenza già esplicitamente salvata, quando presente.
- Distinguere lo stato futuro dalla scelta attuale Open5e. Definire versione,
  validazione e recupero delle preferenze; riavvio e ripristino di una campagna
  non devono cambiare implicitamente la wiki selezionata o cancellarne i dati.
- Cambio fonte senza fondere risultati, ID o cache; mostrare il provider attivo.
  Se Wikidot non reperisce le informazioni, chiedere esplicitamente all’utente
  se vuole cambiare fonte (M16.5), senza sostituzioni o richieste silenziose.
- Mantenere distinto il catalogo D&D 5e API / SRD 2014 già collegato alla scheda,
  gli incantesimi personalizzati e le copie importate; non riscriverli al cambio wiki.

### M16.2 — Lettura delle pagine pubbliche Wikidot

- Usare HTML pubblico di `https://dnd5e.wikidot.com/`, con indici di categoria
  per ricerca di incantesimi e delle altre sezioni supportate (classi, talenti,
  oggetti e specie). Prima dell’implementazione definire e verificare gli indici
  effettivi: non inventare endpoint REST o un servizio di ricerca assente.
- Adapter di sola lettura nel backend Rust: GET HTTPS su host/percorsi ammessi,
  limiti di dimensione/tempo/concorrenza, richieste distanziate e annullamento.
  Niente chiave XML-RPC, login, aggiramento di blocchi/CAPTCHA o browser headless
  necessario per leggere pagine il cui contenuto è già nell’HTML.
- Ricerca su indici consultati esplicitamente e cache locale limitata; aprire le
  voci richieste senza crawling massivo o scaricamento automatico all’avvio.
  Verificare robots.txt e indicazioni del sito durante l’implementazione.
- Nessun invio di appunti, schede, campagne o domande AI: soltanto richieste
  esplicite a indici/voci pubbliche e termini di ricerca delle regole.

### M16.3 — Parsing, provenienza e uso locale

- Estrarre titolo, testo, tabelle e campi realmente presenti: per gli incantesimi,
  livello/scuola, lancio, gittata, componenti, durata, descrizione e classi.
  Dichiarare le categorie effettivamente supportate; nessun risultato finto.
- Conservare URL canonico, provider, nome originale, fonte/manuale, edizione
  quando verificabile, data di acquisizione e distinzione ufficiale/UA/homebrew.
  Non promuovere in automatico una regola della wiki a fatto della campagna.
- HTML sempre non fidato: rimuovere script, iframe, form, handler e risorse
  attive; rendere testo/dati con componenti locali senza eseguire il sito nell’app.
- Anteprima prima di importare una voce supportata nella scheda; campi modificabili,
  conferma esplicita e provenienza conservata. Non sovrascrivere asset salvati.
- Se la struttura cambia o un campo non è riconosciuto, segnalarlo e offrire il
  testo originale reso in modo sicuro; non inventare valori né salvare dati errati.
- Cache offline separata per provider/edizione/URL, con stati stale/errore e limiti.
  Le copie importate restano indipendenti dall’eviction. Versionare solo le eventuali
  migrazioni necessarie e preservare archivi/cache Open5e precedenti.
- Accessibilità pubblica e robots.txt non sono una licenza di redistribuzione:
  verificare le condizioni delle singole fonti, mantenere attribuzioni e non
  includere automaticamente l’intero catalogo nei pacchetti/release pubblici.

### M16.4 — Cache offline eliminabile dall’utente

- Nelle impostazioni della wiki aggiungere **Svuota cache offline**, con selezione
  della fonte interessata e possibilità di svuotare tutte le cache wiki.
  Mostrare quantità/dimensioni disponibili e cosa verrà eliminato prima della conferma.
- Eliminare soltanto pagine/indici e file derivati posseduti dalla cache scelta:
  conservare campagne, appunti, incantesimi/oggetti importati, immagini gestite,
  preferenze di fonte e backup. Spiegare che le sole voci in cache non saranno
  più consultabili offline finché l’utente non le riapre online.
- Conferma e annullamento, esito/errore visibili e svuotamento coerente; annullare
  o invalidare richieste pendenti affinché non ripopolino subito la cache appena
  cancellata. Non avviare un riscaricamento automatico dopo lo svuotamento.
- Distinguere cache da copie salvate/importate. Se una cache alimenta il retrieval
  delle regole AI, segnalare le fonti non più disponibili per nuove richieste,
  preservando conversazioni, citazioni storiche e dati salvati della campagna.

### M16.5 — Cambio fonte proposto quando Wikidot non fornisce informazioni

- In caso di voce non trovata, ricerca senza risultati, errore rete/server o
  struttura HTML non interpretabile nei campi necessari, mostrare il motivo e
  chiedere: **«Wikidot non ha fornito le informazioni. Vuoi usare Open5e?»**.
- Offrire passaggio alla fonte alternativa, nuovo tentativo su Wikidot o
  annullamento; se esiste una copia in cache utilizzabile, permetterne la lettura
  dichiarandone la data senza imporre il cambio di fonte.
- Cambiare fonte e ripetere la ricerca soltanto dopo accettazione. Rendere chiaro
  che la nuova scelta viene salvata nelle impostazioni globali; un rifiuto o la
  chiusura mantengono Wikidot e non inviano richieste all’altra fonte.
- Conservare il termine pubblico cercato, attribuire i risultati al provider reale
  e non fondere cache o riscrivere voci già importate. Nessun loop di popup/retry
  o selezione implicita di un’altra fonte se anche l’alternativa non risponde.

### Accettazione M16

- Selezione Wikidot/Open5e, default Wikidot, profili esistenti senza preferenza,
  scelta esplicita conservata, riavvio e nessuna mutazione degli incantesimi salvati.
- Ricerca/apertura delle categorie supportate e prova pubblica limitata documentata;
  parser testato con fixture sintetiche per tabelle, Unicode, campi mancanti,
  markup cambiato e contenuto HTML malevolo, senza eseguire istruzioni delle pagine.
- Offline/cache, separazione provider/edizioni, limite richieste/dimensioni, timeout,
  annullamento, HTTP 403/429/5xx e redirect fuori whitelist senza perdita delle bozze.
- Import esplicito e backup/ripristino delle copie salvate con identità/provenienza;
  nessuna migrazione distruttiva o modifica alla selezione globale per effetto del restore.
- Svuotamento cache per fonte/totale, conferma/annullamento, dati importati e backup
  intatti, scelta fonte conservata, richieste pendenti invalidate e nessun refetch
  automatico. Gestire cache già vuota, errori di eliminazione e uso offline.
- Fallimenti Wikidot con richiesta di cambio fonte: accettazione persistente e
  ricerca alternativa, rifiuto/chiusura senza richieste a Open5e, uso della cache,
  dati mancanti/markup cambiato e alternativa indisponibile senza loop di popup.
- Interfaccia italiana, tastiera e stati vuoti/caricamento/errore; accesso impostazioni
  anche senza campagna. Dichiarare soltanto le piattaforme realmente verificate.

Ricerca già svolta: [docs/RESEARCH_DND.md](docs/RESEARCH_DND.md). API XML-RPC e
scraping HTML sono due accessi distinti; una lettura XML-RPC anonima ha restituito
401 nell’indagine precedente. M16 usa solo l’HTML pubblico, senza chiavi.

## Accettazioni residue e prossima fase

- **M6:** runner/pacchetti macOS/Linux e collaudi di distribuzione non dimostrati
  dalle sole prove Windows; seguire le evidenze aggiornate di STATUS.
- **M7/M8:** prova fisica senza rete e target hardware/OS ulteriori non attestati;
  mantenere distinti inferenza, refresh retrieval e addestramento dei pesi.
- **M10:** revisione delle traduzioni/ticinese, lessico di fantasia e collaudo
  assistivo/IME reale; non dichiarare una traduzione completa quando c’è fallback.
- **M11:** distribuzione dei pacchetti AI grandi ancora aperta; la release app
  0.4.0 di M15 non pubblica né completa la vecchia bozza 0.2.0.
- **M15:** upgrade reale fra due versioni dotate di updater e verifica altri OS.
- **M16:** macOS/Linux, traduzioni delle nuove stringhe e cambi futuri dell’HTML
  di Wikidot; nessuna release contenente M16 pubblicata finora.
- **Prossima nuova milestone funzionale: M15a**, annuncio epico degli aggiornamenti,
  solo pianificata e da implementare su richiesta.

## Fuori dal perimetro attuale

Adattatori automatici di regole verificati per altri sistemi/edizioni,
sincronizzazione multipostazione con conflitti, timeline avanzata, mappe
interattive, esportazione PDF delle schede e OCR richiedono scelte e milestone
proprie. Nessuna di queste funzioni è implicitamente autorizzata da M16.

## Checkpoint

Lo stato operativo, i test realmente eseguiti, i commit e i blocchi correnti sono
in docs/STATUS.md; le decisioni in docs/DECISIONS.md. I vecchi checkpoint rimangono
nella cronologia Git e nelle sezioni storiche di STATUS, senza istruzioni obsolete
che facciano ripartire milestone già consegnate o vietino pubblicazioni già autorizzate.
