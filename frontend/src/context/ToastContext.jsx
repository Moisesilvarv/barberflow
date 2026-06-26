import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, type = "info", duration = 4200 }) => {
      const id = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { id, message, type }]);
      window.setTimeout(() => removeToast(id), duration);
      return id;
    },
    [removeToast],
  );

  const value = useMemo(
    () => ({
      showToast,
      success: (message) => showToast({ message, type: "success" }),
      error: (message) => showToast({ message, type: "error" }),
      info: (message) => showToast({ message, type: "info" }),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <button
            className={`toast toast-${toast.type}`}
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            type="button"
          >
            <span aria-hidden="true">{toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "i"}</span>
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
