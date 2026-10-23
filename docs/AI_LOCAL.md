# M7 — Assistente D&D locale sulla GPU

Stato: **M7 in implementazione su successiva richiesta esplicita dell'utente**.
Adapter Rust, schema 012, retrieval e UI presenti; valutazione in corso.
Il candidato D&D è stato provato realmente su GPU e scartato per qualità.
L'utente ha approvato il modello multilingue con fonti locali e citazioni.
Modello attuale: Qwen3:4b-instruct Q4_K_M, non fine-tuned su D&D.

## Risultato atteso

Una sezione Assistente che risponde in italiano su campagna, sessioni, Party,
oggetti e regole D&D selezionate. Le risposte devono citare pagine e blocchi
riapribili nell'app, distinguere fatti annotati, affermazioni dei personaggi e
ipotesi, e dire quando le fonti non permettono una risposta. Il modello resta
un assistente del giocatore: niente segreti del GM o eventi inventati.

## Runtime locale e GPU

- Adapter Rust per Ollama su `127.0.0.1:11434`, con possibilità futura di un
  adapter llama.cpp equivalente. Nessun endpoint cloud o LAN arbitrario.
- Funzionalità disattivata inizialmente; attivazione e selezione modello esplicite.
  Nessuna installazione automatica di Ollama, driver o pesi.
- Ollama supporta anche modelli cloud: il solo indirizzo loopback non garantisce
  elaborazione locale. Richiedere runtime configurato senza cloud, verificare
  identità/digest e presenza locale dei pesi, rifiutare modelli remoti e testare
  l'assenza di connessioni esterne durante l'inferenza. Consultare la versione
  corrente della configurazione ufficiale prima di implementare.
- Rilevare modello, memoria/contesto e caricamento GPU reale tramite stato del
  runtime (`ollama ps` / API equivalente). Mostrare GPU/CPU/misto; un fallback
  CPU non deve essere presentato come GPU. Se la modalità richiesta è GPU,
  bloccare con spiegazione quando l'accelerazione non è disponibile.
- Streaming cancellabile, timeout, limiti di contesto/output e concorrenza uno.
  UI utilizzabile durante inferenza; annullamento non deve bloccare l'autosave.

Hardware rilevato in questa sessione: NVIDIA RTX 4080 SUPER, 16.376 MiB di VRAM,
driver 621.01 (`nvidia-smi`). È un dato locale, non un requisito universale.
Entrambi i modelli 1.5B e Qwen3 4B sono stati caricati interamente su GPU.
Risultati e limiti finali verranno registrati al termine della verifica.

## Specializzazione D&D obbligatoria quando disponibile

La ricerca ha trovato candidati specifici: **non sostituire silenziosamente
questa richiesta con un modello generico**. Verificare nuovamente schede,
licenze dei modelli base/dataset, hash e compatibilità al momento dell'implementazione.

| Candidato verificato come esistente | Valutazione per M7 |
| --- | --- |
| [chendren/dnd-unified-1.5b](https://huggingface.co/chendren/dnd-unified-1.5b), [GGUF di mradermacher](https://huggingface.co/mradermacher/dnd-unified-1.5b-GGUF) | Primo candidato da provare: specializzazione D&D dichiarata, inglese, licenza Apache-2.0 dichiarata. Mescola dati 5e/3.5 e ha valutazioni dell'autore non indipendenti; non è un motore di regole affidabile già dimostrato |
| [Dungeons-and-Dragons-V1.3-LLaMa-70B](https://huggingface.co/TareksGraveyard/Dungeons-and-Dragons-V1.3-LLaMa-70B), [GGUF](https://huggingface.co/mradermacher/Dungeons-and-Dragons-V1.3-LLaMa-70B-i1-GGUF) | Esistente e dedicato al tema; dimensione e licenze richiedono verifica. Non scelto come default full-GPU sui 16 GB rilevati |

Un modello con “DND” nel nome non è necessariamente specializzato nelle regole:
le schede di alcuni risultati descrivono semplice modifica del comportamento o
roleplay. Non trattarli come esperti D&D. Il modello 1.5B è un candidato da
valutare, non una raccomandazione con accuratezza o italiano già dimostrati.
Il candidato 1.5B ha fallito le prove; la scelta dell'alternativa multilingue è
stata chiesta e approvata dall'utente prima di procedere. Resta necessario
completare la valutazione dell'integrazione prima di dichiarare M7 conclusa.

## Contesto, fonti e dati

- Retrieval locale sui dati canonici della **sola campagna selezionata**:
  ricerca FTS5, blocchi di sessioni/pagine, membri Party, scheda e asset.
  Chunk con UUID/blocco/revisione, limiti espliciti; non inviare l'intero archivio.
- Eventuali embeddings/reranker devono girare localmente; introdurli soltanto se
  una valutazione ne giustifica la dipendenza. Indice derivato ricostruibile.
- Modalità distinte “Campagna” e “Regole D&D”. Regole solo da fonti lecite già
  consultate/scelte dall'utente, con edizione 2014/2024/3.5 e materiale personale
  chiaramente separati. Il training non prevale sulle fonti selezionate.
- Nessuna deduzione modifica automaticamente Codex, grafo, scheda o inventario.
  Eventuali proposte richiedono revisione e salvataggio espliciti, con origine.
- Appunti, sorgenti, API, foto e istruzioni dentro ai documenti sono dati non
  attendibili come comandi. Non eseguire tool, codice o istruzioni recuperate.
- Citazioni aprono il blocco corretto e sopravvivono a rename. Se una fonte è
  cambiata o mancante, segnalarlo. Le conversazioni persistenti appartengono
  all'utente e devono avere cancellazione/esportazione/backup definiti.
- Backup include configurazione non segreta e conversazioni eventualmente
  salvate, non i gigabyte dei pesi; manifesto documenta modello/digest richiesti.
  Mancanza di Ollama non impedisce apertura o ripristino delle campagne.

## Parti verificabili

1. M7.1 — scelta modello D&D/licenze, rilevazione runtime/GPU e benchmark locale.
2. M7.2 — retrieval con fonti stabili e risposte citate in sola lettura.
3. M7.3 — UI streaming/cancellazione/errori, privacy, salvataggio e backup.

## Accettazione

- Modello D&D locale realmente caricato sulla GPU: registrare modello/digest,
  quantizzazione, contesto, VRAM, tempi e stato CPU/GPU osservati.
- Almeno 20 domande campagna con risposte attese ancorate a blocchi, 10 domande
  di regole con edizioni in conflitto, 5 domande senza risposta e 5 tentativi
  di istruzioni malevole nei documenti. Verificare attribuzione e non invenzione.
- Testare isolamento fra campagne, sessioni rinominate, fonti modificate,
  runtime assente, modello mancante, memoria insufficiente, annullamento,
  riavvio, backup e restore. Nessuna scrittura implicita di fatti o contatori.
- Prova con rete esterna disabilitata e controllo delle connessioni: inferenza,
  retrieval e fonti locali funzionano senza upload o fallback cloud.
- Test di parsing/protocollo possono usare un runtime simulato, ma il successo
  GPU e la qualità delle risposte richiedono prove reali, mai dedotti dai mock.

Fonti primarie consultate il 23 ottobre 2026:
[API Ollama](https://docs.ollama.com/api/introduction),
[hardware](https://docs.ollama.com/gpu),
[import GGUF](https://docs.ollama.com/import),
[verifica caricamento GPU](https://docs.ollama.com/faq).
