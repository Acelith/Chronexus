# Aggiornamento M18

Traduttore `wiki-translation-v2`: Qwen3.8-27B principale, Gemma secondaria
esplicita. Le vecchie copie v1 rimangono dati validi nei backup; non sono
riutilizzate come risultati del nuovo modello. Cambiare modello non genera
automaticamente una traduzione: serve il pulsante. La cache derivata conserva
una copia per voce/lingua; una nuova traduzione può sostituire soltanto questa
copia, mai l’originale. Tutte le traduzioni rimangono bozze da verificare.

# Traduzione locale della wiki — M17

Apri una voce in **Wiki D&D**, quindi premi **Traduci in [lingua dell’app]**.
La lingua si cambia nelle impostazioni generali. Wikidot e Open5e mantengono
ricerca e identificativi originali: questa funzione traduce la voce aperta,
non un intero catalogo né i termini della ricerca.

La prima traduzione richiede Ollama avviato con `OLLAMA_NO_CLOUD=1`, il modello
locale `qwen3.8:27b-q4_K_M` già installato e una GPU disponibile. Dal selettore
**Modello per la traduzione** puoi scegliere esplicitamente **Gemma 4 12B · Secondario**.
Il 27B usa GPU e RAM insieme sul sistema qualificato. Chronexus non
avvia il runtime e non scarica pesi. Se mancano questi requisiti, mostra un errore
e lascia leggibile l’originale. Le traduzioni già salvate si leggono senza modello
o rete, finché l’originale è ancora nella cache e non è cambiato.

## Qualità e originale

Le traduzioni sono **bozze automatiche**, non traduzioni ufficiali delle regole.
Nomi e termini tecnici possono essere imprecisi: confronta sempre l’originale,
disponibile con **Mostra originale**. Fonte, edizione, licenza, origine UA/homebrew
e titolo originale restano visibili; nessuna equivalenza fra edizioni è dedotta.
I controlli rifiutano risposte incomplete e sequenze numeriche alterate, ma non
certificano negazioni, unità, terminologia o interpretazione delle regole.

Sono disponibili le lingue naturali dell’app. L’inglese conserva l’originale;
il ticinese richiede revisione madrelingua come i cataloghi M10. Klingon e
Romulano dichiarano il fallback; Morse, Braille, SGA, Espruar e Dethek restano
scritture dell’interfaccia e non destinazioni di traduzione delle regole.

L’importazione degli incantesimi continua a usare i dati originali, aprendo il
modulo modificabile esistente. Nessuna traduzione riscrive incantesimi salvati,
appunti, schede, citazioni o conoscenze della campagna.

## Confini tecnici

- Rust legge soltanto voci già consultate dalle cache M16/Open5e. Il comando non
  accetta testo libero, URL, prompt o contenuti della campagna. Il solo modello
  facoltativo è una delle due identità base qualificate in `src/ai-models.json`;
  nessun adapter, modello arbitrario o ripiego automatico.
- Connessione fissa `127.0.0.1:11434`, senza proxy/redirect; controlli esistenti
  cloud disabilitato e formato GGUF. Pesi Qwen approvati SHA-256
  `f5f1dd8920d417aac2718b0bda3403da274301efdd6760b4f0f4b864ff2ad57d`.
  Digest Gemma e qualifica in [AI_MODELS.md](AI_MODELS.md).
  Identità wrapper corrente registrata nella copia; preflight GPU prima del testo.
- Nessun retrieval o adapter di campagna, training, tool o cronologia del modello.
  Testo della wiki come dati non attendibili; risultato sempre testo React inerte.
- Una sola operazione AI alla volta con il blocco condiviso di assistente/training
  e updater. Annullamento, abbandono vista e cambio lingua scartano le risposte.
- Limiti: 24.000 byte di testo, 500 frammenti, batch di 1.800 byte, 2.048 token
  di output per batch, 240 secondi totali. Le pagine troppo lunghe restano originali;
  niente traduzioni parziali salvate o tentativi automatici.

## Cache e backup

Migrazione additiva 017: `wiki_translations` nel medesimo Store SQLite. Chiave
provider/voce/lingua, hash del contenuto originale completo e revisione del
traduttore, modello/digest e data. Al massimo 100 copie da 256 KiB, indipendenti
da campagne e impostazioni AI. Non sono fonti per l’assistente integrato.

La conferma di eliminazione della cache wiki M16 include anche le traduzioni
del provider scelto. Nessuna preferenza, importazione o campagna viene eliminata.
Prima di scrivere si ricontrollano hash, epoch cache, generazione di ripristino e
lingua: risultati diventati obsoleti vengono scartati.

I backup 017 includono e validano le copie tradotte. I precedenti backup restano
ripristinabili e vengono migrati; una build precedente non apre uno schema 017.
Conservare i backup precedenti all’aggiornamento, senza downgrade automatici.
M18 rimane una successiva qualifica separata del modello sostitutivo.
