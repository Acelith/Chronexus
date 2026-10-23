import { createContext } from "react";
import type { KnowledgePage } from "./api";
export interface KnowledgeLinks {
  pages: KnowledgePage[];
  open: (id: string, fallback: string) => void;
  create: (title: string) => Promise<KnowledgePage>;
}
export const KnowledgeContext = createContext<KnowledgeLinks>({
  pages: [],
  open: () => {},
  create: async () => {
    throw Error("Seleziona una campagna prima di creare una pagina.");
  },
});
