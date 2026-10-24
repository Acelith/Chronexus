# Appunti: visuale e Markdown

Nella barra sempre visibile, **Visuale** e **Markdown** aprono lo stesso documento.
Le modifiche visuali si salvano automaticamente; **Salva ora** forza il salvataggio.
Nel sorgente, **Applica e torna al visuale** converte la bozza. **Salva ora**, cambio
vista/campagna e chiusura normale applicano e salvano anche il Markdown. Un errore
mantiene la bozza aperta e blocca la navigazione. **Annulla modifiche Markdown**
scarta soltanto le modifiche al sorgente non ancora applicate.

Con il mouse si possono scegliere titoli 1–3, testo, citazioni, elenchi puntati,
numerati e attività; usare grassetto, corsivo, sottolineatura, barrato, codice in
linea, evidenziazione, allineamento, annulla/ripeti e collegamenti. Il selettore
**Collega pagina** inserisce una voce reale del Codex; rimane anche la scorciatoia `[[`.

Nel Markdown i collegamenti interni hanno la forma `[Nome](chronexus://page/UUID)`.
Il nome può cambiare senza cambiare destinazione. Il convertitore usa temporaneamente
un hostname riservato `.invalid` perché la libreria filtra gli schemi personalizzati;
non lo apre e non effettua richieste. Riporta l’UUID nel documento strutturato.
I blocchi rimasti invariati mantengono ID, colori, sottolineatura e allineamento.
I blocchi modificati nel sorgente seguono i formati rappresentabili in Markdown:
la fonte può risultare modificata o non più disponibile, come per gli altri cambi
al documento; l’evidenza già registrata nelle relazioni rimane conservata.

Tabelle, blocchi di codice, HTML, immagini Markdown, separatori e definizioni di
link non appartengono allo schema degli appunti e sono rifiutati prima della
conversione. Per immagini e mappe si usa la galleria già inclusa nei backup.
Non viene dichiarata compatibilità completa con Word o con ogni dialetto Markdown.
Il documento persistito rimane JSON versione 1, SQLite schema 014; nessuna migrazione.

## Collaudo ripetibile Windows

Usare un eseguibile debug con Vite sulla porta 1420. Prima dell’avvio impostare
`NODEX_DEV_DATA_DIR` e `WEBVIEW2_USER_DATA_FOLDER` a cartelle assolute vuote sotto
`.tools/`, e `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`.
Non usare il proprio profilo dati o l’eseguibile release per queste prove.

Impostare `$env:CHRONEXUS_UI_QA='isolated'`, quindi eseguire
`node scripts/qa/gui-editor.mjs check`. Il comando accetta solo un archivio vuoto
o l’unica campagna sintetica `Collaudo GUI e Markdown`; controlla editor, sorgente,
link/ID, formati visuali, errori, finestre e scorrimento. Chiudere normalmente
l’app, riavviarla con le stesse cartelle, poi eseguire
`node scripts/qa/gui-editor.mjs restart` per verificare i dati dopo riavvio.
Rapporti e screenshot rimangono in `.tools/ui-refresh/`, ignorata da Git.

Skill applicate: react-testing per la copertura di regressione, systematic-debugging
per i difetti osservati di conversione URL e layout, react-doctor per la diagnosi.
