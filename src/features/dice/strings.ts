import { tr, localizeLabels } from "../../i18n/store";
export const diceText = localizeLabels({
  title: "Il cerchio dei draghi",
  intro:
    "Scegli i dadi. Ogni tiro viene custodito nello storico della campagna.",
  menu: "Tiradadi",
  composer: "Componi il tiro",
  roll: "Tira i dadi",
  saving: "Registrazione del tiro…",
  rolling: "I dadi sono in movimento…",
  landing: "I dadi atterrano nel cerchio…",
  burn: "Il fuoco dei draghi rivela il destino…",
  reveal: "Il cerchio rivela i risultati…",
  empty: "Il cerchio attende il tuo tiro",
  emptyHint: "Aggiungi uno o più dadi per cominciare.",
  limits:
    "Massimo 50 per tipo e 100 dadi per tiro. Dopo ogni tiro confermato, la selezione si azzera.",
  quantity: (s: number) => tr("Quantità d{0}", [s]),
  add: (s: number) => tr("Aggiungi un d{0}", [s]),
  remove: (s: number) => tr("Rimuovi un d{0}", [s]),
  composition: "Composizione",
  quantityError: "Inserisci quantità intere da 0 a 50 per ogni tipo di dado.",
  totalError: "Puoi tirare al massimo 100 dadi alla volta.",
  emptyError: "Seleziona almeno un dado prima di tirare.",
  saved: "Risultato salvato",
  awaitingReveal: "Tiro registrato. Rivelazione in corso…",
  total: "Totale",
  subtotal: "Subtotale",
  results: (s: number) => tr("Risultati d{0}", [s]),
  history: "Cronache dei tiri",
  historyLabel: (date: string, formula: string, total: number) =>
    tr("Tiro del {0}: {1}. Totale {2}.", [date, formula, total]),
  noHistory: "Nessun tiro registrato in questa campagna.",
  loading: "Apertura dello storico…",
  more: "Carica tiri precedenti",
  retry: "Riprova a caricare lo storico",
  skip: "Salta animazione",
  review: "Mostra nel cerchio",
  selectionReset:
    "Scegli i dadi nel compositore per preparare il prossimo tiro.",
  notConfirmed:
    "Non è stato possibile confermare il tiro. La selezione è conservata: riprova con la stessa composizione per evitare duplicati.",
  compact: (shown: number, total: number) =>
    tr(
      "La scena mostra {0} dadi su {1}. Tutti i valori sono nel dettaglio del risultato.",
      [shown, total],
    ),
  reduced:
    "Movimento ridotto: risultati mostrati senza rotolamento, fiamme o scorrimento dei numeri.",
  readResult: (total: number) => tr("Tiro salvato. Totale: {0}.", [total]),
  preview: "Seleziona i dadi",
  animationHint:
    "L’animazione mostra il tiro già salvato. Cambiare vista non elimina il risultato.",
  details: "Dettaglio del risultato",
  zero: "Azzera selezione",
});
