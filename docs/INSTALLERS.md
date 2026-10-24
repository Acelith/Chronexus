# Installer Windows con AI locale

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
