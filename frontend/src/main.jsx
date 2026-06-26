import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { PlatformAuthProvider } from "./context/PlatformAuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlatformAuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </PlatformAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
