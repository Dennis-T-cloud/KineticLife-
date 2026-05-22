import React from "react";
import ReactDOM from "react-dom/client";
// @ts-ignore – JSX module, TS config has allowJs:false but Vite handles transpilation
import AetherisApp from "./routes/aetheris-app";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AetherisApp />
  </React.StrictMode>,
);
