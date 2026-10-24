# Chronexus

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
Python di base è stato rimosso, ricreare l'ambiente seguendo `docs/AI_LOCAL.md`.

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

Decisioni e limiti verificati: `docs/DECISIONS.md` e `docs/STATUS.md`.

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
al suo installer. Istruzioni e rigenerazione: [docs/INSTALLERS.md](docs/INSTALLERS.md).

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

## Funzioni M0–M5

La scheda è stata ampliata sul riferimento PDF dell'utente: sezioni manuali per
combattimento/sensi, identità e competenze, storia/aspetto, armi/munizioni,
denaro/carico e magia. “Aggiungi campi D&D 2014” inserisce caratteristiche,
tiri e abilità mancanti senza riscrivere i tuoi valori. Competenza/maestria,
modificatori e tiri contro morte sono manuali. “Aggiungi slot 1°–9°” crea slot
a zero: scegli tu massimi e disponibilità. Non sono implementate formule automatiche.

Da Personaggio, Inventario o Capacità usa **Cerca in D&D**, scegli categoria e
nome inglese e premi **Cerca nell’API**. Puoi consultare incantesimi, classi,
specie, equipaggiamento, oggetti magici, privilegi, tratti, abilità, condizioni e
regole SRD 2014. L'API non contiene tutti i manuali commerciali e non offre
l'italiano al momento della verifica. Il nome viene filtrato sul dispositivo.

Apri un incantesimo, scegli **Usa questi dati nel modulo**, personalizza e premi
**Salva voce**. La fonte originale resta visibile anche dopo una rinomina.
**Aggiungi incantesimo** continua a creare voci interamente tue; dal modulo puoi
anche **Cercare questo nome in D&D** e usare un risultato come base, mantenendo
note, marcatori e collegamenti. I contenuti personalizzati restano locali:
l'API è di sola lettura e non li pubblica.

La rete è facoltativa e si attiva solo con un'azione nel catalogo. Fino a
150 risposte scaricate sono conservate in SQLite con data; le voci salvate nel
grimorio sono copie indipendenti. Le copie consultate funzionano offline dopo
riavvio; una voce nuova richiede connessione. **Aggiorna** cerca una versione
online e segnala eventuale uso della copia locale. Backup e ripristino comprendono
scheda estesa, fonti e cache. Nessun PDF, appunto o scheda personale viene inviato.
Dettagli tecnici e attribuzione: [docs/RULESETS.md](docs/RULESETS.md).

- Creazione, selezione e rinomina di campagne indipendenti.
- Sessioni ordinate per numero, con titolo e data reale facoltativa.
- Editor BlockNote italiano: paragrafi, titoli, elenchi, checklist, citazioni,
  grassetto/corsivo. Il menu `/` elenca i blocchi disponibili.
- Salvataggio automatico dopo 500 ms, stato visibile, pulsante «Salva ora» e
  riprova. Cambio nota/campagna e chiusura normale attendono la persistenza.
  Un errore impedisce la navigazione e conserva gli appunti nell'editor.
- Codex con pagine tipizzate, titolo, alias, bozza/attiva e appunti a blocchi.
- Menu `[[`: scrivi un nome e scegli una pagina esistente o «Crea bozza» con
  mouse, frecce e Invio. Anche `[[Nome]]` resta testo finché non scegli un risultato.
  I riferimenti confermati conservano UUID stabili e sopravvivono alle rinomine.
- Backlink da sessioni e pagine, raggruppati per fonte con anteprima e apertura
  del blocco di origine. Il vecchio titolo rimane un alias dopo una rinomina.
- Alias ambigui presentati come risultati distinti; riferimenti mancanti
  recuperabili esplicitamente come bozze con lo stesso ID.
- Grafo Cytoscape con nodi pagina/sessione, menzioni tratteggiate e relazioni
  dichiarate continue. Frecce, etichetta e certezza ne esplicitano il significato.
- Creazione/modifica di relazioni direzionali con certezza confermata, sospetta,
  smentita o sconosciuta; fonte facoltativa sessione/pagina/blocco, evidenza e note.
  Le relazioni richiedono «Salva relazione»; un form aperto blocca la navigazione
  finché non viene salvato o annullato.
- Filtri per tipo di nodo, menzioni/relazioni, certezza, titolo/alias, sessione
  fonte e vicinato a 1–2 passaggi. Vista limitata a 150 nodi e 400 collegamenti,
  con avviso e conteggi quando occorre restringere i filtri.
- Clic sui nodi per aprire il documento, sui collegamenti per vedere fonte/evidenza;
  elenco accessibile equivalente per l'uso da tastiera.
- Le relazioni possono essere eliminate solo dopo conferma; pagine, appunti e
  menzioni rimangono conservati. Cancellazione/archiviazione delle pagine
  non sono ancora presenti.
- Backup manuale `.nodex` dell'intero archivio e ripristino con anteprima,
  verifica integrità, conferma e copia preventiva dei dati correnti.
- Un personaggio per campagna con identità, regolamento libero, livello/esperienza
  facoltativi, PF attuali/massimi/temporanei, condizioni e note. Statistiche,
  abilità, tiri, difese e movimento sono valori configurabili manualmente.
- Risorse e slot personali con massimo scelto, comandi +/− e persistenza di ogni
  variazione. Nessuna formula di regolamento, riposo o consumo automatico.
- Inventario con quantità (anche zero), categoria, peso/valore liberi,
  equipaggiamento, consumabili, descrizione e note. Modifica ed eliminazione
  confermata; gli appunti e le pagine collegate non vengono cancellati.
- Provenienza degli oggetti: sessione/blocco, PNG, luogo e missione della campagna,
  con note e pagina Codex facoltativa. Apertura della fonte e ritorno alla voce
  selezionata. Nomi modificati nel Codex non cambiano gli UUID dei collegamenti.
- Incantesimi/capacità con testo personale, sistema, rango, scuola/tradizione,
  attivazione/durata/portata/componenti e marcatori conosciuta/preparata indipendenti.
  Filtri per nome, rango, stato/tipo e collegamenti a Codex/sessione.

La chiusura forzata del processo o un'interruzione elettrica possono perdere
le modifiche che non hanno ancora raggiunto SQLite. Attendere «Salvato sul computer».
Una sola istanza può aprire lo stesso archivio; il lock viene rilasciato dal
sistema anche alla chiusura forzata. Le revisioni continuano a impedire scritture
obsolete, senza fusione automatica degli appunti.

## Personaggio, inventario e capacità

Apri una campagna e scegli **Personaggio → Crea personaggio**. Inserisci solo i
valori utili al tuo sistema; da **Modifica personaggio** aggiungi statistiche e
risorse/slot. I moduli usano **Salva personaggio** / **Salva voce** espliciti;
non sono autosalvati. Navigazione e chiusura attendono la fine di una scrittura
e richiedono di salvare o annullare un modulo aperto. Un errore conserva il modulo.
I comandi rapidi +/−, equipaggiamento e marcatori delle capacità salvano subito.

Da **Inventario → Aggiungi oggetto**, annota nome e quantità. Per registrare una
chiave ricevuta da Varek nella Sessione 12, seleziona il PNG, la sessione e il
blocco fonte già presenti nella campagna. Se necessario crea prima le pagine
nel Codex, con tipo PNG/luogo/missione. Dal dettaglio dell'oggetto apri la fonte;
**Torna alla voce del personaggio** riapre l'oggetto selezionato.

Un blocco eliminato dagli appunti non cancella la provenienza: viene segnalato
come mancante e si può aprire l'intera sessione. I collegamenti di provenienza
non producono relazioni fattuali nel grafo. In **Capacità** scrivi il tuo testo:
non sono inclusi cataloghi commerciali. Nessun marcatore consuma PF, risorse o slot.
Il contratto per adattatori futuri è documentato in [docs/RULESETS.md](docs/RULESETS.md).

## Backup e recupero

1. Apri **Backup e ripristino** nella barra laterale. Chronexus attende il salvataggio
   degli appunti; se fallisce, rimane nell'editor e segnala l'errore.
2. **Crea backup** apre il selettore del sistema. Scegli un nuovo nome con
   estensione `.nodex`, anche su disco esterno o unità di rete montata. Un file
   esistente viene sempre rifiutato, anche se il selettore ne propone la sostituzione.
3. Attendi **Backup creato e verificato** e controlla percorso e conteggi.
   Include **tutte le campagne**, personaggi, risorse, oggetti/capacità, documenti,
   UUID, menzioni, relazioni e allegati
   nella cartella gestita. Non include file esterni semplicemente citati nelle note.
4. Per recuperare su un altro computer o su un profilo nuovo: **Seleziona backup**,
   controlla data e conteggi, poi **Sostituisci archivio**. Tutte le campagne correnti
   sono sostituite; non è un'importazione o fusione. **Annulla ripristino** o Escape
   conservano l'archivio corrente.
5. Prima di applicare il ripristino, Chronexus salva un backup in `backups/` nella
   cartella dati. Il percorso completo compare nella ricevuta. Per tornare indietro,
   seleziona quel `.nodex` nello stesso flusso. Se la copia preventiva fallisce,
   il ripristino viene interrotto.

ZIP/Deflate con manifest v1 e SHA-256 per ogni file; snapshot tramite API SQLite,
controlli di integrità e riferimenti, blocco di percorsi ostili e file alterati.
**Non è cifrato né firmato**: conserva copie private e usa backup di provenienza
fidata. Limiti iniziali: 256 MiB per file, 512 MiB complessivi e 9998 allegati.
L’esportazione ZIP Markdown/JSON è disponibile da **Esporta campagna**; comprende
immagini, fonti originali importate e manifest SHA-256. Il ripristino autorevole
usa il `.nodex`; il reimport dell’export e i backup automatici restano futuri.

Da **Immagini della voce** nelle pagine Codex, nella scheda e negli oggetti puoi
aggiungere PNG/JPEG/WebP con didascalia e ruolo, visualizzarli e ingrandirli. Per
una mappa usa una pagina Luogo e il ruolo Mappa. Sono copie locali reali incluse
nel backup, senza dipendere dal percorso originale. Limiti: 20 MiB, 8192 pixel
per lato, 32 milioni di pixel. Rimuovere il collegamento conserva il file per
recupero; gli originali mancanti o corrotti impediscono il backup.

Conserva spazio per ZIP, estrazione e nuova copia dei dati. Vecchie generazioni e
copie preventive non vengono eliminate automaticamente. I backup con schema 005
richiedono una versione che supporti lo schema corrispondente (005 per M5,
006 per scheda estesa e catalogo, 011 per M6, sorgenti Logseq, Party e wiki); i backup precedenti (schemi 1–10) restano
recuperabili e vengono aggiornati in copia. Esistono ancora archivi `.nodex`
con il vecchio nome: non occorre rinominarli. Gli eseguibili M0–M3 ignorano
il selettore di profilo introdotto da M4.
Se il database corrente è talmente danneggiato da impedire l'apertura, il ripristino
in quella cartella è bloccato: a Chronexus chiuso conserva **l'intera cartella dati**
separatamente, poi avvia su una cartella dati vuota e seleziona un backup valido.

Una menzione indica soltanto che una pagina è citata negli appunti: non crea
alleanze, accuse o altre relazioni fattuali: queste vengono dichiarate manualmente
nel grafo, con certezza e fonte esplicite. La ricerca del Codex riguarda titoli e alias; la ricerca globale
nel testo è disponibile da **Cerca** o Ctrl/⌘K, con filtri e apertura del blocco
fonte. Ctrl/⌘ShiftN crea una sessione. **Riepilogo** apre le voci recenti.

Prove desktop ripetibili e matrice delle verifiche: [docs/QA.md](docs/QA.md).

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


## Grafo, Party e wiki

L'aspetto usa pergamena, cuoio scuro, ottone e titoli serif locali; la navigazione
rimane ordinaria. Il grafo parte da una mappa leggibile di massimo 18 nodi;
**Mostra tutti i nodi**, **Disposizione → Organica** e i filtri permettono di
esplorare altri insiemi. Seleziona un nodo per evidenziare i collegamenti e
aprire la voce o esplorarne i vicini. Il limite dati della vista rimane
150 nodi/400 archi; l'elenco accessibile conserva tutte le fonti restituite.

Da **Party → Aggiungi membro** crea un personaggio o collega una pagina del
Codex esistente, aggiungi giocatore/ruolo/presenza e scrivi in **Quello che so**.
Gli appunti si salvano automaticamente nella stessa pagina del Codex e sono
ricercabili. Le immagini usano gli allegati esistenti e sono incluse nel backup.
Rimuovere dal party conserva pagina, appunti e immagini. Il party non crea
schede giocabili complete aggiuntive o relazioni fattuali implicite.

**Wiki D&D** consulta [Open5e v2](https://open5e.com/api-docs/), accanto al catalogo
SRD personale esistente. Cerca termini inglesi, apri una voce e controlla fonte,
edizione e licenze; le risposte consultate rimangono in SQLite e nel backup.
La ricerca invia solo il termine esplicitamente digitato; nessun appunto viene
caricato. **Aggiorna online** è esplicito; un fallimento mantiene la copia
locale con avviso. Cache limitata a 100 risposte: le meno recenti possono essere
sostituite. Fonti e copertura non equivalgono a tutti i manuali commerciali.
Ricerca API/Skill: [docs/RESEARCH_DND.md](docs/RESEARCH_DND.md).

## Assistente locale M7

La sezione **Assistente locale** interroga gli appunti della campagna e le voci
D&D già salvate nella Wiki, separate per edizione. Risposte italiane con fonti
riapribili, streaming, annullamento e cronologia conservata nei backup/export.
Non modifica appunti, relazioni, scheda o inventario.

Modello provato: **Qwen3:4b-instruct**, multilingue con fonti locali, scelto
esplicitamente dopo le prove insufficienti del candidato specifico D&D.
Non è fine-tuned su D&D; citazioni e risposte richiedono verifica del giocatore.
Ollama e i pesi sono separati dall'installer e dai backup; nessun download o
inferenza automatica all'avvio. L'app funziona anche senza runtime.

Nel progetto di questa sessione, avvia `powershell -File scripts/Start-LocalAI.ps1`,
poi Chronexus, una campagna → **Assistente locale** → **Controlla Ollama** →
`qwen3:4b-instruct` → conferma il profilo multilingue → **Attiva modello locale**.
Il runtime deve confermare cloud disabilitato e GPU disponibile; CPU esclusiva
bloccata prima di inviare gli appunti. Nessun ripiego su cloud.

Setup su nuove macchine, identità del modello, collaudi e limiti:
[docs/AI_LOCAL.md](docs/AI_LOCAL.md). La ricerca è lessicale e usa estratti
limitati: nomi/alias precisi aiutano. Una citazione valida non garantisce verità.


## M8 — Gemma e riaddestramento della campagna

Dal menu **Impostazioni della campagna → AI locale** si scelgono Gemma 4 12B,
edizione e fonti locali. **Riaddestra sui nuovi dati** esegue QLoRA sulla GPU
e prepara un adapter; **Attiva adapter** lo applica soltanto dopo le verifiche
e una scelta esplicita. **Aggiorna conoscenze** aggiorna invece la ricerca,
senza modificare i pesi. Adapter e provenienza sono inclusi nei backup, pesi
base e copie GGUF derivate restano fuori. Nessuna modifica automatica ai fatti.

Su questo computer il backend è preparato. Per avviare Ollama usare
`powershell -File scripts/Start-LocalAI.ps1`, poi aprire Chronexus aggiornato
o eseguire `pnpm desktop` con l'ambiente Rust configurato sopra. Per il setup
su un altro computer, requisiti e limiti: [docs/AI_TRAINING.md](docs/AI_TRAINING.md).
Installer app M8: `installers/Chronexus-M8-Windows-x64/` (non firmato, generazione
verificata; installazione M8 non ripetuta). Il pacchetto completo M7 resta distinto.

Verifiche M8: 69 test Rust, 59 frontend e 5 worker Python, build desktop/NSIS e
training reale RTX 4080 SUPER con 74 estratti/74 passaggi. Restano offline fisico
e altre piattaforme. La prossima milestone funzionale è M9, il tiradadi.
