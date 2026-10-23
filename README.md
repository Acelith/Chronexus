# Chronexus

Diario personale per il giocatore di una campagna GDR. Desktop, dati locali,
nessun account o servizio remoto a runtime. Nome e branding sono centralizzati
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

## Funzioni attuali (M0–M5)

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
I backup automatici e l'esportazione Markdown/JSON sono ancora da implementare.

Il gestore allegati nell'interfaccia è previsto più avanti: M4 conserva file del
layout `attachments/<UUID campagna>/<UUID file>[.<estensione>]`, senza introdurre
caricamenti di immagini nell'editor. I test includono una vera immagine PNG.

Conserva spazio per ZIP, estrazione e nuova copia dei dati. Vecchie generazioni e
copie preventive non vengono eliminate automaticamente. I backup con schema 005
richiedono una versione che supporti lo schema corrispondente (005 per M5,
006 per scheda estesa e catalogo); i backup precedenti (schemi 1–5) restano
recuperabili e vengono aggiornati in copia. Esistono ancora archivi `.nodex`
con il vecchio nome: non occorre rinominarli. Gli eseguibili M0–M3 ignorano
il selettore di profilo introdotto da M4.
Se il database corrente è talmente danneggiato da impedire l'apertura, il ripristino
in quella cartella è bloccato: a Chronexus chiuso conserva **l'intera cartella dati**
separatamente, poi avvia su una cartella dati vuota e seleziona un backup valido.

Una menzione indica soltanto che una pagina è citata negli appunti: non crea
alleanze, accuse o altre relazioni fattuali: queste vengono dichiarate manualmente
nel grafo, con certezza e fonte esplicite. La ricerca del Codex riguarda titoli e alias; la ricerca globale
nel testo è prevista in M6.

Prove desktop ripetibili e matrice delle verifiche: [docs/QA.md](docs/QA.md).

## Dipendenze principali e licenze

React, Vite, Mantine, Cytoscape.js, rusqlite, zip, uuid: MIT (uuid anche Apache-2.0).
Tauri, tauri-plugin-dialog, sha2 e tempfile: MIT/Apache-2.0.
BlockNote core/react/mantine: MPL-2.0, utilizzati senza
modificare i sorgenti e senza funzionalità commerciali XL. TypeScript: Apache-2.0.
Le distribuzioni future dovranno includere gli avvisi delle licenze applicabili.
Le versioni risolte e le dipendenze transitive sono nei due lockfile.

