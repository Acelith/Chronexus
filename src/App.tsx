import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function App() {
  const [status, setStatus] = useState('Apertura archivio locale…');
  useEffect(() => { invoke<string>('database_status').then(setStatus).catch(() => setStatus('Archivio non disponibile. Avvia Nodex come applicazione desktop.')); }, []);
  return <div className="shell"><aside><h1>Nodex</h1><p>Il tuo diario di campagna</p><nav aria-label="Navigazione"><strong>Diario</strong></nav><footer>Archivio personale · offline</footer></aside><main><header><p>Le tue campagne</p><h2>Ogni avventura comincia<br />da una prima pagina.</h2></header><section><p>Non hai ancora creato una campagna.</p><p role="status">{status}</p></section></main></div>;
}
