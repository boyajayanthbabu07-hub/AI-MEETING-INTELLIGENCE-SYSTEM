import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        let Icon = Info;
        if (toast.type === "success") Icon = CheckCircle2;
        if (toast.type === "error") Icon = AlertCircle;
        if (toast.type === "warning") Icon = AlertTriangle;

        return (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <Icon className="toast-icon" size={20} />
            <div className="toast-content">
              {toast.title && <div className="toast-title">{toast.title}</div>}
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => onRemove(toast.id)}>
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
