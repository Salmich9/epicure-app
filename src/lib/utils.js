import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Formatage monétaire MAD ──────────────────────────────────
export const formatMAD = (amount, options = {}) => {
  if (amount == null || amount === '') return '— MAD';
  const num = Number(amount);
  if (isNaN(num)) return '— MAD';
  return (
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: options.decimals ?? 2,
      maximumFractionDigits: options.decimals ?? 2,
    }).format(num) + ' MAD'
  );
};

// ── Formatage de quantité (décimales si nécessaire) ──────────
export const formatQty = (qty) => {
  if (qty == null) return '0';
  const n = Number(qty);
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n);
};

// ── Dates ────────────────────────────────────────────────────
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(d, 'dd MMMM yyyy', { locale: fr });
  } catch { return dateStr; }
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(d, "dd/MM/yyyy 'à' HH:mm", { locale: fr });
  } catch { return dateStr; }
};

// ── Slugs / clés ─────────────────────────────────────────────
export const cn = (...classes) => classes.filter(Boolean).join(' ');
