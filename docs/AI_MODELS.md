# Modelli locali correnti — M18

Qwen3.8-27B è il modello principale per assistente, traduzione wiki e strumento
locale di traduzione delle stringhe. Gemma 4 12B è l’opzione secondaria più rapida
e rimane l’unica base qualificata per il training M8. Entrambi sono multilingui,
non addestrati specificamente per D&D. Nessun servizio AI esterno viene chiamato.

## Preparazione esplicita

Installa un runtime Ollama compatibile, avvialo con cloud disabilitato e scarica
soltanto il modello scelto prima dell’uso offline:

```powershell
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_HOST = '127.0.0.1:11434'
ollama serve
# In un altro terminale, sullo stesso runtime:
ollama pull qwen3.8:27b-q4_K_M
# Opzionale, solo se vuoi l’alternativa:
ollama pull gemma4:12b
```

Il download del 27B qualificato comprende circa 17,74 GB di pesi/proiettore.
Prevedere spazio anche per runtime, temporanei e dati; nessun peso è incluso
nell’installer app, in Git o nei backup. Ollama verifica i blob scaricati;
Chronexus controlla l’identità locale approvata prima di inviare il contesto.
Se un tag cambia pesi, non è automaticamente approvato: occorre una nuova qualifica.

Nell’app premi **Controlla Ollama e GPU**, scegli il modello, conferma il consenso
e attivalo per la campagna. Gemma già attiva rimane tale; non viene sostituita
silenziosamente. Le vecchie scelte Qwen vengono disabilitate dalla migrazione
018, lasciando nome, digest, conversazioni e citazioni intatti. I backup 017
restano ripristinabili; uno schema 018 richiede questa versione o successiva.

La wiki ha un selettore indipendente, con Qwen principale e Gemma secondaria:
serve sempre **Traduci** per generare. Nessun modello alternativo viene tentato
automaticamente. Le copie già generate si leggono senza runtime. Le copie v1
storiche restano nell’archivio, ma non vengono attribuite al nuovo modello.

## Identità e provenienza

Fonti verificate il 25 ottobre 2026: [checkpoint ufficiale Qwen](https://huggingface.co/Qwen/Qwen3.8-27B),
[tag ufficiali Ollama](https://ollama.com/library/qwen3.8/tags).
Licenza Qwen dichiarata Apache-2.0. Si usa il tag **non MTP**
`qwen3.8:27b-q4_K_M`, solo testo, senza immagini/OCR né ragionamento esposto.
La policy condivisa è `src/ai-models.json`; gli hash qualificati sono:

| Modello | Identità | SHA-256 |
| --- | --- | --- |
| Qwen3.8-27B | Manifest Ollama | `25b843619e944cd0ae6069f94ff4e5e26a16e109ccbc0a66a0f05979ed70098e` |
| Qwen3.8-27B | GGUF, 16.810.714.464 byte | `f5f1dd8920d417aac2718b0bda3403da274301efdd6760b4f0f4b864ff2ad57d` |
| Qwen3.8-27B | Proiettore, 931.146.016 byte | `ac3714bfdddeca31351f2752bf1a63f266f4df87c0b68c895e44945ca704448e` |
| Gemma 4 12B | Manifest Ollama | `6114515d63c17436a7c0417d82820ac65ad643e2806c5a3c89cb62846436ed0b` |
| Gemma 4 12B | GGUF | `bb722270d54346adc198f213851dbe0207e87c3ecf2a0aff4d92262726215391` |

Il GGUF Qwen è stato riletto e verificato anche indipendentemente con SHA-256.
Provenienza/licenza Gemma e checkpoint QLoRA restano in [AI_TRAINING.md](AI_TRAINING.md).
Qwen3.8-Max non è questo modello e non è supportato.

## Qualifica Windows effettiva

RTX 4080 SUPER 16 GB, RAM 61,6 GiB (circa 31 GiB liberi all’avvio), Ollama
0.40.10. Con Q4_K_M, contesto 8192, batch 256 e **48 layer GPU**, il runtime
riporta 17.628.533.879 byte caricati di cui 12.211.349.093 GPU: esecuzione
**mista GPU/RAM**, mai presentata come interamente GPU. `nvidia-smi` misura
circa 12,7 GB usati e 3,3 GB liberi durante la prova. Altri carichi riducono il
margine. Configurazione 99 layer scartata: pressione di memoria e 105,104 s
per una risposta breve; il confronto completo usa soltanto il profilo 48.

| Prova con fonti sintetiche identiche | Qwen 27B, 48 layer | Gemma 12B, 99 layer |
| --- | --- | --- |
| 20 campagna, 10 regole/edizioni, 5 assenze | 35/35 | 35/35 |
| Mediana risposta breve | 3,016 s | circa 0,27 s |
| p95 risposta breve | 4,570 s | circa 0,51 s |
| Caricamento con cache disco calda | 4,568 s | 4,439 s |
| Benchmark completo tramite app | 40/40 | 40/40 |

I cinque casi aggiuntivi di istruzioni malevole vengono bloccati dall’app prima
dell’inferenza. Citazioni valide, separazione campagna/edizione e dati canonici
invariati; nessun ragionamento esposto. Non è una valutazione generale delle
conoscenze o una garanzia di correttezza delle regole. `/api/ps` di Gemma MTP
riporta solo la componente draft: non usarlo come consumo VRAM totale.

Traduzioni sintetiche Qwen italiano/tedesco/arabo: numeri, negazione e raggio
conservati dopo una correzione del prompt (la prima resa araba confondeva raggio
e diametro). Il controllo numerico non certifica il significato: tutte restano
bozze. Gemma ha prodotto una prima risposta italiana con un numero aggiuntivo,
correttamente rifiutata; nessun indebolimento del controllo. QA wiki nell’app:
italiano, originale intatto, cache senza runtime, annullamento/cache clear e axe
0 violazioni. Non equivale a una prova fisica senza rete/firewall.

## Ripetibilità e confini

`scripts/qa/local-ai-evaluation.mjs` usa profili sintetici vuoti isolati,
`CHRONEXUS_AI_QA=isolated`, porta CDP 9227; per il confronto scegliere
esplicitamente `CHRONEXUS_TEST_MODEL=gemma4:12b`. Il report esclude dati reali.
`scripts/qa/m18-migration.mjs` ripristina soltanto il backup sintetico schema
017 preparato nel collaudo e verifica disattivazione, storia/citazioni, consenso,
Gemma conservata e abilitazione training. Fixture e report sono fuori Git.

Loopback fisso, niente proxy/redirect/cloud fallback, preflight GPU prima del
testo. CPU sola, runtime/modello assente, cloud non verificato o identità cambiata
producono errore. In caso di memoria insufficiente non cambiare modello in
automatico. Refresh retrieval rimane distinto dall’addestramento; QLoRA Qwen
non qualificato. Altre GPU, macOS/Linux, installazione reale e prova fisica
offline restano pendenti.


## Installazione guidata (M22)

**Impostazioni dell’app → AI locale: componenti** permette, sempre dopo un clic:
controllo dei componenti; installazione di Ollama 0.40.10 dall’archivio ufficiale
GitHub con SHA-256 `d52aea2d323bdd324bf66a4b1226844aa5fb665cc5974fbcceceda1ce3d934eb`
(1.586.229.413 byte) in `ai-runtime/ollama-0.40.10` della cartella dati; avvio e
arresto del runtime gestito (si chiude con Chronexus, `OLLAMA_NO_CLOUD=1`, modelli in
`ai-runtime/models`); download del solo modello scelto tramite il runtime attivo,
dichiarato pronto solo con i pesi qualificati. Un runtime già attivo e senza cloud
viene usato senza riavviarlo o riconfigurarlo. Installare non abilita l’assistente:
la scelta resta nelle impostazioni della campagna. QLoRA resta su Gemma e i suoi
componenti non sono scaricati qui.
