# Chronexus — GUI del riferimento
## Autorità e superficie
Modalità Operate. Riferimento vincolante: .tools/ui-refresh/reference.png, allegato dall'utente il 24 ottobre 2026. La revisione riproduce composizione, materiali, cornici, tipografia e gerarchia; il contenuto rimane quello della campagna selezionata.
## Composizione
Al riferimento 1586×992: costa sinistra scura larga circa 270 px; marchio con rosa dei venti, selettore campagna, azioni e paesaggio inciso al piede. Area destra a pergamena; titolo campagna in alto, data reale e menu azioni compatto; sotto, navigazione con icone. Le impostazioni e l'assistente stanno nella costa sinistra, senza aggiungere voci alla barra del riferimento.
Grafo: titolo e sottotitolo, filtri orizzontali, mappa con cornice e dettaglio a destra, comandi di zoom sotto. Etichette sempre leggibili e distinte da menzioni/relazioni.
## Materiali e colori
Pergamena avorio #ead9b1, inchiostro #321d13, pelle #241e17, ottone #b89b60, bordeaux #6c302b, verde #354b3e. Texture reali discrete, nessun testo rasterizzato nei controlli. Cornici sottili e angoli decorati.
## Tipografia
EB Garamond per testo e titoli, Cinzel per il marchio; font locali con licenza OFL. Titolo campagna 46–52 px, titolo superficie 34–40 px, testo 18–21 px, controlli 17–19 px. Dimensioni adattate alle finestre compatte senza cambiare il linguaggio grafico.
## Interazione
Finestra occupata al 100%, intestazione e menu fermi. Scroll indipendente per elenchi sessioni/pagine e per documento. Editor con barra permanente, dialoghi etichettati, modalità Markdown esplicita e recupero degli errori. Nessun cambio silenzioso dei collegamenti UUID.
## Asset e vincoli
Icone SVG coerenti, rose dei venti e cornici geometriche; texture e incisione come asset separati. La grafica non incorpora nomi, pulsanti o risultati fittizi. Nessuna dipendenza remota a runtime.

## Tiradadi M9 — Operate con momento scenico

Pannello dedicato dal menu sinistro. Su desktop, compositore verticale con sette
geometrie a sinistra, cerchio bronzeo dei draghi al centro e cronache a destra.
Su finestre compatte lo storico passa sotto e il compositore diventa una griglia.
Le illustrazioni originali dei draghi/fiamme sono separate dai dadi SVG e dai
valori: numeri grandi avorio, pietra scura e tipo esplicito incluso d100.
Un solo momento animato: rotolamento, atterraggio, fuoco, rivelazione e conteggio
slot in 2,5 secondi indipendenti dal numero di dadi. Le fiamme precedono i numeri,
non coprono i risultati finali; movimento ridotto mostra direttamente il risultato.
Al massimo 14 dadi nella scena, distribuiti su tutti i tipi selezionati; il dettaglio
semantico conserva e rende leggibili tutti i valori, anche su 100 dadi.


## M10 — lingue e scritture

Conservare pergamena, ornamenti e tipografia latina del riferimento. Le lingue
araba/CJK usano font Noto locali leggibili, senza richiedere servizi font remoti.
L’arabo specchia la disposizione e isola i dati misti; testi delle campagne e
citazioni restano originali. Nessuna traduzione mediante riscrittura del DOM.
SGA usa Monocraft OFL, non glifi di lingue reali spacciati per l’alfabeto Minecraft.
Glifi decorativi aria-hidden e testo semantico, recupero italiano sempre normale;
font assente o carattere non rappresentabile conservano il testo leggibile.
La casella «mostra anche il testo ordinario» governa solo le etichette controllate.
Dialoghi critici, dati e menu nativi restano ordinari. Dettagli: docs/I18N.md.
