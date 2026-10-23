# Verifiche M0–M4

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

## Piattaforme

Windows x64: suite DB/frontend, build debug e smoke WebView2 eseguiti.
Build release: compilata e avviata, shell e comando SQLite verificati da
`http://tauri.localhost/` con asset incorporati. L'archivio personale vuoto è
stato soltanto letto, senza aggiungere dati di prova. Non avviare insieme
WebView con argomenti di debug diversi sullo stesso profilo WebView2.
macOS/Linux, installer e matrice CI: non eseguiti, previsti in M6.
Il controllo nativo `computer-use` è stato consultato ma la richiesta di accesso
alla finestra è scaduta: lo smoke effettivo usa la WebView e il DB Rust reali.
