import { tr } from "../../i18n/store";
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
            setStatus(tr("Exporting…"));
            try {
              const receipt = await command<Receipt | null>("export_campaign", {
                campaignId,
              });
              setStatus(
                receipt
                  ? tr(
                      "Export created: {0} pages, {1} sessions, {2} images. {3}",
                      [
                        receipt.pages,
                        receipt.sessions,
                        receipt.images,
                        receipt.path,
                      ],
                    )
                  : tr("Export cancelled."),
              );
            } catch (reason) {
              setError(errorMessage(reason));
              setStatus("");
            }
          })
        }
      >
        <Text source={"Export campaign"} />
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
