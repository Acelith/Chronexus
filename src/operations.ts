import { createContext } from "react";
// Mutations share the app's existing navigation/close guard and editor flush.
export const OperationContext = createContext<
  (action: () => Promise<void>) => Promise<unknown>
>(async (action) => action());
