# Sviluppo e manutenzione di Chronexus

Istruzioni tecniche spostate dal README in M20 senza modifiche di contenuto. Guida utente: [GUIDE.md](GUIDE.md); procedure di collaudo: [QA.md](QA.md); rilascio: [UPDATES.md](UPDATES.md) e [INSTALLERS.md](INSTALLERS.md).

## Nome, identificatori e dati

Diario personale per il giocatore di una campagna GDR. Desktop, dati locali,
nessun account e funzioni principali offline; ricerche dei cataloghi online
solo su richiesta. Nome e branding sono centralizzati
in `src/strings.ts`, `package.json` e `src-tauri/tauri.conf.json`.
L'identificatore Tauri determina la cartella dati: non cambiarlo senza migrare i dati.
Chronexus è il nuovo nome di Nodex: l'identificatore `it.nodex.desktop`, i nomi
tecnici dei database e l'estensione `.nodex` restano invariati per riaprire gli
archivi e i backup esistenti. L'eseguibile si chiama ora `chronexus.exe` su Windows.

## Prerequisiti e avvio

- Node >= 22.12 e pnpm 11 (`packageManager` fissa la versione).
- Rust stable >= 1.90 con Cargo.
- Windows: Visual Studio C++ Build Tools e WebView2, toolchain MSVC.
- macOS: Xcode Command Line Tools.
- Linux: dipendenze WebKitGTK 4.1 e sviluppo richieste dalla distribuzione.
  Vedere https://v2.tauri.app/start/prerequisites/ per i pacchetti esatti.

```sh
pnpm install --frozen-lockfile
pnpm desktop
```

`pnpm dev` apre soltanto il frontend: senza Tauri non ha accesso al database e
mostra un errore, non un archivio simulato.

In questa sessione Rust è stato installato in `.tools/`, ignorata da Git.
Per riutilizzarlo da PowerShell nella radice del progetto:

```powershell
$env:RUSTUP_HOME="$PWD/.tools/rustup"
$env:CARGO_HOME="$PWD/.tools/cargo"
$env:PATH="$PWD/.tools/cargo/bin;$env:PATH"
pnpm desktop
```

## Spostare il progetto tra dischi (Windows)

Lo store pnpm è relativo (`pnpm-workspace.yaml`). Dopo un taglia/incolla,
ricrea i collegamenti locali con `pnpm install --frozen-lockfile --force`:
non copiare i vecchi collegamenti di `node_modules`. Il lockfile resta invariato.
Per la toolchain portatile usa `./scripts/Dev.ps1` (avvio desktop), oppure
`./scripts/Dev.ps1 -Task test:rust` / `-Task build:desktop`: i percorsi sono
ricavati dalla posizione corrente del repository, senza riferimenti a C: o D:.
Ollama si avvia con `./scripts/Start-LocalAI.ps1`. I database personali restano
nella cartella dati dell'app; non vanno copiati o cancellati durante la riparazione.
L'ambiente Python locale deve poter importare `torch` e rilevare CUDA; se il
Python di base è stato rimosso, ricreare l'ambiente seguendo `AI_LOCAL.md`.

## Verifiche

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:rust
pnpm build
pnpm build:desktop
```

La build desktop produce l'eseguibile locale senza installer. La distribuzione
e la matrice Windows/macOS/Linux sono previste in M6.

## Dati

SQLite è gestito esclusivamente da Rust nella cartella dati applicazione fornita
dal sistema operativo (`it.nodex.desktop` sotto la directory dati).
Migrazioni SQL versionate, transazionali e applicate una sola volta. Nessun dato
della campagna deve essere aggiunto a Git. Non sincronizzare il database aperto
con servizi di file sharing. Dopo un ripristino, `active-profile.json` seleziona
il database e gli allegati in `profiles/<UUID>/`; prima del primo ripristino il
database resta `nodex.sqlite3` nella cartella base. Non spostare il solo database.

Decisioni e limiti verificati: `DECISIONS.md` e `STATUS.md`.

## Novità M6

- **Cerca nella campagna**, anche con Ctrl/⌘ + K: ricerca FTS5 nel contenuto dei
  blocchi, titoli, alias, scheda e asset; filtri e apertura del blocco trovato.
  “Manutenzione ricerca” permette di ricostruire l'indice locale.
- **Riepilogo**: ultima sessione, conteggi effettivi, scheda e pagine recenti.
  Ctrl/⌘ + Shift + N apre la nuova sessione.
- **Immagini** nelle pagine Codex, scheda e voci dell'inventario/capacità. Aggiungi
  ritratti, mappe e riferimenti PNG/JPEG/WebP (20 MiB, 8192 px/lato, 32 MP).
  L'app conserva una copia originale nell'archivio; anteprime e zoom funzionano
  offline. Per una mappa usa una pagina Luogo e il tipo immagine Mappa.
- Le immagini e la loro associazione sono incluse nei backup `.nodex` e verificate
  con SHA-256. “Rimuovi dalla voce” scollega l'immagine ma conserva il file per
  recupero: resta incluso nei backup finché non esiste una pulizia dedicata.
- **Esporta campagna** crea uno ZIP con Markdown, JSON completo, immagini collegate
  e manifest. I link Markdown usano UUID stabili. Per il recupero dell'app usa
  `.nodex`: l'export leggibile non è un formato di reimportazione.

## Pacchetti desktop

Pacchetto Windows completo con installer app e AI offline nella root:
`installers/Chronexus-0.1.0-Windows-x64/`. Mantieni la cartella `AI` accanto
al suo installer. Istruzioni e rigenerazione: [docs/INSTALLERS.md](INSTALLERS.md).

`pnpm icons` genera le icone dalla sorgente SVG; eseguilo prima di comandi Cargo
su un checkout nuovo. `pnpm desktop` e `pnpm build:desktop` lo fanno automaticamente.
`pnpm package:desktop` crea i pacchetti nativi della piattaforma corrente:
Windows NSIS `.exe` (italiano, utente corrente), macOS `.app`/`.dmg`, Linux
`.deb`/`.AppImage`. Gli output sono in `src-tauri/target/release/bundle/`.

Verificato localmente Windows x64: installer `Chronexus_0.1.0_x64-setup.exe`
generato, release avviata, accesso SQLite e API reale da `tauri.localhost` riusciti.
L'installer non è firmato e non è stato installato automaticamente sul sistema.
La pipeline `.github/workflows/desktop.yml` prepara controlli e pacchetti sui tre
OS; non è stata eseguita su GitHub in questa sessione e non è stato fatto push.
macOS/Linux restano da verificare sui rispettivi runner.

## Dipendenze principali e licenze

React, Vite, Mantine, Cytoscape.js, rusqlite, zip, uuid: MIT (uuid anche Apache-2.0).
Tauri, tauri-plugin-dialog, sha2 e tempfile: MIT/Apache-2.0.
M7: reqwest 0.13.5 MIT/Apache-2.0 (HTTP loopback, feature predefinite escluse),
Tokio 1.54.1 MIT. Licenze e versioni verificate nei manifest dei pacchetti locali.
BlockNote core/react/mantine: MPL-2.0, utilizzati senza
modificare i sorgenti e senza funzionalità commerciali XL. TypeScript: Apache-2.0.
Le distribuzioni future dovranno includere gli avvisi delle licenze applicabili.
Le versioni risolte e le dipendenze transitive sono nei due lockfile.


## Distribuzione e importazione Logseq

`pnpm package:desktop` genera le icone e il pacchetto della piattaforma corrente.
Su Windows l’installer si trova in
`src-tauri/target/release/bundle/nsis/Chronexus_0.1.0_x64-setup.exe`.
Build e avvio Windows verificati. Installazione, avvio e disinstallazione NSIS
provati in modalità silenziosa, preservando i database personali con hash
identici. Il wizard interattivo non è stato ispezionato; firma e verifiche
macOS/Linux restano da eseguire. La matrice CI è in
`.github/workflows/desktop.yml`; non è stata eseguita da questa sessione.

Gli strumenti `scripts/prepare-logseq.py` e `scripts/import-logseq.mjs` preparano
un archivio Logseq in un **profilo debug vuoto e isolato**, tramite i comandi Rust
reali. Non sono un importatore generale nell’interfaccia. Esempio:

```powershell
py scripts/prepare-logseq.py C:/percorso/campagna.zip .tools/logseq-source
# Avviare prima pnpm desktop con NODEX_DEV_DATA_DIR assoluto e vuoto,
# WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223
node scripts/import-logseq.mjs .tools/logseq-source "Campagna di prova"
```

Sono letti solo Markdown e immagini raster: configurazioni, Git e script del
grafo non vengono eseguiti. I sorgenti Markdown originali rimangono immutabili,
consultabili nell’app e inclusi in backup/export. Le menzioni conservano UUID e
backlink; non generano relazioni fattuali. Le sessioni hanno una pagina indice
nel Codex collegata tramite backlink al diario. Gli alias ambigui non vengono
uniti. Foto, appunti, report e profili personali rimangono in `.tools/` ignorata.
La conversione non promette equivalenza completa del formato Logseq: per dubbi
consultare sorgente originale e rapporto d’importazione.


## Versione 0.2.0 — distribuzione Windows

Le novità includono draghi animati sugli estremi del singolo dado e alfabeti
Espruar/Dethek con font locali. Il replay conserva il tiro originale.
I pacchetti Windows app + Gemma 4 12B offline sono documentati in
[INSTALLERS.md](INSTALLERS.md) e nelle [note 0.2.0](releases/v0.2.0.md).
Per la sola app usare lo ZIP Installer-Windows-x64. Per app + AI scaricare i
cinque ZIP rimanenti; estrarre soltanto quello Windows-x64 e usare
Installa-AI.cmd per gli altri quattro. Non sono inclusi dati personali o training.

La pubblicazione 0.2.0 è attualmente in bozza: gateway HTTP 502 sugli allegati AI
grandi. Pacchetti completi disponibili localmente; stato reale in docs/STATUS.md.

