import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { tr } from "../../i18n/store";
import type { Table } from "./api";
import "./tables.css";
const Workspace = lazy(() => import("./TableWorkspace"));
const Dock = createContext<(table: Table) => void>(() => {});
export const useTableDock = () => useContext(Dock);
export function TableDockProvider({
  children,
  campaignId,
}: {
  children: ReactNode;
  campaignId: string;
}) {
  const [selection, setSelection] = useState<{
    campaignId: string;
    table: Table;
  } | null>(null);
  const table = selection?.campaignId === campaignId ? selection.table : null;
  const value = useCallback(
    (next: Table) => setSelection({ campaignId, table: next }),
    [campaignId],
  );
  return (
    <Dock.Provider value={value}>
      <div className={table ? "table-layout" : ""}>
        {children}
        {table && (
          <aside className="table-dock" aria-label={tr("Tables")}>
            <Suspense fallback={<p role="status">{tr("Loading…")}</p>}>
              <Workspace
                key={table.id}
                campaignId={campaignId}
                table={table}
                onClose={() => setSelection(null)}
              />
            </Suspense>
          </aside>
        )}
      </div>
    </Dock.Provider>
  );
}
