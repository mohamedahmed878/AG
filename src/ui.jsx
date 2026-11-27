import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';

const nf = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });
export const fmt = (n) => nf.format(Number(n) || 0);
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
// التاريخ بتوقيت الجهاز (مش UTC)
export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function CountUp({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = animate(0, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => ref.current && (ref.current.textContent = fmt(v)),
    });
    return () => c.stop();
  }, [value]);
  return <span ref={ref}>{fmt(value)}</span>;
}

export function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 28, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="modal-head">
              <h3>{title}</h3>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">✕</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Field = ({ label, children, hint }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
);

export function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className={'toast' + (toast.error ? ' bad' : '')}
          role="status"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
        >
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Empty = ({ text, action, onAction }) => (
  <div className="empty">
    <p>{text}</p>
    {action && <button className="btn primary" onClick={onAction}>{action}</button>}
  </div>
);
