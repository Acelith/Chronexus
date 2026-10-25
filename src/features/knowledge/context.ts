import { tr } from "../../i18n/store";
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
    throw Error(tr("Select a campaign before creating a page."));
  },
});
