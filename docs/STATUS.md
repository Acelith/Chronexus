# Stato Chronexus — 24 ottobre 2026

## Milestone e prossimo passo

M7 operativa e collaudata su Windows: assistente locale con fonti, GPU e cronologia.
**Accettazione completa ancora parziale**: manca la prova con rete fisicamente
scollegata/blocco firewall. La prova proxy e le connessioni loopback sono distinte.
Restano inoltre M6 macOS/Linux/CI reali e revisione del wizard Windows interattivo.
M8 operativa e collaudata su Windows: Gemma 4 12B locale, impostazioni per
campagna (013), QLoRA reale e adapter con backup/ripristino (014). Accettazione
sulle altre piattaforme e prova fisica offline/firewall ancora pendenti.
**Prossima milestone funzionale: M9 — Tiradadi interno e cerchio dei draghi.**
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
