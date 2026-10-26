// Fixed graphical fixtures, never saved as real campaign rolls.
import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import "../../src/reference-theme.css";
import "../../src/features/dice/dice.css";
import DiceScene from "../../src/features/dice/DiceScene";
import DieFace from "../../src/features/dice/DieFace";
import SlotNumber from "../../src/features/dice/SlotNumber";
import { SIDES, type Roll } from "../../src/features/dice/api";
const values = [4, 6, 6, 9, 6, 9, 100];
const roll: Roll = {
  id: "4c67b2fd-75fe-4cd4-bb8d-202025e35a03",
  campaignId: "fixture",
  createdAt: "2026-10-24T15:00:00Z",
  groups: SIDES.map((sides, index) => ({
    sides,
    quantity: 1,
    values: [values[index]],
    subtotal: values[index],
  })),
  total: 140,
};
createRoot(document.getElementById("root")!).render(
  <main
    className="dice-workspace"
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)",
      padding: "28px",
      background: "#ead9b1",
      minHeight: "100dvh",
    }}
  >
    <style>{`html,body,#root{height:auto;overflow:auto}.fixture-faces{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.fixture-faces figure{margin:0;text-align:center}.fixture-faces .die-face{width:100%;max-width:120px;margin:auto}.fixture-faces figcaption{margin-top:8px;font-size:18px}.fixture-faces .die-d100 .die-value{font-size:28px}`}</style>
    <header className="dice-heading">
      <h1 style={{ fontSize: 32 }}>Dice visual check</h1>
      <p>
        Synthetic fixture: fixed values to check shapes, 6/9 and d100. These are
        not campaign rolls.
      </p>
    </header>
    <DiceScene roll={roll} animate={false} onDone={() => {}} />
    <section
      className="fixture-faces"
      aria-label="Fixed values for visual inspection"
    >
      {SIDES.map((sides, index) => (
        <figure key={sides}>
          <DieFace sides={sides}>
            <SlotNumber value={values[index]} animate={false} />
          </DieFace>
          <figcaption>
            d{sides} · {values[index]}
          </figcaption>
        </figure>
      ))}
      {[6, 9].map((value) => (
        <figure key={`contrast-${value}`}>
          <DieFace sides={100}>
            <SlotNumber value={value} animate={false} />
          </DieFace>
          <figcaption>d100 · {value}</figcaption>
        </figure>
      ))}
    </section>
  </main>,
);
