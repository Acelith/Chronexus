# M7 — Assistente D&D locale sulla GPU

> M8: Gemma 4 12B, impostazioni per campagna e training QLoRA sono documentati
> in [AI_TRAINING.md](AI_TRAINING.md). Il profilo M7 Qwen descritto qui resta
> disponibile per il rollback; modello e fonti sono ora scelti per campagna.

Stato: funzioni implementate e collaudate su Windows; accettazione fisica offline
e piattaforme aggiuntive ancora da verificare. Configurazione disattivata
inizialmente; l'app rimane utilizzabile senza Ollama. Risultati aggiornati in
[STATUS.md](STATUS.md) e [QA.md](QA.md).

## Scelta approvata del modello

Il candidato specifico D&D [dnd-unified-1.5b](https://huggingface.co/chendren/dnd-unified-1.5b),
[GGUF Q4_K_M](https://huggingface.co/mradermacher/dnd-unified-1.5b-GGUF), è stato
realmente caricato sulla RTX 4080 SUPER: 29/29 layer GPU, circa 999 MiB residenti,
contesto 2048. SHA-256 pesi:
`3cc578dabc0e30a8e7d51d2b27d5e46f5abd118e16fe0e67123ea064fe17b77e`.
Ha fallito tre prove italiane iniziali, ripetendo prompt/risposta senza concludere.
La scheda dichiara Apache-2.0, inglese e dati 5e/3.5; metriche e provenienza dei
suoi dataset non sono indipendentemente validate. Escluso dalla selezione UI.

L'utente ha quindi **esplicitamente approvato un modello multilingue più capace
con fonti D&D e campagna locali e citazioni**. Il modello scelto è
[Qwen3:4b-instruct](https://ollama.com/library/qwen3:4b-instruct), basato su
[Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507).
È multilingue, **non fine-tuned D&D**. Licenza Apache-2.0 dichiarata dai produttori;
nessun peso redistribuito nel repository o nell'installer.

- Manifest Ollama: `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
- SHA-256 pesi: `85e4a5b7b8ef0e48af0e8658f5aaab9c2324c76c1641493f4d1e25fce54b18b9`.
- Quantizzazione Q4_K_M, circa 2,5 GB su disco; contesto app 8192, output 512 token.
- Ollama portable 0.40.10; pacchetto ufficiale verificato con checksum di release.
- RTX 4080 SUPER, 16.376 MiB, driver 621.01: `/api/ps` riporta
  3.710.428.118 byte residenti **tutti in VRAM**, circa 3539 MiB a contesto 8192.
  Hardware e consumo osservati sono dati di prova, non requisiti universali.
- Qwen3:4b standard esponeva ragionamento invece di risposte dirette: usare la
  variante **instruct**. Altri modelli selezionabili non sono qualificati da queste prove.

## Avvio Windows

E' disponibile anche un pacchetto con i due installer e tutti i file AI nella
cartella root `installers/Chronexus-0.1.0-Windows-x64/`; vedere [INSTALLERS.md](INSTALLERS.md).
Contiene il wrapper manifest aggiornato da Ollama, con gli stessi pesi verificati.
Su un archivio gia' configurato puo' essere necessario controllare e riattivare
il modello, come previsto dalla verifica del digest; nessun cambio automatico.

Il runtime e i pesi scaricati per questa sessione sono isolati in
`.tools/m7-runtime`, esclusa da Git. Nessuna installazione globale, account o
servizio cloud. Non spostare quella cartella se vuoi riutilizzarli.

1. Dal progetto, esegui `powershell -File scripts/Start-LocalAI.ps1`.
   Lo script non installa né scarica software, non ferma servizi esistenti e
   avvia Ollama nascosto con `OLLAMA_NO_CLOUD=1`, host loopback e pesi isolati.
   Per un runtime diverso passa `-OllamaPath` e, se necessario, `-ModelsPath`.
2. Avvia Chronexus (`pnpm desktop` nell'ambiente di sviluppo configurato).
3. Apri una campagna → **Assistente locale** → **Controlla Ollama**.
4. Scegli `qwen3:4b-instruct`, conferma il profilo multilingue con fonti locali
   e premi **Attiva modello locale**. Il modello resta associato al digest.
5. Scrivi una domanda con nomi/termini presenti negli appunti. In modalità
   **Regole D&D locali**, scegli l'edizione e fino a sei voci già aperte nella Wiki.

Per una nuova macchina occorre installare un runtime compatibile e scaricare
esplicitamente il modello, prima dell'uso offline. Con il portable di questa
sessione, avviato come sopra, il comando è:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11434'
& .tools/m7-runtime/ollama/ollama.exe pull qwen3:4b-instruct
```

Su macOS/Linux impostare `OLLAMA_NO_CLOUD=1` e `OLLAMA_HOST=127.0.0.1:11434`
prima di avviare `ollama serve`. Queste piattaforme non sono state provate qui.
Runtime vecchi che non espongono lo stato cloud verificabile vengono rifiutati.
Consulta la [configurazione ufficiale](https://docs.ollama.com/faq).

## Confini di sicurezza e qualità

- Adapter Rust con host fisso `http://127.0.0.1:11434`, proxy e redirect esclusi.
  React usa solo comandi Tauri: nessun nuovo host nella CSP, account o telemetria.
- `/api/status` deve confermare cloud disabilitato; `/api/show` deve confermare
  GGUF senza inoltro remoto e SHA-256 dei pesi; digest manifest fissato al consenso.
- Precaricamento **senza appunti**, poi verifica `/api/ps`. CPU esclusiva bloccata
  prima dell'invio delle fonti; GPU/CPU mista dichiarata. GPU non dedotta dal nome.
- Una generazione alla volta, timeout, NDJSON limitato, cancellazione e salvataggi
  parziali. Navigazione/chiusura annullano e attendono la conservazione della bozza.
- Retrieval FTS5 della sola campagna: sessioni, pagine, Party, scheda e asset.
  Nomi/alias noti restringono i risultati pertinenti; non sono inferenze nel grafo.
  Fino a otto estratti di 1200 caratteri; riepilogo/blocco non duplicati come prove.
  Prompt complessivo limitato conservativamente a 7000 byte, prima del runtime.
- Non è una lettura integrale della campagna, un motore D&D o una ricerca semantica.
  Con poche parole comuni o appunti non trovati può mancare una risposta presente
  altrove. Riformulare con nomi e alias precisi e controllare gli estratti forniti.
- Regole soltanto dalla cache Wiki selezionata: 5e-2014, 5e-2024, 3.5 separate.
  Nessuna ricerca online automatica per rispondere, nessuna raccolta di manuali
  commerciali. Testo ritagliato dichiarato dalla copia effettivamente fornita.
- Fonti con ID stabile, blocco (anche Logseq), titolo, revisione e hash; copie
  immutabili conservate con la risposta. Citazioni riaprono la fonte, distinguendo
  versione attuale, modificata o mancante. Nessuna citazione a ID non forniti accettata.
- Le istruzioni nei documenti sono dati, non comandi. Nessun tool o accesso del
  modello a DB, file o shell. Non modifica mai appunti, relazioni, contatori o asset.
- Un gate lessicale prudente esclude estratti con segnali espliciti di istruzioni
  rivolte al modello prima dell'invio e ne mostra il numero. Le altre fonti pulite
  restano utilizzabili; se tutte sono sospette la richiesta si ferma e conserva
  le copie per revisione. Metadati registrano gli ID esclusi e l'invio del contesto.
  Possibili falsi positivi e attacchi non riconosciuti: non è una difesa infallibile.
- Il controllo delle citazioni è strutturale, **non verifica la verità**. Il modello
  può essere prolisso, interpretare male un dubbio o citare una fonte poco pertinente.
  Una risposta con errore resta una bozza non verificata, visibile per controllo.

## Persistenza e portabilità

Migrazione 012 additiva: impostazioni e singole domande/risposte con fonti e metriche.
Massimo 1000 risposte per campagna, cronologia paginata a 50; cancellazione esplicita.
La cronologia non viene usata come fonte o memoria nascosta per nuove risposte.
Riavvio recupera generazioni interrotte. Nessuna scrittura di risposte nel profilo
attivato da un ripristino mentre una vecchia generazione è ancora in corso.

Backup `.nodex`: include conversazioni, fonti, configurazione/digest nel DB e nel
manifest; **esclude runtime e pesi**. Export ZIP: `assistantConversations` in JSON
e Markdown per risposta, con copie/hash delle fonti. Vecchi backup migrati in copia;
nuovi backup richiedono versione compatibile con schema 012. Identificatori legacy
conservati. Mancanza del runtime non impedisce consultazione o ripristino delle note.

## Verifiche e ripetizione

Test Rust: isolamento campagne, nomi/alias, blocchi/rinomine, Party, edizioni,
limiti, protocollo HTTP/redirect/cloud, citazioni non valide, persistenza, recovery,
backup/restore ed export. Test React: consenso, nessun contatto runtime all'apertura,
streaming/cancellazione/guardia, fonti cambiate ed eliminazione confermata.

Benchmark finale: 40/40 scenari con esito atteso, ossia 20 campagna, 10 regole
originali di prova in conflitto fra edizioni e 5 domande senza risposta con
inferenza GPU reale; 5 istruzioni malevole bloccate prima del modello. Dati canonici
invariati. Non significa accuratezza universale: le prime prove senza gate hanno
mostrato citazioni inventate, ripetizione degli attacchi e dubbi fuorvianti.
Con contesto 8192: tempi osservati 365–3060 ms, media circa 1499 ms sulle 35
domande dell'ultima esecuzione; carico GPU e primo avvio possono cambiarli.
Verificati 63 test Rust, 55 React, cancellazione dopo token GPU e ripristino/riavvio
di 90 conversazioni con fonti senza Ollama. Errori OOM/CPU simulati, non guasti fisici.
`node scripts/qa/local-ai-evaluation.mjs` richiede `CHRONEXUS_AI_QA=isolated`, profilo
debug **vuoto** `NODEX_DEV_DATA_DIR`, CDP 9223, Vite 1420 e Ollama configurato.
Crea soltanto campagne fittizie; risultati in `.tools/m7-runtime`. I controlli di
parole chiave sono una prima misura: revisionare anche risposte/citazioni; non
scambiare una citazione formalmente valida per accuratezza semantica.

La prova locale con cloud disabilitato, proxy esterni non raggiungibili e controllo
delle connessioni non equivale a rete fisicamente scollegata o blocco firewall.
Quest'ultima verifica e i pacchetti macOS/Linux restano da eseguire; non alterare
la connettività del computer o i processi dell'utente per completare un test.

Fonti primarie consultate il 23 ottobre 2026:
[Ollama API](https://docs.ollama.com/api/introduction),
[GPU e configurazione](https://docs.ollama.com/faq),
[release portable](https://github.com/ollama/ollama/releases/tag/v0.40.10),
[modello e licenza](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507).
