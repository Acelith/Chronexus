import { Text } from "../../i18n/Text";
import { useContext, useState } from "react";
import { command, errorMessage } from "../journal/api";
import { OperationContext } from "../../operations";
interface Receipt {
  path: string;
  files: number;
  pages: number;
  sessions: number;
  images: number;
}
export default function ExportButton({
  campaignId,
  busy,
}: {
  campaignId: string;
  busy: boolean;
}) {
  const run = useContext(OperationContext);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="export-control">
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            setError("");
            setStatus("Esportazione…");
            try {
              const receipt = await command<Receipt | null>("export_campaign", {
                campaignId,
              });
              setStatus(
                receipt
                  ? `Esportazione creata: ${receipt.pages} pagine, ${receipt.sessions} sessioni, ${receipt.images} immagini. ${receipt.path}`
                  : "Esportazione annullata.",
              );
            } catch (reason) {
              setError(errorMessage(reason));
              setStatus("");
            }
          })
        }
      >
        <Text source={"Esporta campagna"} />
      </button>
      {status ? <p role="status">{status}</p> : null}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
