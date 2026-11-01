import type { BoardView } from "../../src/features/tables/server-types";
export interface BoardWidget {
  root: HTMLElement;
  update(board: BoardView): void;
  connected(online: boolean): void;
  dispose(): void;
  refresh(): Promise<void>;
  readonly snapshot: BoardView | null;
  readonly selected: string | null;
  showPing(frame: PingFrame): void;
}
export interface PingFrame {
  sceneId: string;
  x: number;
  y: number;
  authorId?: string;
  authorName?: string;
}
export function createTableRuntime(locale: string): {
  board: { create(options: unknown): BoardWidget };
  i18n: {
    t(key: string, params?: Record<string, unknown>): string;
    locale: string;
  };
};
