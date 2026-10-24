import type { CSSProperties } from "react";
export default function SlotNumber({
  value,
  animate,
}: {
  value: number;
  animate: boolean;
}) {
  return (
    <span className="slot-number" aria-hidden="true">
      {String(value)
        .split("")
        .map((digit, index) => (
          <span className="slot-window" key={index}>
            {animate ? (
              <span
                className="slot-reel"
                style={
                  {
                    "--reel-end": `${-(20 + Number(digit))}em`,
                    "--reel-delay": `${index * 35}ms`,
                  } as CSSProperties
                }
              >
                {Array.from({ length: 30 }, (_, i) => (
                  <span key={i}>{i % 10}</span>
                ))}
              </span>
            ) : (
              digit
            )}
          </span>
        ))}
    </span>
  );
}
