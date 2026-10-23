# Stato Nodex — 23 ottobre 2026

## Milestone

**M0–M4 completate. M5 non iniziata.**

Ultimo scenario: esportazione `.nodex` reale di due campagne, una sessione,
due pagine/alias, quattro menzioni, una relazione sospetta con fonte/blocco e
un'immagine PNG. Ripristino in profilo temporaneo distinto con campagna precedente,
conferma e copia preventiva. Dopo riavvio documenti, UUID, grafo, relazione/fonti
e hash immagine identici. Il ritorno alla copia preventiva è coperto dai test Rust.

## Funziona

- Campagne, diario BlockNote italiano/autosave, Codex, `[[` e backlink M0–M2.
- Grafo M3: menzioni e relazioni separate, direzione/certezza/fonti, filtri,
  vicinato 1–2, navigazione al blocco e alternativa testuale accessibile.
- Backup manuale dell'intero archivio: snapshot API SQLite (anche con WAL),
  ZIP/Deflate `.nodex` v1, manifest/checksum SHA-256, allegati gestiti, nessuna
  sovrascrittura. File finale pubblicato solo dopo nuova verifica dello ZIP.
- Ripristino: percorsi canonici, limiti di dimensione, controlli SQLite/schema/FK,
  anteprima e conferma. Copia preventiva prima dell'attivazione; vecchio profilo
  conservato. Un lock OS impedisce due processi sullo stesso archivio.
- Nuova generazione dati e puntatore atomico: nessun DB aperto copiato/rimosso.
  La copia dei payload inattivi tollera directory Windows occupate; hash verificati
  nuovamente. Schema SQL invariato, versione 004. Backup DB 1–4 supportati.
- UI italiana con ricevute/percorso recupero, errori, Tab/Escape e protezioni
  navigazione/chiusura. Aprire il backup attende il salvataggio degli appunti.

## Verifiche effettive M4

| Comando / prova | Esito |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | PASS |
| `pnpm test` | PASS, 23 test in 5 file |
| `pnpm peers check` | PASS, nessun conflitto |
| `cargo test --offline --manifest-path src-tauri/Cargo.toml` | PASS, 29 test |
| `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo build --offline --manifest-path src-tauri/Cargo.toml` | PASS, desktop debug |
| `pnpm build:desktop` (include `pnpm build`) | PASS, release Windows x64 senza installer |
| Avvio release, archivio letto, schermata backup e CSP | PASS; variabili di prova assenti dall'eseguibile |
| `scripts/backup-smoke.mjs`: seed/create/created/select/cancel/restore/verify | PASS, WebView/Tauri/SQLite/ZIP reali; scelta file predefinita nel debug |
| Riavvio finale su `.tools/m4-target-final` | PASS, documenti/grafo/relazione e SHA-256 PNG identici |
| Selettore nativo Windows | Apertura/lettura PASS; completamento input NON VERIFICATO, errore strumento computer-use |
| macOS/Linux, installer, rete/disco esterno e QA accessibilità estesa | NON ESEGUITI |

Test di regressione: inizialmente riprodotti errori Windows di sincronizzazione e
spostamento allegati, poi corretti. Il test `sqliteXunexpected` ha riprodotto un
filtro schema troppo permissivo, poi corretto. Errori TypeScript nei nuovi test
corretti prima della build finale. Nessun fallimento noto lasciato nelle suite.

Prove e dati sintetici in `.tools/`, esclusi da Git. La scelta file predefinita
richiede profilo debug esplicito ed è esclusa dalle build release. Procedure
ripetibili in `docs/QA.md`, istruzioni utente nel README. Nessun push remoto.

## Commit recenti

- `eecab02 feat(graph): aggiunge grafo navigabile e relazioni con fonti`
- `02f77cd feat(backup): protegge archivio con snapshot e ripristino validato`
- `c95a861 fix(backup): ripristina allegati con cartelle occupate su Windows`
- `8419bda fix(backup): rifiuta schema inatteso e nomi non portabili`
- Il commit UI M4 contiene questo checkpoint finale e lo smoke ripetibile.

## Limiti noti

1. Backup manuali non cifrati/firmati; 256 MiB/file, 512 MiB totali e 9998 allegati.
   Generazioni e copie preventive non eliminate automaticamente. Nessun gestore
   allegati UI ancora; i file esterni citati nelle note non sono inclusi.
2. DB corrente non apribile: recuperare su cartella dati vuota, conservando prima
   l'intera cartella danneggiata. Dopo un ripristino usare M4 o successive:
   eseguibili M0–M3 ignorano il puntatore della nuova generazione.
3. Backup pianificati ed export Markdown/JSON rinviati. Chiusura forzata può
   perdere modifiche non ancora salvate; nessun merge automatico.
4. Grafo limitato a 150 nodi/400 archi; chunk editor ~966 kB e canvas ~438 kB,
   caricati separatamente. Misure e ottimizzazioni estese previste in M6.
5. Supporto multipiattaforma implementato ma build/QA verificati solo Windows.
   Selettori nativi, rete e spazio insufficiente richiedono QA manuale ulteriore.

## Prossimo passo esatto

**M5 — Player character, inventory and spells**: personaggio generico senza regole
inventate, risorse, inventario con provenienza, capacità/incantesimi manuali e
interfaccia per adattatori futuri. Verifica: aggiungere una chiave ricevuta da
Varek nella Sessione 12, riavviare e navigare dall'oggetto al PNG e al blocco fonte.

Skill applicate: frontend-design (palette/gerarchia esistenti e screenshot),
vercel-react-best-practices (lazy loading e gestione React), computer-use
(osservazione selettore nativo; input non completati per errore dello strumento).
