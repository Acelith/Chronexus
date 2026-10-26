import { useState, type FormEvent } from "react";
import { appText } from "../../strings";

export function CampaignForm({
  initialName,
  rename,
  busy,
  onSave,
  onCancel,
}: {
  initialName: string;
  rename: boolean;
  busy: boolean;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <form
      className="entry-form"
      aria-label={rename ? appText.rename : appText.newCampaign}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void onSave(name);
      }}
    >
      <label>
        {appText.campaignName}
        <input
          autoFocus
          required
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
        />
      </label>
      <div className="actions">
        <button className="primary" disabled={busy || !name.trim()}>
          {rename ? appText.saveName : appText.createCampaign}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          {appText.cancel}
        </button>
      </div>
    </form>
  );
}

export function SessionForm({
  initialSequence,
  busy,
  onSave,
  onCancel,
}: {
  initialSequence: number;
  busy: boolean;
  onSave: (
    sequence: number,
    title: string,
    date: string | null,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [sequence, setSequence] = useState(initialSequence);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  return (
    <form
      className="entry-form"
      aria-label={appText.newSession}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void onSave(sequence, title, date || null);
      }}
    >
      <div className="form-fields">
        <label className="number-field">
          {appText.sessionNumber}
          <input
            type="number"
            required
            min={1}
            max={999999}
            step={1}
            value={sequence}
            onChange={(event) => setSequence(event.target.valueAsNumber)}
            disabled={busy}
          />
        </label>
        <label>
          {appText.sessionTitle}
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          {appText.sessionDate}
          <input
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={busy}
          />
        </label>
      </div>
      <div className="actions">
        <button className="primary" disabled={busy || !title.trim()}>
          {appText.createSession}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          {appText.cancel}
        </button>
      </div>
    </form>
  );
}
