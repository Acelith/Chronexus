# Decisioni

## Chronexus — rinomina compatibile

Nome pubblico, titolo finestra e pacchetti diventano Chronexus/chronexus.
`it.nodex.desktop`, `nodex.sqlite3`, percorso interno del bundle `.nodex` e
variabili debug `NODEX_*` restano stabili: cambiare questi identificatori
separerebbe gli utenti dai dati esistenti. Nessuna migrazione necessaria per il
solo cambio di nome. I backup M4 sono ancora leggibili.

## M5 — scheda generica e dati giocabili

- Migrazione 005 additiva: `characters` (un personaggio per campagna in questa
  fase) e `player_assets` (oggetti, incantesimi e capacità discriminati per tipo).
  UUID e revisioni proteggono aggiornamenti ed eliminazioni obsolete; FK composite
  impediscono riferimenti a personaggi, pagine e sessioni di altre campagne.
- La scheda JSON tipizzata conserva identità, sistema libero, PF, statistiche
  configurabili, condizioni e risorse/slot con ID stabili. I valori delle statistiche
  sono manuali; contatori interi da 0 al massimo esplicito, nessuna formula o riposo.
- Gli asset conservano dettagli tipizzati in JSON e provenienza in colonne con FK,
  senza copie sincronizzate delle stesse informazioni. Quantità zero non elimina
  l'oggetto; preparato/conosciuto sono marcatori indipendenti, senza consumo implicito.
- Provenienza sessione/blocco, PNG, luogo e missione; collegamento facoltativo a una
  pagina Codex. Un blocco rimosso viene segnalato ma il riferimento resta; un cambio
  successivo del tipo Codex non invalida il ruolo storico. Nessun arco fattuale è
  inferito da inventario o provenienza.
- Elenco migrazioni condiviso da apertura DB e validazione backup. I backup v1
  includono ora conteggi personaggi/oggetti/capacità quando non nulli, con default
  zero per manifest precedenti. DB 1–5 leggibili; schema 5 richiede Chronexus M5
  o successivo per il recupero. Validazione M5 eseguita prima di pubblicare backup.
- Tre viste React caricate su richiesta: Personaggio, Inventario, Capacità.
  Moduli espliciti con guardie, contatori e marcatori con salvataggio immediato,
  dettaglio della voce e ritorno contestuale dal Codex o dal diario.
- Contratto locale `RulesetAdapter` con derivazione pura separata dai valori
  manuali. Solo l'adattatore generico è disponibile; identificatori sconosciuti
  hanno lo stesso comportamento manuale. Nessun regolamento commerciale scelto.
  Dettagli in `docs/RULESETS.md`. Nessuna nuova dipendenza.
- Palette esistente #101623/#161c28/#465268, testo #e7e8ed/#a9b4c7 e ottone
  #d7b978; Georgia per titoli, Segoe UI per dati/controlli. Scheda leggibile,
  contatori rapidi e dettaglio con provenienza prioritari rispetto a decorazioni.
  Screenshot verificati a 1200 px, tre viste senza overflow a 760 px.
- Helper delle anteprime blocco condiviso con il grafo in `knowledge/blocks.ts`,
  senza dipendenze inverse sul canvas. Skill frontend-design e
  vercel-react-best-practices applicate a gerarchia, caricamento differito e
  stato derivato. QA desktop con Playwright, bridge Tauri e SQLite reali.

## M3 — Relazioni dichiarate e grafo

- Migrazione 004 additiva: relazioni direzionali separate dalle menzioni,
  certezza esplicita, evidenza/note e fonte opzionale sessione/pagina/blocco.
  Revisioni ottimistiche proteggono modifica ed eliminazione concorrenti.
- I nodi includono pagine, sessioni e destinazioni mancanti. Una co-menzione
  non genera mai un arco pagina→pagina; le menzioni mantengono la sorgente reale.
- Confini di campagna validati e FK composite. Un blocco di fonte rimosso non
  cancella la relazione: la fonte viene marcata non disponibile, evidenza conservata.
- Vista inviata al client limitata a 150 nodi e 400 archi, con conteggi e avviso
  di troncamento; metadati filtrati nel backend senza caricare i documenti nel grafo.
- Profondità 1/2 sul vicinato non direzionale; frecce conservano la direzione.
  Filtri tipo/ricerca rimuovono i nodi e i relativi archi; certezza riguarda solo
  le relazioni dichiarate. Filtro sessione usa la fonte delle menzioni/relazioni.
- Cytoscape.js 3.34.4, MIT, con tipi TypeScript inclusi, caricato solo nella vista
  grafo. Nessuna estensione o servizio remoto. [API e stile](https://js.cytoscape.org/).
- Disposizione iniziale circolare deterministica, senza animazioni, nodi spostabili
  e controlli zoom/adatta. La disposizione è una vista temporanea, non una relazione
  semantica né un dato canonico. Legenda, forme e testo evitano significati affidati
  soltanto al colore; elenco accessibile alternativo con gli stessi nodi/archi.
- Conferma esplicita e revisione corrente per eliminare una relazione; la conferma
  gestisce Tab/Escape. Un form di relazione aperto blocca navigazione/chiusura,
  senza simulare autosave su un'affermazione incompleta.
- La CSP di sviluppo consente HTTP/WebSocket solo sul server locale Vite alla
  porta 1420 per il refresh. La CSP release mantiene i collegamenti runtime locali
  di Tauri e nessun accesso a servizi remoti.
- Skill riutilizzate: frontend-design (layout, leggibilità e revisione screenshot),
  vercel-react-best-practices (caricamento differito e ciclo di vita del canvas).

## M2 — Pagine e menzioni esplicite

- Migrazione 003 additiva: pagine Codex tipizzate, alias e indice delle menzioni.
  Le sessioni M1 e i loro documenti rimangono intatti.
- Il documento JSON contiene inline `pageMention` con `pageId` UUID e `label`
  di ripiego. Il nome corrente si risolve per ID; rinominare conserva il vecchio
  titolo come alias. Gli alias possono essere ambigui e richiedono scelta esplicita.
- Scrittura del documento e sostituzione dell'indice avvengono nella stessa
  transazione. Un record per sorgente/blocco/destinazione, anche per blocchi annidati.
- I confini delle sorgenti sono vincolati da FK composite; ogni destinazione
  esistente viene verificata dal backend. Le destinazioni assenti conservano
  l'ID nell'indice per un recupero esplicito come bozza, senza creare duplicati.
- Solo inline espliciti generano menzioni. Testo `[[...]]` non risolto e semplici
  co-occorrenze non generano collegamenti né relazioni fattuali.
- Nessuna nuova dipendenza. Skill React/design già lette riutilizzate per la UI;
  livello Rust/SQLite implementato e verificato con strumenti ordinari.
- L'editor condiviso tra sessioni e pagine usa l'inline custom BlockNote e il
  menu `[[` (nessuna scansione automatica dei nomi nel testo). In caso di creazione
  fallita ripristina il testo digitato; navigazione/chiusura attendono anche la
  creazione in corso. Durante i cambi vista asincroni il documento è in sola lettura.
- La menzione mostra il titolo corrente dal Codex della campagna, mantenendo
  nel documento il label originale di ripiego. Il preview dei backlink è un
  estratto della fonte, quindi può ancora riportare il nome usato all'epoca.
- L'apertura di un backlink riposiziona il cursore e scorre al blocco per ID;
  l'evidenziazione CSS non altera il DOM canonico gestito da ProseMirror.
- API di riferimento: [inline custom BlockNote](https://www.blocknotejs.org/docs/features/custom-schemas/custom-inline-content)
  e [menu suggerimenti](https://www.blocknotejs.org/docs/react/components/suggestion-menus).

## 2026-10-23 — Fondazione M0

- Rust possiede una connessione SQLite protetta da mutex, aperta nella directory
  dati Tauri; React comunica tramite comandi stretti. Nessun plugin SQL/FS nel frontend.
- SQLite incorporato tramite rusqlite (`bundled`, MIT), per comportamento coerente
  senza installazione SQLite esterna. FK attive e timeout dei lock di 5 secondi.
- Migrazioni additive e transazionali con `schema_migrations`. Non viene offerto
  un downgrade automatico distruttivo; rollback mediante versione precedente e
  snapshot a programma chiuso finché M4 non introduce backup consistenti.
- Vite/React/TypeScript; TypeScript 6 perché typescript-eslint non supporta 7.
  Dipendenze fissate nei lockfile. Tauri MIT/Apache-2.0, React/Vite MIT.
- Design: ardesia #161c28, inchiostro #101623, bordo #303a4b, testo #e7e8ed,
  testo secondario #a9b4c7, ottone #d7b978. Georgia per titoli, Segoe UI/system
  per comandi. Sidebar archivio a sinistra, diario al centro; nessun dato fittizio.
- Skill lette e applicate: frontend-design (palette, tipografia e struttura),
  vercel-react-best-practices (stato derivato e caricamento differito editor).

## 2026-10-23 — Persistenza M1

- Migrazione 002 aggiunge campagne/sessioni con UUID, vincoli, indice cronologico
  per numero e documento JSON canonico versionato. Nessuna copia Markdown modificabile.
- Ogni comando di sessione riceve la campagna e ne verifica i confini nel backend.
- Revisioni ottimistiche impediscono sovrascritture da finestre/app concorrenti:
  un conflitto blocca il salvataggio e invita a copiare gli appunti.
- Documenti limitati a 2 MB, 10.000 blocchi e profondità 12; solo paragrafi,
  titoli, elenchi e citazioni. Media e upload fuori scope.
- Errori di apertura DB tornano al frontend: la finestra rimane disponibile
  anche con directory non accessibile o schema più recente.

## 2026-10-23 — Editor e autosave M1

- BlockNote 0.56 e Mantine 8.3.11: peer React 19 compatibili, verifica
  `pnpm peers check` senza problemi. BlockNote MPL-2.0, Mantine MIT.
- Schema ridotto ai blocchi testuali supportati; nessun upload, blocco media
  o emoji picker con risorse esterne. Editor caricato solo aprendo una sessione.
- Un writer ordinato per documento, debounce 500 ms e revisioni ricevute dal
  backend. Il flush attende anche le modifiche arrivate durante una scrittura.
- Navigazione e chiusura normale attendono il flush; errore visibile con riprova,
  nessun cambio nota in caso di fallimento. Chiusura forzata non garantita.
- Nessun pulsante di cancellazione/archiviazione in M1; non serve confermare
  operazioni distruttive inesistenti. Archivio e selezione dei record sono reali.
- `NODEX_DEV_DATA_DIR` solo debug consente smoke test isolati senza dati personali.
  Lo smoke Playwright dialoga con Tauri/Rust/SQLite reali tramite WebView2.
- Skill applicate: frontend-design (revisione visiva, palette e gerarchia),
  vercel-react-best-practices (lazy loading e stato derivato). computer-use letta
  per QA nativa; accesso finestra scaduto, prova effettiva tramite WebView locale.

## M4 — backup portabile e attivazione del ripristino

- Il bundle `.nodex` v1 salva **tutte le campagne**: snapshot tramite API backup
  SQLite, `manifest.json`, SHA-256 di ogni payload e allegati gestiti. Nessuna
  copia del DB aperto. ZIP/Deflate non cifrato; checksum per integrità, non firma.
- Percorsi ammessi: `data/nodex.sqlite3` e
  `attachments/<UUID campagna>/<UUID file>[.<estensione minuscola>]`. Nessuna
  directory ZIP, duplicato, link simbolico o file extra. Limiti: 9998 allegati,
  256 MiB/file, 512 MiB totali/ZIP e 2 MiB manifest. File mai sovrascritti.
- Il ripristino verifica checksum, schema esatto delle migrazioni supportate,
  integrity_check, foreign_key_check, documenti e confini delle campagne. Le
  versioni DB 1–4 sono ammesse e migrate solo nella nuova copia; future respinte.
- Prima dell'attivazione crea un `.nodex` preventivo in `backups/`; un errore
  interrompe l'operazione. La nuova generazione è in `profiles/<UUID>/` e diventa
  attiva tramite sostituzione atomica di `active-profile.json`. Il vecchio DB
  resta intatto; senza puntatore gli archivi M0–M3 continuano nella cartella base.
  Un lock OS esclusivo impedisce due processi sullo stesso archivio. I file sono
  sincronizzati prima dell'attivazione, le directory anche su Unix. Un errore
  di sincronizzazione successivo al commit è restituito come avviso esplicito.
- Il backend sceglie i percorsi con tauri-plugin-dialog 2.8.3 (MIT/Apache-2.0,
  Rust minimo 1.90); ZIP 9.0.5 (MIT), SHA2 0.10.9 e tempfile 3 (MIT/Apache-2.0).
  Nessuna autorizzazione filesystem generale al frontend. Le operazioni pesanti
  e i dialoghi bloccanti sono eseguiti fuori dal thread UI.
- Non si aggiunge ancora un gestore allegati: M4 conserva i file già presenti
  nel layout gestito, verificato con fixture nei test. Esportazione Markdown/JSON
  e backup pianificati sono rinviati: M4 dà priorità al recupero manuale.
- La copia dei payload inattivi, invece dello spostamento della cartella estratta,
  tollera handle di directory Windows senza condivisione DELETE; ogni copia è
  ricontrollata con SHA-256 prima di attivarla. Un test Windows riproduce il caso.
- Il confronto schema comprende ogni oggetto con SQL dichiarato: non usa `LIKE`
  sui nomi SQLite, perché il carattere `_` potrebbe nascondere trigger inattesi.
  Nomi di allegati con punto finale o estensione vuota sono respinti per evitare
  alias differenti fra Windows e Unix.
- `NODEX_DEV_BACKUP_FILE` / `NODEX_DEV_RESTORE_FILE` predefiniscono solo il risultato
  del selettore per QA ripetibile, richiedono `NODEX_DEV_DATA_DIR` esplicita e
  percorsi assoluti. L'intero ramo è escluso dalle build release. Nessun comando
  accetta percorsi filesystem da React.
- Skill UI: frontend-design per gerarchia/palette esistenti e verifica screenshot;
  vercel-react-best-practices per caricamento differito. computer-use ha aperto e
  letto il selettore nativo; successivi input bloccati dallo strumento, quindi
  il round trip desktop usa la scelta predefinita nel debug, con ZIP/DB reali.

## Scheda estesa e catalogo opzionale (23 ottobre 2026)

- La richiesta di modificare M4 riguarda la scheda consegnata in M5. M4 mantiene
  il recupero dati; l'estensione appartiene a M5, prima di M6.
- Il PDF dell'utente è solo una fonte di campi e gerarchia. Nessuna copia di logo,
  impaginazione o contenuti personali viene inserita nel repository. La scheda
  resta generica, con campi manuali per combattimento, biografia, valori e magia;
  un preset D&D aggiunge etichette, senza formule o valori inventati.
- Migrazione 006 additiva: cache SQLite e confine di compatibilità per i nuovi
  payload. I campi JSON aggiunti hanno default per leggere schede M5; UUID,
  revisioni e fonti restano stabili. I backup precedenti restano ripristinabili;
  una build precedente non deve aprire lo schema 006.
- Eccezione di rete autorizzata: solo GET espliciti verso D&D 5e API, edizione
  2014. Fetch frontend limitato all'host nella CSP; percorsi allowlist, timeout,
  dimensioni limitate e nessun redirect. Ricerca per nome eseguita sugli indici
  scaricati, senza inviare il testo digitato. Nessuna nuova dipendenza HTTP.
- Cache Rust parametrizzata, massimo 150 risposte; un'importazione è una copia
  personale indipendente con riferimento alla fonte, conservata nel backup.
  Il catalogo non scrive nel grafo e non rende fatti le descrizioni di regole.
  API di sola lettura: gli incantesimi personalizzati non vengono pubblicati.
- Skill: PDF per estrazione e lettura visiva delle quattro pagine; frontend-design
  e vercel-react-best-practices per interfaccia e caricamento del catalogo.

## Ricerca e immagini M6

- Migrazione 007: righe di ricerca derivate dai documenti canonici e FTS5
  external-content con trigger. Aggiornamenti nella transazione della nota/asset;
  ricostruzione su migrazione e nella copia ripristinata, prima dell'attivazione.
  Testo utente quotato, niente sintassi FTS/SQL arbitraria; risultati della sola
  campagna selezionata con UUID e blocco fonte. Nessun servizio remoto.
- Migrazione 008: proprietà immagini con FK composite per campagna/voce e file
  UUID nel layout allegati M4. PNG/JPEG/WebP validati con image 0.25.10
  (MIT/Apache-2.0, Rust >=1.88; toolchain locale 1.99) e base64 0.22.1
  (MIT/Apache-2.0). Originali copiati senza ricompressione o perdita EXIF.
- Limiti 20 MiB, 8192 px/lato, 32 milioni di pixel e memoria decoder limitata;
  orientamento applicato solo alle anteprime. Lettura via IPC con ID, nessun
  percorso esterno/HTML/SVG eseguibile o permesso filesystem generale al frontend.
- Anteprime differite quando visibili; zoom dell'originale nel visualizzatore.
  OperationContext riusa il flush editor e la guardia app per le mutazioni immagini.
- File temporanei fuori dalla cartella allegati per non compromettere un backup
  dopo un arresto improvviso. Pubblicazione con nuovo UUID senza sovrascritture;
  metadati e SHA-256 verificati in backup/ripristino. Rimozione dalla voce o
  eliminazione dell'asset scollega i metadati e conserva il file per recupero.
  Pulizia fisica degli orfani rinviata e dichiarata nell'interfaccia.
- Skill frontend-design e vercel-react-best-practices per gerarchia, tastiera,
  caricamento differito e lettura visiva; nessuna Skill DB/testing disponibile.

## Export e sorgenti Logseq M6

- Export ZIP con snapshot SQLite coerente, Markdown per UUID, JSON canonico,
  immagini originali e manifest; nessuna nuova dipendenza e nessun reimport MVP.
- Migrazione 009 additiva: sorgenti originali immutabili con FK composite e
  checksum. Il marker `importedFrom` sopravvive all’autosave; la copia originale
  è indipendente dal documento modificabile e viene verificata nel backup.
- Conversione tramite IPC in profilo debug vuoto: sessioni nel Diario e pagine
  indice nel Codex per preservare i vecchi riferimenti. Nessuna relazione
  fattuale inferita, alias conflittuali mantenuti nel testo, nessun dato privato
  versionato. Foto originali incluse; trascrizione parziale dichiarata.
- Riepilogo e nuove viste caricati su richiesta. Installer NSIS Windows generato,
  CI Windows/macOS/Linux predisposta; firma e QA installazione restano pendenti.
- Skill frontend-design per gerarchia e leggibilità; vercel-react-best-practices
  per composizione e caricamento differito. Nessuna Skill database/testing
  specializzata disponibile: test Rust, frontend e WebView reali.

## Restyling e grafo — estensione richiesta a M6

Direzione: codice medievale leggibile, pergamena #e6d8b8, inchiostro #30251d,
cuoio #211a16, ottone #b99855, borgogna #6e302b e verde #354c3a. Cornice
scura, area di lettura chiara, titoli Palatino/Georgia locali; nessun font remoto.
Navigazione e semantica dei dati conservate. Riferimento visuale generato con
dati fittizi in .tools/medieval-ui-target.png (1584x992), non asset dell'app.
L'implementazione adatta proporzioni e controlli reali: nessuna pretesa pixel-perfect.
Grafo con layout COSE integrato, sottoinsieme compatto di 18 nodi, espansione
esplicita e dettaglio alla selezione; etichette degli archi solo in evidenza.
Il sottoinsieme contiene esclusivamente nodi e archi esistenti, senza nuove
relazioni inferite. Filtri in disclosure, elenco accessibile conservato.
Skill: find-skills per ricerca CLI/catalogo, frontend-design e ui-taste per
materiali/gerarchia e confronto visuale; imagegen per il solo riferimento fittizio.
webapp-testing Anthropic consultata e valutata; automazione Tauri resta quella
Playwright JS già in uso nel repository, senza installazioni globali.

## Party — estensione M6

Migrazione 010 additiva: elenco membri per UUID pagina, giocatore/ruolo liberi,
stato e revisione per conflitti. Le conoscenze restano nel documento Codex,
con menzioni, ricerca, immagini e autosave esistenti; nessuna scheda completa
duplicata e nessuna relazione fattuale creata dall'appartenenza al party.
La creazione del nuovo personaggio e della membership è atomica. Rimozione
confermata scollega soltanto la membership, conservando pagina e immagini.
Backup/ripristino include il party; export JSON e indice Markdown lo espongono.
Il cambiamento del tipo pagina conserva la membership storica.
Skill frontend-design per registro della compagnia e vercel-react-best-practices
per vista/editor caricati su richiesta; test Rust e frontend per persistenza,
conflitti, guardie e recupero degli errori.

## Wiki Open5e M6

Migrazione 011 additiva per cache wiki separata dal catalogo SRD 2014 personale.
La ricerca pubblica paginata di Open5e non sostituisce gli asset locali e non
crea fatti nel grafo. Testi e metadati di fonte conservati insieme; ogni voce
resta distinta per documento/edizione. Limiti HTTP e cache applicati, refresh
fallito mantiene la copia locale con avviso. CSP limitata al nuovo host approvato.
Prove native: voce SRD reale, cache offline dopo riavvio, backup/restore e
secondo riavvio con membro Party, appunti e immagine identici. Skill e fonti
verificate in docs/RESEARCH_DND.md; nessuna dipendenza runtime aggiunta.


Controllo visuale finale M6: il layout organico può comprimere i nomi nelle
zone dense di Speratia. La vista iniziale usa quindi una mappa ordinata con
spazio calcolato anche per le etichette; il layout COSE rimane selezionabile.
Nessuna relazione è dedotta dalla posizione spaziale. Riordinate solo le
coordinate del canvas, non i dati o la membership.

## M7 — inferenza locale e scelta del modello

Ollama portable isolato nel percorso ignorato `.tools/m7-runtime`, senza
installazione di sistema. Adapter HTTP Rust fisso su 127.0.0.1:11434, senza
proxy/redirect, verifica `/api/status` cloud disabilitato prima di ogni richiesta,
digest manifest e pesi GGUF locali. Precaricamento senza appunti e verifica GPU;
CPU esclusiva bloccata, caricamento misto dichiarato. Nessun tool del modello.

Il candidato dnd-unified-1.5b Q4_K_M è stato realmente caricato interamente su
GPU ma fallisce le prime domande italiane. L'utente ha esplicitamente scelto
un modello multilingue più capace con fonti D&D locali e citazioni.
Qwen3:4b-instruct Q4_K_M produce risposte dirette; Qwen3:4b standard esponeva
ragionamento nel contenuto e non è il modello qualificato. Le licenze dei
modelli sono dichiarate dagli autori; pesi non redistribuiti nel repository.

Retrieval FTS5 per sola campagna e fonti regole selezionate per edizione;
copie con ID/blocco/revisione/hash, limite di contesto conservativo. Cronologia
non usata come nuova fonte. Migrazione 012 additiva, configurazione disattivata
inizialmente, conversazioni cancellabili/esportabili/backuppate; pesi esclusi.
Le citazioni verificano appartenenza e versione, non la verità semantica.
Skill vercel-react-best-practices per caricamento differito e letture indipendenti.

La valutazione reale ha mostrato che le istruzioni del solo prompt non bastano:
il modello può ripetere un attacco o citare identificativi non forniti. Un gate
lessicale prudente esclude prima dell'invio estratti con segnali espliciti di
manipolazione, conservando le altre fonti pulite. Se tutte sono sospette, ferma
la domanda e ne conserva le copie per revisione. Metriche tracciano esclusioni
e possibile invio. Non è una classificazione infallibile; possibili falsi positivi.
Nessun tool del modello, nessuna scrittura implicita nel mondo di gioco.


## M8 — Adapter di campagna e copie GGUF derivate

- Impostazioni AI per campagna (013), senza mutare le preferenze delle altre
  campagne; migrazione conserva le scelte M7 già esplicite.
- QLoRA locale su checkpoint Google Gemma 4 12B fissato, distinto dal retrieval.
  Ricostruzione da snapshot corrente per evitare accumulo di note eliminate.
- Ollama 0.40.10 non supporta più ADAPTER. Il worker applica l'adapter compatto
  a copie GGUF, preservando i tensori non modificati e la base immutabile.
  Gli adapter e la provenienza sono dati della campagna e vanno nei backup;
  le copie di inferenza sono ricostruibili e restano fuori dagli archivi.
- Nessuna attivazione implicita: validazione sintetica GPU/citazioni, selezione
  esplicita e invalidazione se cambiano fonti o policy. Pesi aggiornati e loss
  non dimostrano da soli una maggiore accuratezza delle risposte.
- Backend Python isolato, non server aggiuntivo: worker distribuito con l'app,
  caricamento offline senza remote code, annullamento e uscita se muore il parent.
  Stato ed evidenze: docs/AI_TRAINING.md e docs/STATUS.md.


## M10 — localizzazione senza mutazioni dei dati

Preferenze globali JSON atomiche v1 fuori dalle generazioni backup; nessuna
migrazione SQLite. Cataloghi locali con hash della sorgente italiana, fallback,
parametri e dizionari editor; nessun modello AI o rete necessario per cambiare
lingua. Nomi/preset salvati, UUID, Markdown e fonti non passano al traduttore.
Le lingue di fantasia rimangono lessici parziali dichiarati: non inventare una
traduzione integrale. Braille/Morse/SGA separati dalla lingua, originali semantici
e pacchetto reversibile. Varianti/font/fonti/limiti e prove: I18N.md.

## M11–M13 — scritture versionate e pacchetti offline

Le nuove scritture usano font originali OFL e codici ASCII legati alla revisione
esplicita del font, non un alfabeto Unicode inventato. Preferenze v2 con upgrade
conservativo v1 e pacchetti reversibili v2 per Espruar/Dethek; SQLite invariato.

Gli estremi dei dadi sono una classificazione pura del risultato già persistito.
Il replay rimonta la sola scena; non richiama RNG o salvataggio. Due attori SVG
locali mantengono controllo su direzione, fiamme e movimento ridotto.

Forgejo 12.0.4 dell'origin consente ZIP fino a 2048 MiB: cinque archivi validi,
non estensioni ZIP applicate a dati grezzi. Distribuire soltanto la closure GGUF
ufficiale Windows del modello base Gemma 4 12B; escludere la variante opzionale
MLX e qualsiasi dato/adattatore privato. Installazione in staging nuovo, verifica
completa e spostamento finale; nessuna sovrascrittura di destinazioni diverse.
Pubblicazione in bozza e checksum verificati via download prima di renderla finale.

## 2026-10-25 — M14: external automation over the running app

Use an opt-in authenticated loopback bridge and a dependency-free Node MCP stdio
adapter. The bridge is deliberately private, not MCP HTTP. This avoids a second
SQLite connection/root lock and keeps restores atomic through the existing
Arc<Mutex<Store>>. Use fixed domain tools and campaign-scoped writes. Revision
checks protect documents/player data; full-page etags protect metadata whose
updates do not increment document revision. GUI metadata forms also compare the
snapshot they opened, preserving drafts after an external update. Dirty editors
postpone refresh. The built-in assistant has no bridge tools. Discovery lives
outside backup generations; shutdown stops the thread explicitly to release its
AppHandle callback and removes the current credential. SQLite remains 015.

## 2026-10-25 — M15: signed updater and pre-install snapshot

Use Tauri updater 2.14 with authenticated version comments; fetch manifests and
packages through our bounded Rust HTTPS reader so redirects, sizes and anonymous
access stay explicit. Resolve Forgejo via its latest-release API and unique
latest.json attachment, not GitHub-only download aliases. Custom static manifests
are allowed on the same HTTPS origin as their artifacts. No automatic startup
request. Store update settings beside profile metadata, outside SQLite (015).

Create a real verified .nodex and hash/preferences receipt before each installer
handoff. Hold the active Store through snapshot/handoff; try_lock the AI slot in
Store -> AI order to avoid inversion with existing services. The external bridge
cannot issue updater commands. Preserve all safety copies. Windows uses passive
NSIS and closes without automatically restoring automation launch arguments.

MSVC integration tests that instantiate Tauri's mock builder need a separate
common-controls v6 manifest for TaskDialogIndirect. Add linker arguments only to
integration test targets; the app already embeds its own manifest. This fixes the
loader failure without changing system DLLs or duplicating app resources.


## 2026-10-25 — Registro cronologico e M16 pianificata

Conservare gli ID storici M0–M15, già usati nei commit e nelle guide. Le estensioni
fuori roadmap ricevono suffissi retrospettivi a/b/c/d e sono collocate nel loro
punto reale di consegna; l’ordine è esplicito nella tabella, inclusa M11 dopo
M12/M13. Non riscrivere tag/storia, spostare funzionalità già consegnate nel backlog
o segnare come concluse le accettazioni ancora aperte.

Il selettore Wiki richiesto appartiene alla nuova M16 insieme allo scraping:
Wikidot predefinito in futuro, Open5e alternativa esplicita, catalogo SRD distinto.
La richiesta è di pianificazione: non cambiare prima la preferenza dell’app senza
un provider Wikidot funzionante. La release attuale resta Open5e. Requisiti e
criteri di accettazione in ROADMAP M16; nessun adapter, migrazione o UI aggiunti ora.


## 2026-10-25 — M15a: araldo come presentazione del flusso M15

- La politica (quando controllare, quando annunciare) è Rust puro e testato; il
  controllo riusa la funzione M15 rifattorizzata, quindi firme, versioni stabili e
  same-origin restano identici. Un fallimento automatico non mostra nulla.
- Limiti: un controllo per sessione (AtomicBool) e al massimo ogni 20 ore,
  registrato solo dopo un controllo riuscito; orologio all’indietro non blocca.
  Rinvio di 3 giorni e «ignora» sono per versione: una più recente si annuncia.
- File `update-announcements.json` separato: aggiungere campi a
  `update-settings.json` (deny_unknown_fields) avrebbe rotto la lettura M15.
- Il popup non installa: «Aggiorna» porta alle impostazioni e avvia il download
  verificato; il backup obbligatorio resta legato al pulsante d’installazione.
- Attesa di un’app inattiva lato frontend (guardie, dialoghi, campi di testo) più
  un comando locale per AI/addestramento/aggiornamento in corso. Un `<select>` con
  focus non conta come scrittura (bug trovato nel collaudo desktop).
- Fanfara Web Audio invece di un file: nessuna licenza o asset audio, volume
  basso, nessun nuovo tentativo se l’autoplay è bloccato.
- Nessuna figura SVG disegnata a mano (craft-floor di impeccable): emblema
  geometrico finché l’utente non fornisce le illustrazioni raster.

## 2026-10-25 — M16 implementata: adapter Wikidot, cache separata, epoch

- L’utente ha chiesto di eseguire M16: precede M15a, che resta pianificata.
- HTML Wikidot letto dal backend Rust, non dalla WebView: nessun nuovo host nella
  CSP, controllo di redirect/dimensioni/tempi e nessun cookie. `scraper` 0.29 (ISC,
  html5ever MIT/Apache, cssparser/selectors MPL-2.0 non modificati) senza feature
  predefinite. Il risultato salvato è testo strutturato, mai l’HTML originale.
- Si scarica l’indice della categoria e si filtra localmente: il termine digitato
  non lascia il dispositivo. Una richiesta alla volta, ≥1,5 s fra le richieste,
  nessun retry automatico (403/429 riportati come limitazione del sito).
- Tabella `wikidot_cache` (migrazione 016) separata da `wiki_cache` Open5e, così
  ogni fonte si svuota da sola senza mescolare chiavi o eviction. Backup schema 016
  non apribili dalle versioni precedenti (stesso criterio delle migrazioni passate).
- Preferenza `wiki-preferences.json` separata da `interface-preferences.json`: un
  campo nuovo nel file v2 avrebbe fatto ricadere i client 0.4.0 nel recupero
  italiano. File assente = Wikidot non esplicito; la ricevuta pre-aggiornamento
  lo include. Il ripristino non tocca la cartella radice.
- Epoch atomico della cache: ogni svuotamento lo incrementa e annulla le richieste
  Wikidot; le scritture (anche Open5e dal frontend) che portano un epoch vecchio sono
  rifiutate dentro il lock del database, quindi nulla ricompare dopo lo svuotamento.
- `catalogSource.provider` opzionale e omesso per SRD: le voci esistenti mantengono
  lo stesso JSON. Le chiavi AI `wikidot/<pagina>` usano edizione 5e-2014.
- Cambio fonte: dialogo con focus sull’azione, Escape = rifiuto; solo l’accettazione
  salva Open5e e ripete una volta la ricerca; un errore Open5e non riapre proposte.

## 2026-10-25 — M15a prima di M16; cache eliminabile e cambio fonte su consenso

Inserire M15a tra l’updater consegnato M15 e lo scraping pianificato M16, senza
rinumerare Wikidot o gli ID storici. Il vassallo con trombetta e manifesto è una
presentazione del flusso M15: non sostituisce firme, conferma utente o backup.
Il controllo all’avvio è una futura estensione disattivabile dell’updater, non
autorizzazione a richieste automatiche per wiki/AI o una funzione già implementata.

La cancellazione cache M16 riguarda solo dati derivati della fonte, non copie
salvate, note/immagini di campagna, preferenze o backup. Invalidare richieste
pendenti evita che i dati appena eliminati ricompaiano senza una nuova richiesta.
L’insuccesso Wikidot deve proporre un cambio fonte esplicito: consenso necessario
prima di consultare Open5e; scelta persistente e visibile, nessun fallback silenzioso.
Entrambe le modifiche restano di pianificazione; codice e versione invariati.

## 25 ottobre 2026 — Traduzioni wiki derivate e locali (M17)

La traduzione usa il Qwen3 4b-instruct già approvato, senza contesto o adapter
di campagna, con prima inferenza esplicita e originale conservato. Una tabella
separata nello Store (017) lega la bozza al provider, alla lingua e all’hash del
contenuto con provenienza: non rende la traduzione una fonte canonica e permette
backup, invalidazione e svuotamento senza riscrivere gli originali. Il blocco AI
condiviso impedisce concorrenza con assistente, training e installazione updater.
La sostituzione del modello appartiene alla qualifica M18.
