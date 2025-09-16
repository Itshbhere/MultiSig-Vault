import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Polyfill for Node.js modules in browser
import { Buffer } from 'buffer';
window.Buffer = Buffer;
window.global = globalThis;

// Process polyfill
if (!window.process) {
  window.process = { env: {} };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
