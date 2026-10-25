# Stato corrente M18

Qwen3.8-27B è principale per l’inferenza; Gemma 4 12B rimane secondaria e
**l’unica base qualificata per QLoRA**. Con Qwen il pulsante di riaddestramento
è disattivato con spiegazione, anche se il worker è installato. L’attivazione
di un adapter Gemma resta esplicita, limitata alla campagna e alle fonti valide.
Nessun training del 27B viene promesso o eseguito. [Qualifica](AI_MODELS.md).

# M8 — Gemma e apprendimento della campagna

M8 introduce **Gemma 4 12B** locale e impostazioni AI per singola campagna.
Il modello è multilingue: non lo presentiamo come un modello addestrato
specificamente per D&D. Le risposte continuano a usare le fonti locali con
citazioni; né il modello base né un adapter diventano fonti di fatti.

## Modelli e runtime verificati

- Inferenza: Ollama 0.40.10, `gemma4:12b`, Gemma 4 Unified 11.9B Q4_K_M.
  Il checkpoint è disponibile nel [catalogo Ollama](https://ollama.com/library/gemma4:12b)
  e descritto dalla [documentazione Google](https://ai.google.dev/gemma/docs/core).
- Pesi GGUF qualificati per il merge:
  `bb722270d54346adc198f213851dbe0207e87c3ecf2a0aff4d92262726215391`.
  Un aggiornamento del tag richiede una nuova qualifica: non accettiamo pesi
  diversi soltanto perché hanno lo stesso nome.
- Training: checkpoint Google `google/gemma-4-12B-it`, revisione
  `707f0a3b8a3c7ad586ed01e27eafbad8a27dd0f7`, SHA-256 del safetensors
  `5a84cb313260ac447237b890387116dfa8682e49a6b44bc585ae8353abbff18d`.
  Il file pesa 23.919.549.408 byte; non entra nel backup delle campagne.
- La versione Ollama verificata ha rimosso il supporto diretto agli adapter:
  vedere `CreateRequest.Adapters` nel [codice del runtime](https://github.com/ollama/ollama/blob/v0.40.10/api/types.go).
  Chronexus conserva l'adapter compatto e ne applica gli aggiornamenti a una
  copia GGUF per l'inferenza. I tensori non interessati rimangono invariati;
  quelli aggiornati sono salvati F16. Il modello base resta immutabile.
- Il caricamento Gemma usa batch 256: il precedente batch 64 di Qwen provocava
  un errore del proiettore multimodale nel runtime verificato. Nessun OCR o
  invio di fotografie al modello è introdotto da M8.

## Uso nell'app

1. Avviare Ollama locale con cloud disabilitato, come descritto in
   [AI_LOCAL.md](AI_LOCAL.md). Il setup esplicito del modello è
   `ollama pull gemma4:12b`, sul runtime scelto, prima dell'uso offline.
2. Aprire la campagna → **Impostazioni della campagna** → **AI locale**.
   Controllare Ollama, scegliere Gemma, confermare il modello multilingue e
   attivarlo per quella campagna. Qwen3.8-27B è la prima scelta per l’inferenza;
   il precedente Qwen3 4B è ritirato.
3. Scegliere edizione, tipi di appunti, fonti Wiki approvate e limiti di
   contesto/risposta. Salvare. Le fonti escluse non entrano né nelle domande
   né nel training. Le fonti Wiki devono essere già locali e della stessa
   edizione. La sezione Assistente usa questa selezione.
4. **Aggiorna conoscenze** ricostruisce la ricerca derivata e registra le
   impronte delle fonti. Non modifica pesi o adapter. Il retrieval continua
   a leggere gli appunti correnti anche fra due aggiornamenti manuali.
5. **Riaddestra sui nuovi dati** mostra le differenze rispetto all'ultimo
   addestramento riuscito, poi chiede conferma. Utilizza lo snapshot corrente
   completo delle fonti approvate, anziché accumulare dati obsoleti nel vecchio
   adapter. Un'anteprima cambiata nel frattempo viene rifiutata dal backend.
6. Preparazione, training, importazione e validazione hanno stati distinti.
   Soltanto i passaggi effettivi del training hanno un contatore. È possibile
   annullare; la navigazione attende l'annullamento prima di cambiare pagina.
7. Dopo le verifiche compare **Attiva adapter**. L'addestramento da solo non
   cambia il modello attivo. Per tornare indietro si sceglie il modello base,
   oppure un adapter precedente ancora compatibile con le fonti correnti.

Aprire le impostazioni legge solo SQLite. Non avvia download, inferenza,
training o richieste al runtime. L'unico endpoint usato dall'app è il loopback
Ollama già previsto in M7; non ci sono fallback cloud.

## Preparazione facoltativa del backend

Il training richiede un ambiente separato; il pulsante resta disabilitato se
mancano i file necessari. L'installer M7 già generato non contiene questo
ambiente, il checkpoint Google o la nuova build M8.

Su Windows con Python 3.12 e GPU NVIDIA CUDA:

```powershell
powershell -File scripts/Setup-Training.ps1 -PythonPath "C:\percorso\Python312\python.exe"
```

Lo script installa le dipendenze nel solo ambiente
`%APPDATA%/it.nodex.desktop/ai-training/venv` e scarica la revisione fissata in
`hf-base`. Non installa servizi globali. La preparazione richiede rete e
diverse decine di GB liberi; avviare poi il training resta un'azione distinta.
Lo script non va eseguito da un allegato della campagna.

Versioni: PyTorch 2.14.1+cu130, Transformers 5.20.2, PEFT 0.21.2,
bitsandbytes 0.50.2; dipendenze in `scripts/ai/requirements.txt`.
Licenze verificate sui metadati e file LICENSE delle versioni installate:
Transformers/PEFT/Accelerate e safetensors Apache 2.0, bitsandbytes e gguf MIT,
psutil BSD-3-Clause; PyTorch include più licenze permissive elencate nel suo
pacchetto. Il [checkpoint Google](https://huggingface.co/google/gemma-4-12B-it)
è Apache 2.0. Le licenze rimangono nell'ambiente isolato; il nuovo installer
app non ridistribuisce queste librerie o i pesi.

Il worker distribuito con l'app usa solo file locali, `trust_remote_code=False`,
cache Hugging Face offline e telemetria disabilitata. Non esegue istruzioni
contenute negli appunti. Il worker termina anche se scompare il processo
Chronexus che lo ha avviato.

In debug, `CHRONEXUS_TRAINING_HOME` può indicare un ambiente isolato; l'override
non esiste nelle build di rilascio. Windows NVIDIA è la piattaforma provata;
CUDA non disponibile produce un errore, senza fallback CPU/cloud. Training
macOS, altri acceleratori e Linux non sono ancora verificati.

## Cosa apprende l'adapter

Il profilo iniziale usa QLoRA NF4, rango 4, alpha 8, proiezioni q/output degli
ultimi quattro blocchi (44–47), da 8 a 8000 passaggi. Il testo di ogni estratto viene diviso in finestre di
64 token, senza tagliare silenziosamente le code; ogni frammento entra nel
training almeno una volta. Oltre 8000 frammenti il job viene rifiutato, chiedendo
di ridurre le fonti, anziché addestrare solo i primi esempi. Gli esempi insegnano a
riportare gli appunti citandoli e mantenendo le affermazioni come testimonianze.
Non è un addestramento completo di tutti i pesi, né prova di memorizzazione
affidabile di un'intera campagna. Loss e cambiamento dei tensori non dimostrano
da soli una maggiore accuratezza: servono verifiche delle risposte.

Sono esclusi conversazioni AI, immagini e originali Logseq come canali separati.
Vengono usati solo gli estratti correnti supportati, con limiti di dimensione
e provenienza. Gli estratti con segnali espliciti di istruzioni al modello
bloccano il training finché vengono esclusi o separati dal testo narrativo.
Questa guardia non è una garanzia semantica assoluta.

Se cambia un estratto o la selezione delle fonti, un adapter precedente non
può essere usato per nuove domande finché non si riaddestra o si torna al
modello base. Non pretendiamo che il training incrementale possa cancellare
automaticamente quanto appreso in precedenza.

## Persistenza, backup e recupero

- Schema 013: impostazioni e impronte delle conoscenze per campagna. Conserva
  la scelta esplicita M7 per le campagne esistenti; nuove campagne disattivate.
- Schema 014: cronologia del training, modello base, impronte delle fonti,
  configurazione, metriche, esito, adapter e checksum.
- Adapter safetensors e relativa configurazione sono allegati gestiti della
  campagna, con UUID e hash. Il backup verifica proprietà e integrità; un file
  mancante o modificato ferma il backup/ripristino. Restano i limiti degli
  archivi: 256 MiB per file e 512 MiB complessivi; adapter M8 massimo 64 MiB.
- Pesi base, ambiente Python, dataset di lavoro, registri e copie GGUF derivate
  restano fuori dal backup ordinario e da Git. I file temporanei stanno nella
  cartella `ai-training/jobs`; non sono gli appunti canonici.
- Dopo il ripristino, **Attiva adapter** ricostruisce localmente i pesi derivati
  se mancano in Ollama, usando l'adapter salvato e lo stesso GGUF base. Ripete
  la validazione prima di attivare; richiede l'ambiente locale e il modello base,
  senza download automatici o nuovo addestramento.
- Un job interrotto viene segnalato al riavvio. Nessun job fallito o annullato
  sostituisce il modello attivo. I backup precedenti vengono migrati in copia.

## Evidenza e limiti

La prova Windows sulla RTX 4080 SUPER 16 GB ha completato realmente otto
passaggi su quattro estratti sintetici: tensori adapter modificati, picco
11.705.906.688 byte allocati da PyTorch (circa 10,9 GiB). Merge e importazione
Ollama riusciti; tre verifiche di risposte/citazioni/GPU prima dell'attivazione.
Una domanda senza fonte sul colore del mantello di Arven non ha ottenuto un
fatto inventato; dopo aggiunta dell'appunto, training e attivazione, la risposta
ha riportato **indaco** con citazione. Sono prove su dati sintetici, non una
garanzia di qualità su qualunque campagna.

Il confronto iniziale ha eseguito quattro casi con Qwen e gli stessi quattro
con Gemma nell'app, tutti con esito atteso. Il conteggio VRAM di `/api/ps` del
runtime con draft MTP non descrive sempre tutto il modello: i log di offload
e le misure GPU sono evidenze distinte. Non interpretare il solo rapporto tra
`size_vram` e `size` come misura completa della memoria fisica.

Verifiche ulteriori, checkpoint corrente e limiti di accettazione sono in
[STATUS.md](STATUS.md). La prova fisica offline/firewall e macOS/Linux restano
separate dalle opzioni offline delle librerie e dalle osservazioni loopback.


Ulteriore prova reale: 74 estratti sintetici, 74 esempi e 74 passaggi GPU, con
controllo di copertura, attivazione e domanda sull'ultima fonte riusciti. Il
profilo originale di collaudo è stato poi ripristinato. Il limite precedente
di 64 passaggi, scoperto in revisione, è stato corretto e coperto da regressione.


## Ripetere i controlli nativi

Solo su un profilo debug isolato e inizialmente vuoto sotto `.tools/`, con
Ollama cloud-off, Qwen/Gemma installati e backend preparato. Avviare Vite e
Chronexus debug con `NODEX_DEV_DATA_DIR` assoluta, WebView separata e porta
debug 9223; il worker può usare `CHRONEXUS_TRAINING_HOME` in debug. Impostare
`NODEX_DEV_BACKUP_FILE` e `NODEX_DEV_RESTORE_FILE` sullo stesso nuovo file
`.tools/m8/native-trained.nodex`, mai su backup personali.

Impostare `CHRONEXUS_AI_QA=isolated`, poi eseguire separatamente:

```sh
node scripts/qa/m8-local-ai.mjs seed
node scripts/qa/m8-local-ai.mjs train
node scripts/qa/m8-local-ai.mjs recover
node scripts/qa/m8-local-ai.mjs boundaries
node scripts/qa/m8-local-ai.mjs coverage
```

Avviare nuovamente la stessa app isolata prima di ogni fase; `recover` verifica
anche il riavvio. `seed` richiede un archivio vuoto; le fasi seguenti controllano
i nomi della fixture. `recover` e `coverage` rimuovono soltanto modelli derivati
della fixture per provare ricostruzione e pulizia; non usare su dati personali.
I rapporti e le schermate restano in `.tools/m8`, non in Git. L'installer M8
contiene il worker aggiornato ma non i pesi o il backend CUDA; l'installazione
M8 non è stata ripetuta.
