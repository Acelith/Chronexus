import LocalizationRoot from "./i18n/LocalizationRoot";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./reference-theme.css";
import "./i18n/languages.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocalizationRoot>
      <App />
    </LocalizationRoot>
  </React.StrictMode>,
);
