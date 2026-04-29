import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <main>
      <h1>KineticLife</h1>
      <p>Phone/iPad PWA scaffold is ready.</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
