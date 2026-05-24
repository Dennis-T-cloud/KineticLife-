import React from "react";
import ReactDOM from "react-dom/client";
// @ts-ignore – JSX module, TS config has allowJs:false but Vite handles transpilation
import KineticLifeApp from "./routes/kineticlife-app";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <KineticLifeApp />
  </React.StrictMode>,
);
