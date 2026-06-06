import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

/**
 * Dialog de confirmation générique.
 * Props : open, onClose, onConfirm, title, message, confirmLabel, loading
 */
const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirmer',
  message,
  confirmLabel = 'Confirmer',
  danger = false,
  loading = false,
}) => (
  <Modal open={open} onClose={onClose} size="sm">
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className={`p-3 rounded-full ${danger ? 'bg-red-100' : 'bg-warm-100'}`}>
        <AlertTriangle size={24} className={danger ? 'text-red-500' : 'text-[var(--color-text-muted)]'} />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {message && <p className="text-sm text-[var(--color-text-muted)]">{message}</p>}
      <div className="flex gap-3 w-full mt-2">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          className="flex-1"
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);

export default ConfirmDialog;
