# M9 — Tiradadi e cerchio dei draghi

Apri una campagna e scegli **Tiradadi** nel menu sinistro. Aggiungi dadi cliccando
la loro figura o i pulsanti +/−, oppure scrivi la quantità. Sono disponibili
d4, d6, d8, d10, d12, d20 e d100; si possono combinare nello stesso tiro.
Il d100 dà un intero da **1 a 100**, compresi gli estremi: lo zero non è un risultato.

## Comporre e tirare

Massimo 50 dadi per tipo e 100 complessivi. Le quantità devono essere intere,
non negative, con almeno un dado selezionato. La composizione è mostrata prima
del tiro. **Tira i dadi** registra i risultati in SQLite prima di avviare la scena;
solo dopo la conferma le quantità diventano tutte zero. Un errore conserva la
selezione: riprovare con la stessa composizione riusa l’ID della richiesta.

Mentre il tiro viene registrato o animato non se ne può avviare un secondo.
La chiusura normale aspetta la registrazione in corso. Una scena interrotta,
un cambio vista o un riavvio lasciano il tiro consultabile nelle cronache.

La sequenza dura circa 2,5 secondi: rotolamento, atterraggio, fuoco dei draghi,
rivelazione e cifre a scorrimento rapido. **Salta animazione** mostra subito il
medesimo risultato. Il movimento ridotto del sistema evita rotolamento, fiamme e
scorrimento delle cifre. Il totale non viene anticipato nello storico durante
la scena; il tiro è comunque già salvato. A sequenza conclusa restano valori
stabili, indipendenti dagli effetti grafici.

Nella scena vengono mostrati al massimo 14 dadi, distribuiti fra i tipi scelti.
La quantità reale e tutti i valori, subtotali e totale sono nel dettaglio del
risultato. I numeri 6 e 9 hanno un riferimento inferiore; il tipo è indicato
anche come testo. Per i tiri grandi la durata non cresce con il numero di dadi.

## Cronache, backup ed export

Le cronache appartengono alla campagna corrente e caricano 30 tiri alla volta.
Espandi una riga per leggere tutti i valori; **Mostra nel cerchio** rivede il tiro
senza generarne o registrarne un altro. **Carica tiri precedenti** prosegue lo storico.
La conferma di un tiro è permanente: non è prevista cancellazione/modifica in M9.

Lo storico è incluso nel backup completo `.nodex`, con conteggio e validazione,
e nel campo `diceRolls` dell’export JSON della campagna. Il ripristino accetta gli
archivi precedenti: vengono migrati con storico inizialmente vuoto. La migrazione
additiva **015** aggiunge `dice_rolls` e l’indice di cronologia; documenti e UUID
esistenti non cambiano. Gli archivi 015 richiedono una versione di Chronexus che
supporti questo schema; le versioni precedenti non devono aprirli in scrittura.
Gli asset grafici sono risorse dell’app, non allegati della campagna.

## Casuale, integrità e protocollo

`src-tauri/src/dice.rs` usa parole a 32 bit da `getrandom::fill` (casualità del
sistema operativo). Il rejection sampling scarta la coda non divisibile per il
numero di facce prima del modulo: evita il bias del modulo su parole uniformi.
I test deterministici coprono estremi, scarti e errori; i pochi tiri osservati
non sono presentati come dimostrazione statistica della qualità del generatore.
Le cifre intermedie dell’effetto slot sono soltanto grafica e non estrazioni.

Comandi locali:

- `roll_dice`: `campaignId`, UUID `requestId`, `selections: [{sides, quantity}]`.
  Restituisce UUID, campagna, data UTC, gruppi con valori/subtotali e totale.
  Stesso ID/campagna/composizione restituisce il record precedente senza nuovi
  valori. Un ID riutilizzato con campagna o composizione diversa viene rifiutato.
- `list_dice_rolls`: `campaignId`, `before: null | {createdAt,id}`. Restituisce
  `rolls` e `nextCursor`. Ordinamento stabile per data/ID decrescenti.

Transazione e vincolo univoco garantiscono una sola registrazione. UI e backend
validano quantità e tipi; lettura e ripristino verificano valori, subtotali,
totale e corrispondenza fra payload e colonne. Nessun servizio AI o rete Internet
è richiesto per tirare. Draghi/fuoco/materiale WebP sono inclusi nel pacchetto;
geometrie e cifre sono renderizzate dal codice. Provenienza: `assets/dice/README.md`.

## Verifiche ripetibili

- `pnpm test`: include componenti, retry, azzeramento, errori e timeline.
- `./scripts/Dev.ps1 -Task test:rust`: include estremi, rollback, ID idempotenti,
  isolamento, indice/paginazione, riavvio, backup/restore e compatibilità 014.
- Per il collaudo nativo usa Vite sulla porta 1420 e un eseguibile **debug** con
  `NODEX_DEV_DATA_DIR` e `WEBVIEW2_USER_DATA_FOLDER` impostati a cartelle assolute
  vuote sotto `.tools/m9/`; `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` deve contenere
  `--remote-debugging-port=9223`. Non usare l’archivio personale.
- Imposta `NODEX_DEV_BACKUP_FILE` e `NODEX_DEV_RESTORE_FILE` al percorso assoluto
  `.tools/m9/qa.nodex`, e `NODEX_DEV_EXPORT_FILE` a `.tools/m9/export.zip` prima
  dell’avvio. Imposta `$env:CHRONEXUS_DICE_QA='isolated'` e avvia
  `node scripts/qa/m9-dice.mjs check`, poi `restore`. Chiudi e riapri l’app con
  le stesse cartelle e avvia `restart`. I percorsi di scelta predefiniti sono
  disponibili solo in debug e il harness rifiuta campagne diverse dalle fixture.
- `check` prova tutti i dadi, confronta valori con SQLite, verifica tempi, limiti,
  interruzione/skip, movimento ridotto, paginazione, isolamento, finestre, axe e
  traffico remoto bloccato. Conserva backup/export precedenti rinominandoli nella
  cartella di collaudo. Rapporti e immagini rimangono in `.tools/m9`, ignorata.
- La fixture **grafica sintetica**, non persistita come tiro reale, è disponibile
  con Vite a `/scripts/qa/dice-gallery.html`: mostra tutti i tipi e 6/9/100 per la
  verifica manuale delle cifre. Non è un ingresso dell’app o un dado truccato.

Evidenza Windows del 24 ottobre 2026: 85 test frontend, 77 Rust, clippy, lint,
tipi, format e build desktop PASS. Nel collaudo nativo 187 tiri sintetici della
campagna e uno della seconda recuperati identici dopo backup e riavvio; tempi
2528/2520/2524 ms per 1/7/100 dadi. Axe non ha rilevato violazioni WCAG A/AA nelle
viste provate; tastiera e fixture 6/9/100 verificate anche visivamente. Nessuna
certificazione completa, prova NVDA, test su macOS/Linux, nuova installazione o
prova con rete fisicamente scollegata dichiarata. Warning Vite sul chunk editor
preesistente. L’installer precedente non è stato sostituito.

Skill applicate: impeccable/imagegen per l’identità visiva e gli asset offline;
accessibility/react-testing per interazioni e stati; rust-best-practices,
sqlite-expert e tauri-v2 per persistenza/IPC; systematic-debugging/react-doctor
per la correzione delle etichette, dei timer e del totale anticipato.


## Estensione pianificata M12 — non implementata

Per un solo dado complessivo: massimo d4/d6/d8/d10/d12/d20 celebra con entrambi i
draghi vivi e fiamme intorno; minimo 1 fa girare entrambi verso lo schermo e volare
minacciosi verso il giocatore sputando fuoco. D100 invertito: 1 celebra, 100 minaccia.
Valori intermedi e tiri multipli/misti non attivano questi effetti speciali.
Risultati salvati, storico e retry restano invariati; skip e movimento ridotto
obbligatori. Requisiti e matrice di verifica in ROADMAP.md. Nessuna animazione
nuova realizzata in questa modifica documentale.


## M12 — implementazione React in verifica finale

Esiti speciali esclusivamente per un dado: d4/6/8/10/12/20 massimo celebra,
1 minaccia; d100 1 celebra e 100 minaccia. Due attori SVG originali bronzei,
ali/coda articolate, fiato di fuoco e volto frontale con avvicinamento nella
minaccia. Gli effetti iniziano alla rivelazione del risultato già salvato;
nessuna anticipazione prima della fase reveal. Durata ordinaria 2,5 s,
estremi 3,6 s; skip, esito statico con movimento ridotto e stop in scheda nascosta.
Replay locale dello stesso tiro, nessun nuovo valore/RPC/storico o modifica alla
selezione. Geometria fisica LTR indipendente dalla lingua della navigazione.
22 test del dominio/React PASS, typecheck/lint PASS; collaudo visivo desktop e
pacchetti attesi dopo M13, come richiesto dall’utente. Nessuna pubblicazione.
Skill: frontend-design/impeccable per feedback e attori coerenti con il tema,
accessibility per skip/movimento ridotto, react-testing/react-doctor per verifiche.
