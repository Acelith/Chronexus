export function TextField({
  label,
  value,
  onChange,
  max = 200,
  multiline = false,
  required = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea
          value={value}
          maxLength={max}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          autoFocus={autoFocus}
          value={value}
          required={required}
          maxLength={max}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  max = 1000000,
  optional = false,
  decimal = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
  optional?: boolean;
  decimal?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={0}
        max={Number.isFinite(max) ? max : 1000000}
        step={decimal ? "any" : 1}
        required={!optional}
        value={value === null || !Number.isFinite(value) ? "" : value}
        onChange={(e) =>
          onChange(
            e.target.value === "" && optional ? null : e.target.valueAsNumber,
          )
        }
      />
    </label>
  );
}
export function Flag({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="player-flag">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
