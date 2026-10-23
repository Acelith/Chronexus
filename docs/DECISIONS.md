# Decisioni

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
