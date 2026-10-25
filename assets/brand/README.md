# Logo di Chronexus — da integrare (M21)

Illustrazioni scelte dall’utente il 25 ottobre 2026: araldo con trombetta e
stendardo. Generate esternamente dall’utente, senza dati di campagna. **Non ancora
usate dall’app**: l’integrazione è la milestone M21 in ROADMAP, la prima da
eseguire. Fino ad allora icona e barra laterale restano quelle attuali.

## Originali (non modificare)

| File | Contenuto |
| --- | --- |
| `source/icon-original.webp` | Icona quadrata 1254×1254 su pergamena bordeaux, fondo nero agli angoli |
| `source/wordmark-original.webp` | Marchio orizzontale araldo + «CHRONEXUS», 2000×667, alpha |
| `source/logo-original.webp` | Logo verticale araldo sopra «CHRONEXUS», 1254×1254, alpha |

## Varianti preparate

| File | Uso previsto | Preparazione |
| --- | --- | --- |
| `chronexus-icon.svg` | Sorgente di `pnpm icons` (finestra, barra applicazioni, installer) | Angoli arrotondati resi trasparenti (maschera con raggio 232 px), 1024×1024, PNG a 256 colori incorporato. `tauri icon` provato: genera tutte le dimensioni |
| `chronexus-icon.webp` | Icona per documenti e README | 512×512, alpha |
| `chronexus-logo.webp` | Logo verticale nella barra laterale | 640 px, alpha originale |
| `chronexus-wordmark.webp` | Marchio orizzontale per README e pagine | 1400 px, alpha originale |

Conversioni con ffmpeg 7.1.1. Per rigenerarle partire sempre da `source/`.
A 16–32 px l’icona conserva la sagoma ma perde i dettagli: M21 valuta una variante
semplificata per le dimensioni piccole. Il nome dell’app resta testo accessibile
(`alt`/titolo), mai solo lettere disegnate.
