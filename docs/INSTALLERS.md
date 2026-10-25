# Installer Windows con AI locale

## Aggiornamento M17 — 25 ottobre 2026

[Chronexus 0.6.0](https://github.com/Acelith/Chronexus/releases/tag/v0.6.0)
include la traduzione locale della wiki. Installer app Windows x64 firmato updater,
schema 017 additivo. Pacchetto locale in `installers/Chronexus-0.6.0-Windows-x64/`.
Firma reale e download anonimi verificati, nessuna installazione personale
eseguita. Runtime e Qwen3 4b-instruct restano separati; le copie già tradotte si
leggono senza runtime. M18 non è implementata. Dettagli in WIKI_TRANSLATION.md
e STATUS.md; i pacchetti/release precedenti non sono stati sovrascritti.

## Politica Forgegit — pianificata con M11

Destinazione verificata di `origin`: `https://github.com/Acelith/Chronexus.git`,
repository dell’utente. Per le future milestone implementate e verificate,
l’utente autorizza come procedura standard la pubblicazione del codice e delle
release versionate con pacchetti app e, quando previsto, AI locale. Non serve
richiedere nuovamente questa autorizzazione ordinaria, salvo istruzioni contrarie.

Prima di pubblicare: verificare capacità/API/autenticazione del server, limiti
per runtime/pesi AI, licenze, versione/tag coerenti, build/test reali, checksum e
note di rilascio. Escludere dati privati e segreti; non sostituire release/tag/asset
esistenti e non usare force-push. Verificare download/checksum dopo l’upload e
riportare errori o pubblicazioni parziali con precisione. Non inventare pacchetti
per piattaforme non collaudate né usare una destinazione alternativa non autorizzata.

**Autorizzazione successiva dell’utente:** implementare tutte e tre le milestone;
completare prima M12 e M13, quindi compilare e pubblicare con M11 alla fine.
Il precedente divieto riguardava la sola pianificazione ed è superato da questa
istruzione. Non pubblicare artefatti intermedi o dichiarare riusciti upload non verificati.

## Aggiornamento M8 — 24 ottobre 2026

Il nuovo installer **dell'app** è in `installers/Chronexus-M8-Windows-x64/`.
Generazione NSIS verificata; installazione M8 non ripetuta.
Dimensione installer M8: 4.664.266 byte; SHA-256
`e59a7cae39c01d0875f74e19c4c651030fe5733ee778e98126c056a8c5061bcf`.
Copia nella root e worker di rilascio confrontati con gli artefatti finali.
 Include il worker
aggiornato, non i checkpoint o l'ambiente Python/CUDA. Il backend su questo
computer è stato preparato e verificato separatamente. Per un altro computer
seguire [AI_TRAINING.md](AI_TRAINING.md), senza presumere che il pacchetto Qwen
M7 contenga Gemma o il training.

Il pacchetto completo descritto di seguito resta la distribuzione **M7** e
non è stato sovrascritto. Conservare un backup prima di migrare: le vecchie
build non leggono uno schema SQLite più recente.

## Distribuzione M7 precedente

Output nella root: `installers/Chronexus-0.1.0-Windows-x64/`.
La cartella generata e' esclusa da Git: contiene circa 4,5 GiB di runtime e pesi,
nessun database, backup, campagna o modello sperimentale.

1. `Chronexus_0.1.0_x64-setup.exe`: installa l'app, stessa build verificata M7.
2. `Chronexus_AI_locale_x64-setup.exe`: verifica/copia Ollama 0.40.10 e soltanto
   Qwen3:4b-instruct Q4_K_M per il singolo utente. Non separarlo dalla cartella `AI`.
3. Menu Start → Chronexus → Avvia AI locale; poi apri Chronexus e nella campagna
   Assistente locale → Controlla Ollama → modello → consenso → Attiva.

Il pacchetto AI e' completo per l'uso senza download. Non installa driver GPU,
WebView2 o servizi di sistema; non abilita cloud o avvio automatico. Serve spazio
aggiuntivo circa pari al pacchetto. Nessuna modifica alle campagne dell'app.
Installer non firmati; macOS/Linux non prodotti su questo ambiente Windows.

Manifest con SHA-256 di ogni file in `AI/bundle.json`, checksum dei due EXE in
`SHA256SUMS.txt`, istruzioni immediate in `LEGGIMI.txt`. Licenze upstream incluse:
Ollama MIT, Qwen Apache-2.0 e avvisi dei componenti del runtime.

L'AI e' copiata in una cartella per utente/versione. Non sovrascrive file estranei
o modificati; la ripetizione dello stesso pacchetto e' idempotente. Se un errore
di disco/permessi interrompe la copia, una cartella parziale senza manifest non
viene adottata automaticamente: scegliere una cartella nuova. Per rimuovere l'AI,
chiudere il suo runtime e rimuovere solo quella cartella e il suo collegamento
dal menu Start, conservando eventuali modelli personali desiderati.

Ollama puo' arricchire il manifest locale: il digest verificato del wrapper e'
`6214d088d3846e16c9fe00adcbabdbfddc61ce4a70daacc46cb2310c38603054`, con manifest
originale `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
I pesi restano gli stessi, SHA-256
`85e4a5b7b8ef0e48af0e8658f5aaab9c2324c76c1641493f4d1e25fce54b18b9`.
L'avviatore verifica entrambe le identita' note, pesi GGUF, assenza di inoltro e
cloud disabilitato. Se Chronexus aveva fissato il vecchio digest, controllare e
riattivare il modello: l'app non cambia automaticamente l'identita' configurata.

## Rigenerazione

Prerequisiti locali: build NSIS Chronexus, portable Ollama/pesi verificati in
`.tools/m7-runtime`, licenza ufficiale `OLLAMA_LICENSE` di quella release e
NSIS del toolchain Tauri. Nessun download automatico nello script.

```powershell
./scripts/Build-OfflineInstallers.ps1
```

Rifiuta output esistenti; `-OutputDirectory` consente una nuova cartella dentro
il repository. Copia tutti i file del runtime e soltanto i blob referenziati dal
manifest selezionato, verificandone gli hash. Include licenze e avviatori.
Non legge cartelle delle campagne. Per compilare prima l'app: `pnpm package:desktop`
nell'ambiente Rust configurato descritto nel README.

## Verifiche

- Compilazione NSIS AI e copia dell'installer app: riuscite.
- Sei scenari `powershell -File scripts/distribution/Test-AIInstaller.ps1`:
  percorso con spazi, ripetizione, file modificato, dati estranei, checksum
  errato e traversal. Le verifiche precedono qualsiasi copia; nessun overwrite.
- Installazione silenziosa AI `/S /TEST /D=<profilo isolato>` provata realmente;
  `/TEST` omette soltanto il collegamento del menu Start.
- Runtime copiato: stato cloud disabilitato, modello e pesi verificati; inferenza
  GPU reale di prova. La sandbox iniziale negava accessi al runtime, percio' il
  collaudo e' stato ripetuto nel normale contesto utente Windows.
- Hash .NET nello script di copia, indipendenti dall'autoload `Get-FileHash` di
  PowerShell avviato da NSIS. Installer richiede Windows x64 e usa PowerShell 64 bit.
- Nessun nuovo test delle funzioni React/Rust: non sono state modificate.
  Wizard/collegamento interattivi e piattaforme diverse non verificati qui.

## M11 — procedura 0.2.0 Windows x64

La procedura corrente è `scripts/release/package.py`, non lo script M7/Qwen
storico. Versioni package.json, Cargo.toml/lock e tauri.conf.json coerenti;
identificativo storage invariato. Costruire con toolchain relativa tramite Dev.ps1
oppure configurare CARGO_HOME/RUSTUP_HOME del progetto e usare:

```powershell
pnpm exec tauri build --bundles nsis
C:/Python315/python.exe scripts/release/package.py installers/Chronexus-0.2.0-Windows-x64-final
C:/Python315/python.exe -m unittest discover -s scripts/release -p 'test_*.py'
```

Lo script richiede una directory nuova, verifica i blob ufficiali GGUF Gemma 4 e
produce cinque ZIP app/AI validi sotto 2048 MiB: core app/runtime/componenti e quattro
volumi del peso principale (il quarto include anche il proiettore). Ogni file ha
SHA-256 e dimensione; `AI/bundle.json` guida l'installatore PowerShell offline.
Non estrarre i volumi manualmente. Licenze app/font e runtime/modello incluse;
nessuna scansione delle cartelle campagne o dei profili di addestramento.

`forgejo_release.py` riceve l'autorizzazione soltanto in RAM da una sessione
interattiva; non cerca credenziali nel sistema e non le scrive. Destinazione fissa
origin dell'utente. Richiede albero pulito, tag annotato/versione/commit remoto
coerenti e report checksum. Crea bozza, carica sei allegati (incluso il pacchetto leggero solo app), scarica/verifica
ciascuno, poi pubblica. Non sovrascrive tag/release/allegati altrui. Una ricevuta
locale ignorata permette di riconoscere una bozza della stessa esecuzione; su
errore interrompere, non cancellare o presentare una release parziale come conclusa.

Le prove effettive e i limiti della versione sono in `docs/releases/v0.2.0.md`.
SHA256SUMS.txt e package-report.json rimangono con i pacchetti locali; i sei
checksum sono riportati anche nel corpo della release. Token/password non devono
mai entrare in file di piano, ricevute, log, argomenti di processo o Git.


### Esito del primo rilascio remoto

Tag v0.2.0 e codice pubblicati; bozza id 2 e pacchetto solo app caricato con
download/checksum verificato. Upload grandi interrotti dal servizio (HTTP 502,
297 MB/235 s nel secondo tentativo); non è un problema di credenziali. Non
pubblicare la bozza incompleta. I cinque pacchetti AI locali sono integri.
Attendere una verifica/correzione del gateway prima di un altro invio lungo.
`MAX_FILES=5` indica gli allegati per singolo upload, non impone cinque asset per
release; il sesto pacchetto rende l'app scaricabile senza i pesi AI.

Il tag identifica il sorgente effettivamente compilato. Le successive correzioni
ai soli strumenti/documenti possono avanzare main senza riscrivere quel tag:
il piano locale registra `commit` compilato e `publicationCommit`. Il validatore
rifiuta qualunque modifica applicativa successiva al tag; in quel caso servono
nuova build e nuova versione. Nessun tag o allegato esistente viene sovrascritto.


### Ripresa LAN esplicitamente autorizzata

L’utente ha indicato `http://192.168.162.26:3000` per questa ripresa. È il solo
endpoint alternativo ammesso e deve essere selezionato esplicitamente mediante
`publish(authorization, base_url=LOCAL_BASE, finalize=False)`. Confrontare repository
(id/nome/permessi) e bozza con il sito canonico prima di qualsiasi scrittura.
L’origin Git resta HTTPS pubblico; nessuna sostituzione del tag del sorgente compilato.

Il client non segue redirect e non invia l’autorizzazione ad altri host. Gli URL
canonici `/attachments/<id>` sono riscritti soltanto verso il preciso endpoint
locale selezionato, per il download SHA-256 dei medesimi allegati. Le verifiche
completate vengono registrate con ID/dimensione/hash/trasporto nella ricevuta locale;
un asset già presente ma non riconosciuto dalla ricevuta non viene sovrascritto.

Usare prima `finalize=False` per completare upload e download mantenendo la bozza;
aggiornare le note con le prove effettive e poi finalizzare. Controllare l’insieme
esatto degli allegati prima di rendere pubblica la release. I test della ripresa
sono 18; nessuna modifica al binario o ai dati dell’app richiede una nuova build.

### Aggiornamenti dell’app 0.4.0

Il canale updater usa il solo installer firmato con `.sig` e `latest.json`, senza
ridistribuire a ogni versione i pesi AI della M11. Compilazione protetta e procedure
sono in docs/UPDATES.md; i pacchetti precedenti e la bozza v0.2.0 restano distinti.


0.4.0 pubblicata il 25 ottobre 2026: release id 3, installer app-only firmato
updater, .sig e latest.json. Tutti e tre riscaricati senza login con hash verificati;
API latest confermata dall’app desktop sintetica. Sorgente compilato d75f5f3.
La bozza id 2/v0.2.0 non è stata modificata e non è diventata una release completa.
