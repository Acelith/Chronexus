import { tr } from "../../i18n/store";
export type SaveState = {
  kind: "saved" | "dirty" | "saving" | "error";
  message?: string;
};

/** One ordered writer per document. Failed writes keep the latest draft and block navigation. */
export class Autosave<T> {
  private generation = 0;
  private savedGeneration = 0;
  private latest: T | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | undefined;
  private disposed = false;
  constructor(
    private revision: number,
    private write: (value: T, revision: number) => Promise<number>,
    private report: (state: SaveState) => void,
    private delay = 500,
  ) {}

  change(value: T) {
    this.latest = value;
    this.generation += 1;
    this.report({ kind: this.running ? "saving" : "dirty" });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => {
        /* surfaced through report */
      });
    }, this.delay);
  }

  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) {
      await this.running;
      return this.flush();
    }
    if (this.savedGeneration === this.generation || this.latest === undefined)
      return;
    const value = this.latest;
    const generation = this.generation;
    this.report({ kind: "saving" });
    const task = this.write(value, this.revision)
      .then((revision) => {
        this.revision = revision;
        this.savedGeneration = generation;
        if (!this.disposed)
          this.report({
            kind: this.generation === generation ? "saved" : "dirty",
          });
      })
      .catch((error: unknown) => {
        if (!this.disposed)
          this.report({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : tr("Saving failed. The notes stay here: try again."),
          });
        throw error;
      });
    this.running = task;
    try {
      await task;
    } finally {
      if (this.running === task) this.running = undefined;
    }
    if (this.savedGeneration !== this.generation) await this.flush();
  }

  get dirty() {
    return this.savedGeneration !== this.generation;
  }
  activate() {
    this.disposed = false;
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
