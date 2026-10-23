# Verifiche M0–M5

## Suite automatizzate

- `pnpm test`: schermate (creazione/rinomina, sessione, errori, navigazione
  bloccata) e autosave (debounce, concorrenza, flush, errore e riprova).
  I test UI isolati sostituiscono il bridge con un mock; gli smoke desktop usano
  persistenza reale. M4 aggiunge form backup, conferme, errori e guardie autosave.
- `pnpm test:rust`: database reale in file temporanei, due paragrafi identici
  dopo riapertura, ordine numerico, rinomina stabile, campagne separate,
  validazione, scrittura fallita, revisione obsoleta e migrazioni.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` e
  `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.
- `pnpm build:desktop`: eseguibile release senza installer.

## Prova desktop reale su Windows

Eseguita tramite Playwright collegato alla WebView2 di Chronexus: nessun mock di
comandi o database. Il profilo di prova rimane in `.tools/`, escluso da Git.
La variabile di profilo è disponibile **solo nelle build debug**, viene ignorata
nelle release. La porta d'ispezione è una configurazione esplicita di test;
non impostarla nell'uso quotidiano.

1. Predisporre una cartella di profilo nuova e assoluta, senza dati personali.
2. Avviare `pnpm dev` in un terminale (porta 1420).
3. In un altro terminale PowerShell, con Rust disponibile:

```powershell
cargo build --manifest-path src-tauri/Cargo.toml
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/smoke-profile"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/desktop-smoke.mjs prepare
```

`prepare` richiede un database vuoto e crea una campagna, la rinomina, aggiunge
le sessioni 12 e 2, scrive due paragrafi e confronta il JSON reale in SQLite.
Poi aggiunge una battuta e richiede subito la chiusura della finestra per provare
il flush delle modifiche pendenti.

4. Attendere che la finestra si chiuda, riavviare lo stesso eseguibile con lo
   stesso profilo e poi eseguire:

```powershell
node scripts/desktop-smoke.mjs verify
```

`verify` controlla uguaglianza del documento (ID dei blocchi inclusi), ordine,
ultima battuta, testo visibile e formattazione grassetto/titolo/elenco in una
seconda sessione. Le immagini di controllo vengono salvate sotto `.tools/`.
Il test non elimina dati: per ripetere da zero usare un altro profilo nuovo.

## Controlli manuali complementari

- Navigare con Tab; verificare focus visibile, campi con etichette e invio dei form.
- Provare una finestra stretta, note lunghe, accenti e nomi di 200 caratteri.
- Due istanze sulla stessa sessione: la seconda scrittura obsoleta deve essere
  fermata; copiare gli appunti prima di riaprire. Non è previsto un merge in M1.
- Non terminare forzatamente il processo per simulare la chiusura normale.

## Smoke M2 — Codex, collegamenti e backlink

Richiede la stessa build debug, server Vite e porta WebView2 del test M1.
Usare un **nuovo** profilo vuoto, ad esempio:

```powershell
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m2-nuova-prova"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/knowledge-smoke.mjs prepare
```

La fase `prepare` usa UI e comandi reali per verificare:

- Sessione 12 → `[[Varek` → creazione bozza → apertura pagina e backlink.
- Rinomina in «Varek il grigio», tipo/stato/alias e UUID conservato.
- Ritorno dal backlink al blocco sorgente con evidenziazione, poi menzione
  pagina→pagina verso «Gilda» e backlink dalla pagina.
- Alias «Custode» condiviso da due pagine: scelta esplicita, nessun duplicato.
- Un secondo writer crea un nome prima della conferma del menu: errore reale
  di duplicato e testo `[[Contesa]]` conservato nell'editor e salvato.
- Riferimento mancante inserito tramite il comando Rust reale: recupero esplicito
  come bozza con lo stesso UUID, senza modificare i collegamenti sorgenti.

La finestra si chiude. Riaprirla con lo stesso profilo ed eseguire:

```powershell
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/knowledge-smoke.mjs verify
```

`verify` confronta tutti i documenti, UUID e alias prima/dopo il riavvio e
verifica navigazione e backlink da sessioni e pagine. Nessun mock di persistenza.
Aspettative e screenshot sono in `.tools/`, mai in Git. Non eliminare profili
personali per ripetere i test: scegliere un'altra cartella di prova vuota.

Le suite isolate coprono inoltre validazione, upgrade M1→M2, ricorsione dei
blocchi, rimozione menzioni, conflitti e rollback dei collegamenti cross-campagna.

## Smoke M3 — grafo e relazioni esplicite

Usare un profilo debug **nuovo e vuoto**, con server Vite e WebView2 come negli
smoke precedenti. Non avviare altre istanze di prova sulla stessa porta.

```powershell
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m3-nuova-prova"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/graph-smoke.mjs prepare
```

`prepare` crea campagna/Sessione 12 e due menzioni nella stessa nota, poi prova:

- Query reale con soli archi sessione→pagina, senza relazione Varek→Gilda inferita.
- Creazione manuale «Varek accusa Gilda», certezza sospetta, evidenza/note e blocco fonte.
- Stile Cytoscape reale (tratteggio/continuo, testo di certezza) e clic mouse su
  nodi e archi alle coordinate renderizzate. Il test legge il registro locale
  del canvas solo per individuare i punti di clic: nessun mock di dati o eventi.
- Apertura della fonte sul blocco originale, modifica della certezza, filtri di
  relazione/sessione/centro/profondità e ritorno alla vista completa.
- Form non salvato che impedisce la navigazione, eliminazione annullata con Escape,
  eliminazione confermata che conserva le menzioni e nuova relazione per il riavvio.

La finestra si chiude. Riaprirla sullo stesso profilo ed eseguire:

```powershell
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/graph-smoke.mjs verify
```

`verify` confronta grafo, UUID, relazione, certezza, fonte/evidenza e documento
con i dati precedenti; verifica dettaglio e stile nel canvas reale dopo il riavvio.
Le suite Rust coprono inoltre fonti rimosse, confini di campagna, revisioni obsolete,
upgrade M2→M3, vicinato 1/2 e limiti di 150 nodi/400 archi senza estremi mancanti.
Le suite UI isolate coprono form, errori, conferma e filtri usando un canvas mock;
il test desktop usa invece Cytoscape, Tauri e SQLite reali.

## Backup e ripristino M4

Suite Rust: snapshot con WAL attivo; round trip di due campagne, documenti,
alias, menzioni, relazioni con certezza/fonti e PNG; riapertura; ritorno alla copia
preventiva; migrazione di backup M1 in copia. Respinti checksum alterati, DB
danneggiato con hash ricalcolato, trigger inattesi (anche `sqliteXunexpected`),
versioni future, conteggi errati, file extra/mancanti, duplicati, link simbolici,
percorsi assoluti/traversal e dimensioni fuori limite. Testano anche lock OS,
destinazioni non scrivibili, divieto sovrascrittura e fallimento copia preventiva
o attivazione. Test Windows dedicato a directory occupate senza DELETE sharing.

Smoke desktop ripetibile, solo su profili di prova vuoti in `.tools/`:

```powershell
# Prima compilare il debug, configurare Rust come nel README, avviare pnpm dev.
cargo build --offline --manifest-path src-tauri/Cargo.toml
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m4-source"
$env:NODEX_DEV_BACKUP_FILE="$PWD/.tools/m4-portable.nodex"
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/backup-smoke.mjs seed
node scripts/backup-smoke.mjs create
node scripts/backup-smoke.mjs created
# created chiude normalmente la finestra dopo la ricevuta.
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m4-target"
$env:NODEX_DEV_RESTORE_FILE="$PWD/.tools/m4-portable.nodex"
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/backup-smoke.mjs select
node scripts/backup-smoke.mjs cancel
node scripts/backup-smoke.mjs select
node scripts/backup-smoke.mjs restore
# restore chiude normalmente dopo confronto e verifica della copia preventiva.
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/backup-smoke.mjs verify
```

Le variabili `NODEX_DEV_BACKUP_FILE` e `NODEX_DEV_RESTORE_FILE` sostituiscono
**soltanto il risultato del selettore**, esclusivamente in debug con profilo
esplicito: non simulano dati, comando, ZIP o controlli. Senza queste variabili
gli step `create`/`select` richiedono la scelta manuale del file nel dialogo nativo.
I rami di prova non esistono nella release. Il file `.nodex` deve avere un nome
nuovo: una seconda esecuzione sullo stesso percorso fallisce intenzionalmente.
Conservare le fixture precedenti e scegliere nuovi nomi/profili per ripetere.
`NODEX_SMOKE_TARGET` può indicare una diversa cartella target dentro `.tools/`.

`verify` confronta documenti e metadati completi, UUID, grafo, relazioni/fonti e
SHA-256 dell'immagine nel profilo attivo dopo riavvio, poi apre il canvas reale.
Screenshot ignorati da Git sono controllati visivamente. Il target contiene
inizialmente una campagna di prova per verificare anche la sostituzione e la
copia preventiva, oltre al recupero in un profilo nuovo.

QA manuale ancora necessaria: completare nativamente salvataggio/apertura su ogni
OS, annullare il selettore, provare disco esterno/rete non disponibile e spazio
insufficiente. Su Windows M4 `computer-use` ha osservato il selettore nativo;
gli input successivi sono falliti con errore dello strumento sul processo in
primo piano. Il round trip effettivo usa la scelta predefinita nel debug.

## Personaggio e provenienza M5

Test Rust aggiunti: persistenza di scheda/statistiche/PF/risorse/slot, limiti e
revisioni obsolete, inventario con provenienza e rinomina, indipendenza dei
marcatori capacità, separazione campagne, blocchi rimossi, cambio del tipo Codex,
migrazione 004→005 atomica/idempotente, errori scrittura e round trip backup M5.
Test UI aggiunti: moduli conservati su errore, guardie di navigazione, contatori
in attesa, selezione fonti, eliminazione confermata/Escape, filtri, lettura fallita
con riprova e comportamento manuale degli adattatori sconosciuti.

Smoke ripetibile solo su profili sintetici vuoti, con server Vite e debug compilato:

```powershell
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m5-source"
$env:NODEX_SMOKE_SOURCE="$PWD/.tools/m5-source"
$env:NODEX_DEV_BACKUP_FILE="$PWD/.tools/m5-portable.nodex"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/player-smoke.mjs prepare
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/player-smoke.mjs verify
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m5-restored"
$env:NODEX_DEV_RESTORE_FILE="$PWD/.tools/m5-portable.nodex"
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/player-smoke.mjs restore
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/player-smoke.mjs verify-restored
```

`prepare` crea sessione/pagine con comandi Rust reali, poi usa l'interfaccia per
creare/modificare la scheda, risorse/slot, oggetto e capacità; verifica guardie,
quantità zero, equipaggiamento, filtri e conferma eliminazione. Dal dettaglio
della chiave apre Varek e il blocco fonte della Sessione 12 e torna alla chiave,
anche quando questa non è la prima voce dell'elenco. Verifica assenza di archi
fattuali automatici e consumo implicito di risorse, poi crea il backup con PNG.
Ogni fase chiude normalmente la finestra. `verify` e `verify-restored` confrontano
interi documenti/scheda/asset/grafo/UUID e hash dell'immagine dopo riavvio.

Le prove di questa esecuzione usano `.tools/m5-source-final` e `.tools/m5-restored`;
`NODEX_SMOKE_SOURCE` / `NODEX_SMOKE_RESTORED` scelgono cartelle alternative dentro
`.tools/`. `NODEX_SMOKE_BACKUP` sceglie il file che lo smoke verifica, da impostare
allo stesso percorso di `NODEX_DEV_BACKUP_FILE` e `NODEX_DEV_RESTORE_FILE`.
Usare file backup nuovi per ripetere, senza sovrascrivere fixture precedenti.
Solo il risultato del selettore è predefinito nel debug, come per M4: persistenza,
ZIP e validazioni sono reali. Screenshot di scheda/inventario/capacità controllati;
le tre viste sono state verificate anche a 760 px senza overflow orizzontale.

## Estensione scheda e catalogo SRD 2014

Skill applicate: PDF per estrazione e ispezione visiva delle quattro pagine del
riferimento; frontend-design per sezioni e gerarchia; vercel-react-best-practices
per compendio differito e filtri locali derivati. Nessuna Skill specifica per
database/testing disponibile; verifiche con strumenti ordinari.

Nuovi test automatici: default dei payload M5 dopo migrazione 006, limiti della
scheda e mancata sostituzione su errore, fonte SRD validata, cache persistente e
limitata a 150 voci anche con orologio arretrato, backup scheda/cache. Frontend:
nessuna rete all'apertura, GET vincolato, copia offline, fallback visibile,
risposte errate/sovradimensionate e disco pieno; importazione materiali/livelli
superiori, preset senza formule e conservazione note/marcatori/fonti del modulo.

Eseguiti Windows: 39 test frontend e 40 Rust; lint, typecheck, formattazione,
Clippy e build debug/release. Smoke reale WebView2 con API pubblica: Magic Missile
importato e rinominato, incantesimo originale con ricerca senza risultati,
consultazione classi/equipaggiamento/regole e sottosezione. Ricerca per nome
locale; richieste osservate solo GET categoria/indice, nessun nome personale.
Backup reale, riavvio, ripristino su archivio vuoto e secondo riavvio confrontano
scheda, UUID, incantesimi, fonti e risposte in cache. Nei passi offline si simula
solo l'indisponibilità dell'host API; DB, IPC e backup non sono simulati.
Screenshot ispezionati, scheda caricata verificata a 760 e 1200 px senza overflow.

Per ripetere con cartelle/file nuovi, server `pnpm dev`, debug compilato e Rust
locale configurato come sopra:

```powershell
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/sheet-catalog-source-new"
$env:NODEX_DEV_BACKUP_FILE="$PWD/.tools/sheet-catalog-new.nodex"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/sheet-catalog-smoke.mjs prepare
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/sheet-catalog-smoke.mjs verify
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/sheet-catalog-restored-new"
$env:NODEX_DEV_RESTORE_FILE="$PWD/.tools/sheet-catalog-new.nodex"
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/sheet-catalog-smoke.mjs restore
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/sheet-catalog-smoke.mjs verify-restored
```

`prepare` richiede un profilo vuoto e accesso Internet; ogni fase chiude la
finestra normalmente. Il risultato del selettore file è predefinito solo in debug.
La fixture attesa e gli screenshot restano ignorati in `.tools/`. Nessun PDF o
dato personale nel repository. Il funzionamento della ricerca nella build
release con origine `tauri.localhost` non è stato provato in questa revisione;
la compilazione release e la CSP con host API esplicito sono verificate.

## Piattaforme

Windows x64: suite DB/frontend, build debug e smoke WebView2 eseguiti.
Build release: compilata e avviata, shell e comando SQLite verificati da
`http://tauri.localhost/` con asset incorporati. L'archivio personale vuoto è
stato soltanto letto, senza aggiungere dati di prova. Non avviare insieme
WebView con argomenti di debug diversi sullo stesso profilo WebView2.
macOS/Linux, installer e matrice CI: non eseguiti, previsti in M6.
Il controllo nativo `computer-use` è stato consultato ma la richiesta di accesso
alla finestra è scaduta: lo smoke effettivo usa la WebView e il DB Rust reali.
