# Adattatori di regolamento

M5 e la sua estensione salvano valori manuali. `systemId` è un'etichetta libera, non seleziona un motore
di gioco. Scheda, risorse, inventario e capacità rimangono utilizzabili offline
con qualunque etichetta. Nessun testo commerciale è incluso.

Il contratto locale è `RulesetAdapter` in `src/features/player/rulesets.ts`:

- `id`, `label` e `mode` descrivono l'adattatore.
- `derive(character)` è una funzione pura: può proporre statistiche derivate da
  una scheda letta come immutabile. Il risultato è separato dai valori manuali.
- L'unico adattatore disponibile, `generic`, restituisce nessuna derivazione.
  Un identificatore sconosciuto usa lo stesso comportamento manuale.

Per aggiungere un adattatore futuro servono requisiti espliciti del sistema,
licenza delle fonti, test delle formule e registrazione locale nel resolver.
Non introdurre sostituzioni silenziose dei valori salvati o automazioni di
riposo/consumo. L'unica eccezione di rete approvata è il catalogo SRD qui sotto,
avviato esplicitamente dall'utente. La validazione di persistenza in Rust
rimane obbligatoria anche con un adattatore frontend.

I marcatori conosciuta/preparata sono indipendenti. Non consumano risorse quando
cambiano e non verificano requisiti di classe, livello o preparazione. Risorse e
slot sono contatori configurabili della scheda; PF e contatori usano interi
da zero al massimo scelto, entro il limite tecnico di un milione.

La prima versione gestisce un personaggio per campagna. I suoi UUID e quelli
di statistiche/risorse restano stabili durante le modifiche. Eventuali estensioni
multi-personaggio dovranno migrare il vincolo, preservando proprietà e riferimenti.

## Scheda ispirata al riferimento dell'utente

Le quattro pagine del PDF guidano i campi di combattimento, identità/competenze,
equipaggiamento/valori e magia. Non vengono copiati logo, grafica o testi personali.
“Aggiungi campi D&D 2014” aggiunge solo le etichette mancanti di sei caratteristiche,
sei tiri salvezza e diciotto abilità; conserva UUID e valori esistenti. Modificatori,
competenza/maestria, armatura, iniziativa, dadi vita, ispirazione, tiri contro morte,
resistenze, sensi, armi/munizioni, biografia, monete e magia sono manuali.
“Aggiungi slot 1°–9°” inserisce contatori mancanti a zero; imposta tu i massimi.
Collocazione degli oggetti libera; nessuna somma pesi, valuta o applicazione di bonus.

## Catalogo D&D SRD 2014

- Fonte: [D&D 5e API](https://docs.dnd5eapi.co/introduction), endpoint fisso
  `https://www.dnd5eapi.co/api/2014/`. API pubblica GET-only, senza account.
- [Lingue](https://docs.dnd5eapi.co/reference/multilingual): verifica reale del
  23 ottobre 2026 su `/api/2014/locales`: fr-FR, pt-BR, ru; nessun italiano.
  Interfaccia italiana e contenuti API in inglese; cercare nomi inglesi.
- Aprire il catalogo non effettua rete. Cerca carica l'indice, il nome e livello
  filtrano localmente; un clic carica il dettaglio. Aggiorna forza il GET online.
  Il nome personalizzato digitato non viene inviato: solo categoria e indice SRD.
- Timeout 10 secondi, 2 MiB/risposta, niente credenziali/redirect, CSP con un solo
  host remoto. Testi resi come testo React, senza HTML remoto eseguito.
- Rust valida e persiste le risposte in SQLite, con massimo 150 voci. Le copie
  locali mostrano data e provenienza; aggiornamento fallito ripiega sulla copia
  disponibile con avviso. Una voce mai consultata richiede connessione.
- “Usa questi dati nel modulo” propone un incantesimo: nome, livello, scuola,
  tempo, durata, portata, componenti, materiali, testo ai livelli superiori,
  rituale e concentrazione. Poi Salva voce. Conosciuta/preparata restano manuali.
- Da un incantesimo personalizzato puoi cercare lo stesso nome o cambiarlo nel
  catalogo. Usare un risultato sostituisce i campi esplicitamente; preserva note,
  marcatori e collegamenti del modulo. Puoi rinominare e modificare il risultato.
  Nessuna ricerca automatica/riscrittura e nessun caricamento di homebrew nell'API.
- Gli incantesimi salvati sono copie indipendenti dalla cache. Il riferimento
  originale `catalogSource` rimane dopo le modifiche; provenienza di campagna e
  fonte SRD sono distinti e non creano archi fattuali del grafo.
- Migrazione 006 additiva e default per JSON M5. Backup include nuovi campi,
  incantesimi e cache, conservando il formato `.nodex`; per leggerli serve schema
  006 o successivo. I backup precedenti sono ancora ripristinabili.

## Fonti e attribuzione

Il catalogo contiene il sottoinsieme SRD, non tutti i manuali commerciali.
Il codice API è MIT; i dati sono materiale SRD. Si usa SRD 5.1 sotto CC BY 4.0,
come consentito dalla [fonte Wizards](https://www.dndbeyond.com/srd) e dal
[preambolo SRD 5.1](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf).
L'app mostra l'attribuzione prescritta e il riferimento originale in anteprima,
nel modulo e nel dettaglio delle copie importate. Nessun catalogo viene incluso
nel codice sorgente; il download è su richiesta. Le modifiche sono indicate come
copie personali modificabili. Non confondere la licenza software con quella dei dati.

Skill applicate: PDF per lettura visiva/estrazione del riferimento; frontend-design
per sezioni e gerarchia coerenti; vercel-react-best-practices per caricamento
differito del compendio e filtri derivati senza richieste a ogni tasto.

## Provenienza di immagini e schede importate

Le fotografie di Oran sono riferimenti privati conservati integralmente nei
backup, non un ruleset. La trascrizione è parziale e manuale; i valori dubbi e
quelli mancanti vanno verificati sulle foto. Nessuna formula o descrizione
commerciale viene ricostruita. Gli incantesimi personali rimangono modificabili
con la ricerca SRD esplicita disponibile; la conversione Logseq non invia dati
all’API e non crea fatti nel grafo.


## Wiki multi-fonte e futura AI

Wiki D&D usa Open5e v2 per consultazione esplicita con fonte/edizione/licenze.
Non converte una descrizione di regole in un fatto della campagna e non
sovrascrive homebrew o importazioni SRD 2014 esistenti. Le risposte possono
provenire da editori/edizioni differenti: restano voci separate, prevalentemente
in inglese. La cache è locale, limitata e compresa nel backup schema 011.
M7 è soltanto pianificata: modello specifico D&D da valutare, retrieval sulle
fonti selezionate, edizioni separate e nessuna formula applicata automaticamente.
Vedere docs/AI_LOCAL.md; nessun runtime o modello è stato eseguito.
