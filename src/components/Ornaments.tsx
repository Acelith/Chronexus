import { iconPaths } from "./iconPaths";
import type { CSSProperties } from "react";
export function Icon({ name, style }: { name: string; style?: CSSProperties }) {
  return (
    <svg
      className="ink-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name] ?? iconPaths.document} />
    </svg>
  );
}
export function Compass() {
  return (
    <svg
      className="brand-compass"
      viewBox="0 0 100 100"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="50" cy="50" r="31" />
      <circle cx="50" cy="50" r="5" />
      {Array.from({ length: 8 }, (_, i) => (
        <path
          key={i}
          transform={`rotate(${i * 45} 50 50)`}
          d="M50 4L57 43 50 50 43 43z"
          fill={i % 2 === 0 ? "currentColor" : "none"}
        />
      ))}
      <path d="M50 1v98 M1 50h98" />
    </svg>
  );
}
