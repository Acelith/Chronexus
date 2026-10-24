import { useId, type CSSProperties, type ReactNode } from "react";
import type { Sides } from "./api";
const material = new URL("../../../assets/dice/material.webp", import.meta.url)
  .href;
const shapes: Record<Sides, { outline: string; facets: string }> = {
  4: { outline: "M50 3L97 90H3Z", facets: "M50 3L50 64M3 90L50 64L97 90" },
  6: {
    outline: "M8 24L50 3L92 24V76L50 97L8 76Z",
    facets: "M8 24L50 45L92 24M50 45V97",
  },
  8: {
    outline: "M50 2L96 50L50 98L4 50Z",
    facets: "M4 50H96M50 2L25 50L50 98L75 50Z",
  },
  10: {
    outline: "M50 2L96 36L76 85L50 98L24 85L4 36Z",
    facets: "M50 2L25 40L4 36M25 40L50 98L75 40L96 36M75 40L50 2",
  },
  12: {
    outline: "M32 3H68L94 29L99 61L78 91L50 99L22 91L1 61L6 29Z",
    facets:
      "M50 17L80 39L69 74H31L20 39ZM32 3L50 17L68 3M94 29L80 39L99 61M78 91L69 74L50 99L31 74L22 91M1 61L20 39L6 29",
  },
  20: {
    outline: "M50 2L93 26V74L50 98L7 74V26Z",
    facets: "M50 2L25 74H75ZM7 26H93L50 98ZM7 74H93",
  },
  100: {
    outline: "M36 3L72 24L92 49L74 80L49 98L18 83L3 48L12 22Z",
    facets: "M36 3L53 42L92 49M53 42L49 98M12 22L53 42L74 80M3 48L53 42L18 83",
  },
};
export default function DieFace({
  sides,
  children,
  style,
  className = "",
}: {
  sides: Sides;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const id = useId().replace(/[^a-z0-9]/gi, "");
  const shape = shapes[sides];
  return (
    <span className={`die-face die-d${sides} ${className}`} style={style}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <clipPath id={`die-${id}`}>
            <path d={shape.outline} />
          </clipPath>
          <linearGradient id={`shade-${id}`} x2="1" y2="1">
            <stop stopColor="#b89b60" stopOpacity=".22" />
            <stop offset=".48" stopColor="#101412" stopOpacity=".1" />
            <stop offset="1" stopColor="#000" stopOpacity=".5" />
          </linearGradient>
        </defs>
        <image
          href={material}
          width="100"
          height="100"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#die-${id})`}
        />
        <path
          d={shape.outline}
          fill={`url(#shade-${id})`}
          stroke="#c5a165"
          strokeWidth="2.3"
        />
        <path
          d={shape.facets}
          fill="none"
          stroke="#b69c6b"
          strokeWidth="1"
          opacity=".55"
        />
      </svg>
      <span className="die-value">{children}</span>
    </span>
  );
}
