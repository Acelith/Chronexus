import { useSyncExternalStore } from "react";
import type { DragonOutcome } from "./outcome";
function subscribe(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}
const visible = () => document.visibilityState !== "hidden";
/** Original articulated SVG actors. Two bounded sequences, no sprite service or random outcome. */
export default function LivingDragons({
  outcome,
}: {
  outcome: Exclude<DragonOutcome, "ordinary">;
}) {
  const isVisible = useSyncExternalStore(subscribe, visible, () => true);
  if (!isVisible) return null;
  return (
    <div className={`living-dragons dragons-${outcome}`} aria-hidden="true">
      {(["left", "right"] as const).map((side) => (
        <div className={`dragon-orbit dragon-${side}`} key={side}>
          <div className="dragon-approach">
            <svg
              className="living-dragon"
              viewBox="0 0 240 220"
              focusable="false"
            >
              <g className="dragon-tail">
                <path d="M119 146C93 187 41 205 20 176C10 160 18 141 37 137C18 155 29 175 50 170C78 164 79 127 102 119Z" />
              </g>
              <g className="dragon-wing far-wing">
                <path d="M106 127L38 26L37 86L12 110L53 104L63 137L89 122Z" />
                <path
                  className="wing-veins"
                  d="M106 127L38 26L53 104M106 127L63 137M53 104L37 86"
                />
              </g>
              <path
                className="dragon-body"
                d="M75 139C85 104 119 105 132 85C143 67 133 49 154 45C174 38 189 62 180 81C171 100 139 108 137 133C135 161 100 168 75 139Z"
              />
              <path
                className="dragon-belly"
                d="M85 141C112 154 121 136 124 117C127 96 153 97 163 77L174 77C164 106 137 105 136 132C135 153 110 169 85 149Z"
              />
              <g className="dragon-wing near-wing">
                <path d="M115 126L98 17L138 57L178 38L166 87L196 122L150 114L129 148Z" />
                <path
                  className="wing-veins"
                  d="M115 126L98 17L138 57L166 87L150 114L129 148M115 126L138 57M115 126L166 87"
                />
              </g>
              <path
                className="dragon-spines"
                d="M135 82L124 66L141 70L137 53L153 60L158 41L167 58L185 49L178 71"
              />
              <g className="dragon-profile">
                <path d="M151 53L175 48L184 61L208 69L198 82L175 80L164 90L148 75Z" />
                <path
                  className="dragon-horn"
                  d="M161 55L147 30L171 50M181 55L190 36L190 63"
                />
                <path className="dragon-jaw" d="M175 80L196 81L183 89L165 83" />
                <path className="dragon-eye" d="M178 64L186 65L181 69Z" />
                <path className="dragon-teeth" d="M188 78L191 83L194 78" />
              </g>
              <g className="dragon-front">
                <path d="M148 49L168 43L189 50L196 72L185 97L169 105L150 95L141 72Z" />
                <path
                  className="dragon-horn"
                  d="M149 56L130 26L159 47M185 55L207 25L178 47"
                />
                <path
                  className="dragon-eye"
                  d="M149 66L162 70L157 76ZM175 70L189 65L183 76Z"
                />
                <path
                  className="dragon-jaw"
                  d="M156 86L181 86L179 96L161 96Z"
                />
                <path
                  className="dragon-teeth"
                  d="M160 86L164 92L168 86L172 92L177 86"
                />
              </g>
              <path
                className="dragon-claw"
                d="M115 146L136 169L147 166L141 177L126 179L106 158M91 147L78 166L62 168L72 177L87 173L107 154"
              />
              <g className="dragon-breath side-breath">
                <path d="M202 74C228 59 236 87 264 59C251 86 285 79 303 58C287 101 263 100 294 120C259 121 243 92 221 89Z" />
                <path className="breath-core" d="M203 76L275 85L236 89Z" />
              </g>
              <g className="dragon-breath front-breath">
                <path d="M164 93C142 130 177 125 127 156C161 145 114 193 85 216C138 201 162 219 174 188C198 215 218 205 234 219C218 184 186 154 194 129L176 95Z" />
                <path
                  className="breath-core"
                  d="M169 96L146 180L173 154L194 196L180 111Z"
                />
              </g>
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
