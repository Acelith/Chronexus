# Verifiche M0, M1 e M2

## Suite automatizzate

- `pnpm test`: schermate (creazione/rinomina, sessione, errori, navigazione
  bloccata) e autosave (debounce, concorrenza, flush, errore e riprova).
  Solo questi test UI isolati sostituiscono il bridge con un mock.
- `pnpm test:rust`: database reale in file temporanei, due paragrafi identici
  dopo riapertura, ordine numerico, rinomina stabile, campagne separate,
  validazione, scrittura fallita, revisione obsoleta e migrazioni.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` e
  `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.
- `pnpm build:desktop`: eseguibile release senza installer.

## Prova desktop reale su Windows

Eseguita tramite Playwright collegato alla WebView2 di Nodex: nessun mock di
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
Start-Process "$PWD/src-tauri/target/debug/nodex.exe"
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
Start-Process "$PWD/src-tauri/target/debug/nodex.exe"
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
Start-Process "$PWD/src-tauri/target/debug/nodex.exe"
node scripts/knowledge-smoke.mjs verify
```

`verify` confronta tutti i documenti, UUID e alias prima/dopo il riavvio e
verifica navigazione e backlink da sessioni e pagine. Nessun mock di persistenza.
Aspettative e screenshot sono in `.tools/`, mai in Git. Non eliminare profili
personali per ripetere i test: scegliere un'altra cartella di prova vuota.

Le suite isolate coprono inoltre validazione, upgrade M1→M2, ricorsione dei
blocchi, rimozione menzioni, conflitti e rollback dei collegamenti cross-campagna.

## Piattaforme

Windows x64: suite DB/frontend, build debug e smoke WebView2 eseguiti.
Build release: compilata e avviata, shell e comando SQLite verificati da
`http://tauri.localhost/` con asset incorporati. L'archivio personale vuoto è
stato soltanto letto, senza aggiungere dati di prova. Non avviare insieme
WebView con argomenti di debug diversi sullo stesso profilo WebView2.
macOS/Linux, installer e matrice CI: non eseguiti, previsti in M6.
Il controllo nativo `computer-use` è stato consultato ma la richiesta di accesso
alla finestra è scaduta: lo smoke effettivo usa la WebView e il DB Rust reali.
