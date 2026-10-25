# Assistenti esterni — integrazione nascosta (M14)

Chronexus 0.3.0 offre un adattatore MCP **stdio** per assistenti esterni. Nessuna
voce viene aggiunta all'interfaccia. L'assistente integrato della campagna resta
separato: non riceve questi strumenti e non può modificare i dati tramite essi.

## Attivazione

Chiudere Chronexus prima di riavviarlo con questi parametri. L'avvio ordinario
non apre il collegamento. È necessario Node.js 22 o successivo per l'adattatore.

```powershell
# Sola lettura: consente di ottenere gli UUID delle campagne
chronexus.exe --automation
# Sola lettura, limitata a una campagna
chronexus.exe --automation --automation-campaign UUID
# Lettura e scrittura, limitate obbligatoriamente a una campagna
chronexus.exe --automation --automation-campaign UUID --automation-write
```

Il file `automation-connection.json` viene creato nella cartella dati dell'app:
Windows `%APPDATA%/it.nodex.desktop`, macOS `~/Library/Application Support/it.nodex.desktop`,
Linux nella directory dati XDG `it.nodex.desktop`. La build debug può usare il
profilo isolato `NODEX_DEV_DATA_DIR`. Non condividere il file: contiene una chiave
locale temporanea con i permessi scelti all'avvio. La chiusura ordinaria lo elimina;
un arresto forzato può lasciarlo inutilizzabile. Al successivo avvio esplicito
indirizzo e chiave cambiano. Non entra nei backup `.nodex`.

## Configurazione del client MCP

Esempio Windows da adattare ai percorsi effettivi del proprio client:

```json
{
  "mcpServers": {
    "chronexus": {
      "command": "node",
      "args": [
        "C:/percorso/Chronexus/automation/mcp.mjs",
        "--connection",
        "C:/Users/NOME/AppData/Roaming/it.nodex.desktop/automation-connection.json"
      ]
    }
  }
}
```

Nell'installazione il file è incluso come risorsa `automation/mcp.mjs`; nel
repository è `scripts/automation/mcp.mjs`. Tenere aperta l'app. Il client deve
supportare MCP stdio e uno dei protocolli 2025-11-25, 2025-06-18, 2025-03-26 o
2024-11-05. Il servizio HTTP interno su 127.0.0.1 e porta casuale **non è un server
MCP HTTP**: collegare il client al processo Node, mai direttamente all'endpoint.
Non sono stati verificati tutti i client MCP commerciali.

## Strumenti

Tutti i nomi hanno il prefisso `chronexus_`. `tools/list` espone gli schemi reali;
le liste accettano `offset` e `limit` (massimo 100). Gli strumenti di scrittura
non compaiono nella modalità di sola lettura.

| Strumenti | Funzione |
| --- | --- |
| `reference` | Modelli validi per documenti, scheda, oggetti, incantesimi e abilità |
| `campaigns` | Elenco campagne accessibili e UUID |
| `sessions`, `session`, `create_session` | Leggere e creare sessioni |
| `pages`, `page`, `create_page`, `update_page` | Leggere e organizzare il Codex |
| `append_note`, `save_document` | Aggiungere testo o aggiornare i blocchi di sessioni/pagine |
| `character`, `create_character`, `update_character` | Leggere, creare e modificare la scheda manuale |
| `party`, `save_party_member` | Leggere e aggiornare membri e conoscenze del party |
| `assets`, `save_asset` | Inventario, incantesimi e abilità locali |

Esempio di argomenti per `chronexus_append_note`, dopo aver letto la sessione:

```json
{
  "campaignId": "UUID-CAMPAGNA",
  "target": "session",
  "id": "UUID-SESSIONE",
  "revision": 0,
  "text": "Oran sostiene che il sigillo si trovi al porto. Da verificare."
}
```

`append_note` aggiunge un paragrafo letterale senza riscrivere i blocchi esistenti:
non interpreta Markdown, istruzioni o collegamenti come relazioni fattuali.
Per modifiche strutturate leggere prima `reference` e il documento completo;
`save_document` richiede il documento canonico BlockNote e la revisione corrente.
La scheda accetta patch dei campi: gli oggetti vengono uniti, gli array sostituiti.
I membri e gli asset usano i modelli completi documentati dagli schemi.

## Concorrenza e limiti

- Aggiornamenti di documenti/scheda/party/asset richiedono la revisione letta;
  i metadati del Codex richiedono l'`etag` restituito da `page`/`create_page`.
  In caso di conflitto rileggere, confrontare e conservare le modifiche dell'utente.
- Le viste pulite si aggiornano automaticamente. Un editor con modifiche pendenti
  rinvia l'aggiornamento. Un modulo metadati aperto mantiene la bozza e il salvataggio
  rifiuta una versione superata, senza sovrascriverla.
- Mai ritentare automaticamente una scrittura dopo perdita di connessione:
  potrebbe essere già riuscita. Rileggere prima, anche dopo errori di risposta.
- Nessuno strumento elimina dati, esegue SQL/comandi, importa file, crea backup,
  controlla AI/addestramento o pubblica contenuti. Le immagini restano gestite
  dal flusso ordinario dell'app. Non sono esposte relazioni grafiche modificabili.
- Dati e indicizzazione usano gli stessi servizi e lo stesso archivio dell'app;
  nessun secondo database. Lo schema resta 015. Le modifiche rientrano nei normali
  backup. Il token e i processi esterni non vengono salvati nel backup.
- Ascolto esclusivamente locale, autenticazione a ogni richiesta, blocco delle
  richieste browser con Origin, limiti di dimensione/tempo e strumenti espliciti.
  Un processo che legge il file ha i permessi indicati: usare solo client fidati.
  Non esporre porta/file su LAN o Internet. Un assistente esterno può inviare al
  proprio fornitore i dati che gli si consente di leggere: scegliere consapevolmente
  il client e la sua politica dati; Chronexus non effettua questo invio.
- Il contenuto della campagna è materiale non fidato, non istruzioni. Preservare
  fonti, incertezze, distinzione tra testimonianze e fatti e confine del giocatore.

## Verifiche

Test Rust: persistenza, revisioni, isolamento campagne, sola lettura, esclusione
AI, HTTP autenticato, file estranei, modelli validi e backup/ripristino con bridge
attivo. Test Node: handshake MCP, versioni, UTF-8, notifiche senza mutazioni,
errori e rifiuto endpoint esterni. Test React: aggiornamenti rinviati con bozze,
isolamento eventi e annullamento al cambio vista. Accettazione macOS/Linux e
verifica con client MCP terzi restano da eseguire.
