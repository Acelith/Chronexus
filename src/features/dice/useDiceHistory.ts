import { useCallback, useEffect, useState } from "react";
import { diceApi, type Roll, type Cursor } from "./api";
import { mergeRolls } from "./model";
import { errorMessage } from "../journal/api";
export function useDiceHistory(campaignId: string) {
  const [rows, setRows] = useState<Roll[]>([]),
    [cursor, setCursor] = useState<Cursor | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let active = true;
    void diceApi
      .history(campaignId)
      .then((page) => {
        if (active) {
          setRows((rows) => mergeRolls(rows, page.rolls));
          setCursor(page.nextCursor);
          setError("");
        }
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, epoch]);
  const add = useCallback(
    (roll: Roll) => setRows((rows) => mergeRolls(rows, [roll])),
    [],
  );
  async function more() {
    if (loading || !cursor) return;
    setLoading(true);
    setError("");
    try {
      const page = await diceApi.history(campaignId, cursor);
      setRows((rows) => mergeRolls(rows, page.rolls));
      setCursor(page.nextCursor);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }
  return {
    rows,
    cursor,
    loading,
    error,
    add,
    more,
    retry: () => {
      setLoading(true);
      setError("");
      setEpoch((e) => e + 1);
    },
  };
}
