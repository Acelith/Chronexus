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

**Stato: operativa e collaudata su Windows, autorizzata il 24 ottobre 2026.**
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

## M9 - Tiradadi interno e cerchio dei draghi

**Stato: implementata e collaudata su Windows il 24 ottobre 2026.** Schema 015,
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

## M11 — Release versionate e pacchetti su Forgegit (ripresa LAN in corso)

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

## M12 — Draghi animati per esiti estremi del singolo dado (implementata Windows)

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

**Istruzione di esecuzione successiva:** implementare M12 e M13; completarle e
verificarle prima di compilare i pacchetti e pubblicare M11. La pubblicazione
finale su Forgegit è ora esplicitamente autorizzata. Nessuna consegna intermedia.

M12/M13 verificate il 24 ottobre 2026 nel desktop isolato Windows; dettagli e
limiti in docs/releases/v0.2.0.md. M11: codice/tag pubblicati e installer leggero verificato nella bozza; upload AI
grandi interrotti da HTTP 502. Non è conclusa finché download e checksum
degli asset pubblicati non sono confermati. Le revisioni M10 rimangono aperte.

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
interattivo Windows. M8 per Gemma e riaddestramento locale è ora operativa su
Windows, con i limiti riportati sopra. M9 è ora operativa su Windows;
M10 è operativa su Windows; revisione linguistica e assistiva restano aperte.

## M14 — Assistenti esterni, integrazione nascosta

Implementare il collegamento esplicitamente richiesto il 25 ottobre 2026,
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

## M15 — Aggiornamento interno con backup obbligatorio

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
