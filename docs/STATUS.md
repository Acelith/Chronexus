# Stato Chronexus — 24 ottobre 2026

## M9 — interfaccia e scena implementate; collaudo finale in corso

- Menu Tiradadi, sette tipi geometrici decorati con texture locale, composizione
  mista e quantità, azzeramento soltanto dopo conferma SQLite, retry idempotente.
- Cerchio originale dei draghi, rotolamento/atterraggio/fuoco/rivelazione e cifre
  slot in 2,5 secondi; skip e movimento ridotto. Al massimo 14 dadi rappresentativi
  nella scena, tutti i valori sempre disponibili nei dettagli e nello storico.
- 84 test frontend PASS (11 nuovi per dadi); lint, typecheck, format e build
  frontend PASS. React Doctor dopo separazione controller/timeline: nessun
  problema nei file cambiati, punteggio 74 invariato rispetto alla baseline.
- Collaudo desktop reale: tutti i tipi, d100, quantità miste e 100 dadi, totali
  e valori confrontati con SQLite; selezione azzerata, skip, vista interrotta,
  riduzione movimento, isolamento e paginazione su 187 tiri sintetici PASS.
  Timeline misurate: 2528/2520/2524 ms per 1/7/100 dadi.
- Audit axe WCAG A/AA (2.0, 2.1, 2.2) su vuoto e risultato: 0 violazioni rilevate;
  non è una certificazione completa. Finestre 1586×992/1200×800/900×700/760×540,
  nessun overflow della finestra; richieste remote bloccate, nessuna richiesta
  Internet al tiro. Il canale ipc.localhost è locale, non traffico remoto.
- Backup/ripristino tramite UI e JSON export schema 015 verificati con 187 tiri
  della campagna e uno della seconda. Prove riavvio, tastiera e fixture grafica
  6/9/100 in completamento; nessuna campagna personale modificata.
- Skill: impeccable/imagegen per scena e asset, accessibility e react-testing per
  controlli, react-doctor e systematic-debugging per etichette/timer/regressioni.

## M9 — in corso: backend persistente

- Migrazione additiva 015: storico dadi per campagna, ID richiesta idempotente,
  risultati individuali/subtotali/totale e data. Casualità dal sistema operativo
  con rejection sampling; nessuna estrazione nel frontend.
- d4/d6/d8/d10/d12/d20/d100, 0–50 per tipo, 1–100 dadi per tiro. Retry dello
  stesso ID e composizione restituisce il tiro precedente senza nuovi valori.
- Backup con conteggio opzionale e validazione dei risultati; archivi fino a 014
  ripristinati e migrati senza storico. JSON export include diceRolls.
- 77 test Rust PASS, di cui 8 nuovi su dadi, errori, paginazione, riavvio e backup;
  typecheck PASS; 5 test UI backup PASS. Clippy: correzione del solo clone nel test,
  rieseguito prima del commit. Interfaccia/animazione M9 ancora da implementare.
- Skill: rust-best-practices per ownership/errori; sqlite-expert per transazione,
  migrazione e indice verificato con EXPLAIN QUERY PLAN; react-testing per backup.

## Editor visuale/Markdown e collaudo finale — 24 ottobre 2026

- Barra persistente con stili, titoli, citazioni, elenchi/attività, evidenziazione,
  allineamento, link esterni e pagine Codex, annulla/ripeti. Modalità Markdown
  direttamente modificabile, applicazione, annullamento e salvataggio espliciti.
- Guard di navigazione/chiusura include il sorgente. Sintassi non supportata o
  link non validi mantengono la bozza; UUID e ID/fonti dei blocchi invariati
  conservati. Formati visuali dei blocchi invariati conservati nel round trip.
- Test: 73 frontend PASS; baseline 69 Rust PASS dalla nuova posizione (nessuna
  modifica Rust/schema). Typecheck, lint, format e build frontend PASS.
  Build desktop Windows da D PASS; ricostruzione finale dopo il refactoring
  verificata nel commit di consolidamento. Warning Vite sul chunk editor ancora presente.
- Prova desktop ripetibile `scripts/qa/gui-editor.mjs check`: PASS su archivio
  sintetico isolato; scroll a tre risoluzioni, formati, menzioni UUID, errori
  bloccanti e menu impostazioni. Chiusura ordinata e nuova apertura dello stesso
  archivio: fase `restart` PASS, contenuti e formati recuperati da SQLite.
- Riparazione AI: Python della venv su D/CUDA disponibili; Ollama avviato da D,
  Gemma 4 12B risponde «OK» con VRAM rilevata. Nessun nuovo training eseguito.
- Guide: `docs/EDITOR.md`; schema JSON v1 e SQLite 014 invariati; nessuna
  campagna personale modificata. Il Markdown non rappresenta tutti i formati Word:
  tabelle, HTML, immagini e blocchi di codice sono esplicitamente rifiutati.
- Skill: react-testing, systematic-debugging, react-doctor per controlli e correzioni;
  impeccable per il detector finale (nessun pattern segnalato dopo la correzione).
- Commit GUI: d5b07a1; disposizione grafo: f8d6b68; spostamento: 313e056.
  Editor: 64d65c6; M10 nel successivo commit documentale. Nessun push.
- React Doctor finale sui nuovi file inclusi: 74/100, invariato rispetto alla
  prima scansione; un avviso residuo di complessità nel componente editor.
  Nessun errore lint/types; detector impeccable finale: array vuoto.

## GUI di riferimento e navigazione — 24 ottobre 2026

- Ripresa la composizione allegata: cuoio scuro, pergamena, font locali OFL,
  rosa dei venti, incisione originale, tab con icone e dettaglio laterale del grafo.
  Le illustrazioni dei personaggi dipendono dagli allegati reali; nessun dato
  dell’esempio inserito negli archivi personali. La corrispondenza pixel per pixel
  con l’immagine non è certificata: icone, incisione e geometria dei dati sono originali.
- Impostazioni della campagna e assistente nel menu sinistro. Menu azioni compatto,
  selettore campagne e ultima modifica derivata dai documenti disponibili.
- Diario e Codex: elenco e documento scorrono indipendentemente dalla cornice;
  vecchia regola mobile orizzontale rimossa anche alla dimensione minima.
- Grafo con nodi a medaglione, etichette visibili, disposizione stabile con
  riduzione degli incroci su piccoli grafi (coppie duplicate escluse), zoom,
  filtri avanzati e fonti/certezze mantenuti. Ritratto reale nel dettaglio, se allegato.
- Verifiche: 14 test mirati App/grafo PASS; typecheck e lint PASS; build frontend
  PASS (warning preesistente sul peso dell’editor). Prove native con fixture isolate
  a 1586×992, 900×700 e 760×540: nessun overflow della finestra, liste verticali
  indipendenti e font locali caricati. Screenshot e rapporti in .tools/ui-refresh/.
- Skill: impeccable per confronto e rilevamento finale; imagegen per materiali e
  incisione offline; react-testing per regressioni; react-doctor per diagnosi React.
  Editor consolidato nella sezione precedente; multilingua pianificato come M10.

## Riparazione dopo spostamento su D — 24 ottobre 2026

- Collegamenti node_modules ricreati con lockfile invariato: i precedenti
  puntavano a C. Store relativo in pnpm-workspace.yaml e launcher Dev.ps1.
- Baseline dalla nuova posizione: 59 test frontend e 69 Rust PASS;
  typecheck e Vite 8.3.5 PASS. Python della venv su D importa PyTorch
  2.14.1+cu130, CUDA disponibile. Nessuna campagna personale modificata.
- Skill: systematic-debugging per la causa dei collegamenti rotti; tauri-v2
  per la verifica della toolchain portatile. Rifacimento GUI/editor in corso.

## Milestone e prossimo passo

M7 operativa e collaudata su Windows: assistente locale con fonti, GPU e cronologia.
**Accettazione completa ancora parziale**: manca la prova con rete fisicamente
scollegata/blocco firewall. La prova proxy e le connessioni loopback sono distinte.
Restano inoltre M6 macOS/Linux/CI reali e revisione del wizard Windows interattivo.
M8 operativa e collaudata su Windows: Gemma 4 12B locale, impostazioni per
campagna (013), QLoRA reale e adapter con backup/ripristino (014). Accettazione
sulle altre piattaforme e prova fisica offline/firewall ancora pendenti.
**Prossima milestone funzionale: M9 — Tiradadi interno e cerchio dei draghi.**
M10 aggiunta alla roadmap: tutte le 16 lingue/modalità richieste, RTL, CJK,
accessibilità Braille, Morse e alfabeti di fantasia; solo pianificazione,
nessuna localizzazione implementata in questo intervento.
Nessun push autorizzato o eseguito.

Il modello specifico D&D 1.5B è stato provato su GPU e scartato per qualità.
L'utente ha approvato esplicitamente Qwen3:4b-instruct multilingue con fonti locali,
**non fine-tuned D&D**. Setup e identità verificabili: [AI_LOCAL.md](AI_LOCAL.md).

## Verifiche effettive M8

- 69 test Rust e clippy offline con `-D warnings`: PASS. 59 test frontend:
  PASS; ultimi ritocchi coperti anche da 7 test mirati dell'assistente.
  Lint, typecheck, format e build frontend: PASS. Worker Python: 5 PASS.
- `pnpm build:desktop` e `pnpm package:desktop`: PASS; installer NSIS Windows
  non firmato generato. Installazione M8 non ripetuta, non confonderla con M6.
- GPU RTX 4080 SUPER 16 GB: 4 casi Qwen e 4 Gemma con esito atteso nell'app.
  Training dal menu su 4 estratti/8 passaggi e successiva prova su 74 estratti,
  74 esempi/74 passaggi: pesi modificati, copertura completa, tre controlli di
  citazioni/assenze/GPU, attivazione e domanda sull'ultima fonte PASS.
  Picco PyTorch: 11.705.906.688 byte (circa 10,9 GiB).
- Annullamento reale dopo il primo passaggio GPU: PASS, modello attivo invariato.
  Riavvio, backup/restore nativo, rimozione del solo modello sintetico e sua
  ricostruzione dall'adapter senza nuovo training: PASS; citazioni ancora valide.
- Regole sintetiche 2014/2024 separate, edizione errata respinta, fonte malevola
  esclusa dalle risposte e bloccante per training, esclusione esplicita: PASS.
  Ollama realmente spento: errore utile e `sentToModel=false`; runtime riavviato.
- Backend Python/CUDA e checkpoint verificati anche nel percorso standard
  `%APPDATA%/it.nodex.desktop/ai-training`. Campagne personali non modificate.
  Runtime e checkpoint fuori dagli archivi; adapter compatti inclusi e verificati.
- Script ripetibile con fixture sintetiche: `scripts/qa/m8-local-ai.mjs`;
  originali dei rapporti in `.tools/m8/`, ignorati. La fase boundaries del
  nuovo harness è stata rieseguita; seed/train/recover/coverage derivano dagli
  stessi scenari nativi eseguiti prima del consolidamento, senza un secondo
  giro completo del nuovo harness. Modelli derivati temporanei rimossi dopo
  importazione/collaudo; nessun test fisico offline o guasto hardware simulato
  presentato come verifica reale. CUDA assente coperta da test controllato.
- Commit: a99355e impostazioni; 1fde390 training; 4d007f1 copertura completa.
  Guide e collaudo consolidato nel commit successivo. Nessun push.

## Funziona

- M0–M6: campagne e diario/autosave, Codex UUID/backlink, relazioni con fonte e
  certezza, scheda estesa, inventario/incantesimi, FTS5, dashboard, immagini gestite
  incluse nei backup, export Markdown/JSON e originali Logseq immutabili.
- Tema pergamena/cuoio/ottone, grafo ordinato/organico con filtri e dettaglio;
  Party sulle pagine Codex; Wiki Open5e multi-fonte con cache offline.
- Assistente facoltativo, disattivato inizialmente: adapter Rust su loopback fisso,
  cloud disabilitato verificato, identità GGUF/digest, preflight GPU prima degli
  appunti. Nessun download, inferenza all'avvio, cloud fallback o tool del modello.
- Retrieval lessicale per sola campagna e regole cache scelte per edizione;
  estratti limitati con ID/blocco/revisione/hash. Fonti riapribili con avviso di
  modifica/mancanza; affermazioni dei PNG non promosse automaticamente a fatti.
- Streaming, cancellazione anche durante la risposta, bozze persistenti e recovery.
  Cronologia paginata, cancellazione confermata, backup/export di conversazioni
  e fonti; runtime/pesi esclusi. Nessuna scrittura implicita in note/grafo/scheda.
- Gate prudente esclude estratti con possibili istruzioni al modello. Se tutti
  sono sospetti ferma la richiesta e conserva le copie per revisione.
- Schema M7 **012 additivo**; vecchi backup migrati in copia, nuovi richiedono versione
  compatibile. Identificatori legacy it.nodex.desktop/nodex.sqlite3/.nodex mantenuti.

## Verifiche effettive M7

- `cargo test --offline --manifest-path src-tauri/Cargo.toml`: **63 PASS**.
- `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`:
  PASS. Build debug: PASS.
- `pnpm test`: **55 PASS / 19 file**; ultimi ritocchi verificati anche con i 3
  test mirati dell'assistente. Lint, typecheck, format:check: PASS.
- `pnpm package:desktop`: PASS, installer Windows NSIS non firmato. L'installazione
  M7 non è stata ripetuta; installazione/avvio/rimozione M6 erano stati verificati
  preservando due DB personali con SHA-256 identico.
- GPU reale: Ollama 0.40.10, Qwen3:4b-instruct Q4_K_M, contesto 8192, **3539 MiB
  interamente in VRAM** sulla RTX 4080 SUPER. Le prestazioni dipendono dal carico.
- Benchmark finale **40/40 esiti attesi**: 20 campagna, 10 regole originali di
  prova in conflitto fra edizioni, 5 assenze con inferenza GPU; 5 attacchi bloccati
  prima del modello. Dati canonici invariati. Non è accuratezza universale.
- Prove native: streaming, annullamento dopo token GPU con bozza non vuota,
  navigazione, blocco citato, rinomina, regole 2024, delete, backup/export: PASS.
- Ripristino e secondo riavvio senza Ollama: identiche **90 conversazioni/fonti/
  metriche, 25 pagine, un membro Party e configurazione**. Immagine originale
  inclusa nel backup/export. Nessuna campagna di prova nel profilo personale.
- Errori di protocollo nativi simulati: cloud attivo, modello mancante, CPU,
  OOM, stream incompleto/malformato/eccessivo, citazione inventata; nessun invio
  appunti nei primi quattro casi. Runtime realmente assente: errore conservato.
- Cloud disabilitato + proxy esterni non raggiungibili: inferenza reale riuscita;
  **80 campioni, 173 connessioni del runtime/esecutore, solo 127.0.0.1**.
  Non è una prova fisica offline o una verifica firewall. Nessun guasto GPU provocato.

## Campagna privata preesistente

Speratia M6: 84 sessioni, 209 pagine, 18 asset, 36 immagini, 207 Markdown originali.
Backup schema 009 verificato nella build 011 durante M6; UUID/checksum preservati.
Trascrizione Oran parziale; PF attuali illeggibili segnalati, da aggiornare.
Backup già consegnato: C:/Users/Joel/Downloads/Speratia_Chronexus_M6_2026-10-23.nodex
(52.321.017 byte), SHA-256
58a3e5fdc05670b46536c911eb92e5c83d7b8f86b5721c3c3adda5b893fd714c.
Ripristino sostituisce l'intero archivio con copia preventiva, non fonde campagne.
Archivi/foto/DB/profili/modelli restano fuori Git; nessun dato privato pubblicato.

## Commit M7

- e6f1763 feat(ai): integra inferenza GPU locale e conversazioni persistenti
- a89874e fix(ai): evita prove duplicate e recupera i ruoli del party
- d63ba16 fix(ai): restringe le fonti ai nomi presenti nella domanda
- cf39425 fix(ai): esclude istruzioni sospette prima dell inferenza
- 4ac9f7f feat(ai): aggiunge interfaccia assistente e avvio locale
- Guide e checkpoint finale: vedere l'ultimo commit Git.

## Avvio, Skill e limiti

Installer app M8 nella root: `installers/Chronexus-M8-Windows-x64/`.
Il precedente `Chronexus-0.1.0-Windows-x64/` contiene la distribuzione M7 e il
suo runtime Qwen; non è stato sovrascritto. Il nuovo installer app non incorpora
il checkpoint Google da 24 GB o l'ambiente QLoRA. Su questa macchina il backend
è già preparato; per altri computer seguire [AI_TRAINING.md](AI_TRAINING.md).

Avvio: `powershell -File scripts/Start-LocalAI.ps1`, poi il nuovo Chronexus
oppure `pnpm desktop` nell'ambiente Rust configurato. Campagna → Impostazioni
della campagna → Controlla Ollama → gemma4:12b → conferma multilingue → Attiva.
Riaddestra sui nuovi dati e Attiva adapter sono due azioni distinte.
Dettagli installer e limiti: [INSTALLERS.md](INSTALLERS.md).

Skill M8 letta/applicata: **vercel-react-best-practices**, per caricamento
condizionale, richieste locali indipendenti, progresso e recupero degli errori.
Non sono state applicate Skill AI/database assenti dal catalogo.

Skill M7 effettivamente letta/applicata: **vercel-react-best-practices**, per
caricamento differito, richieste indipendenti e aggiornamenti dello streaming.
Il tema esistente è mantenuto; nessuna nuova Skill AI/Rust/database disponibile
applicata. Ricerca Skill/design M6 già documentata in RESEARCH_DND.md.

Limiti: citazioni controllate strutturalmente, non verità semantica; modello
prolisso e non esperto D&D addestrato ad hoc; gate lessicale con possibili falsi
positivi/attacchi nuovi. Retrieval a estratti, non intera campagna o embeddings.
Wiki principalmente inglese/cache espellibile; un solo PG giocabile, Party in Codex;
bundle editor grande, backup manuali. Prossime verifiche: offline fisico M7 e
attività residue M6 macOS/Linux/CI e wizard Windows. Vedere ROADMAP.md.
