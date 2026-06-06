import { cn } from '../../lib/utils';

const variants = {
  retournable: 'bg-primary-100 text-primary-600 border-primary-200',
  consommable: 'bg-accent-100  text-accent-600  border-accent-200',
  brouillon:   'bg-yellow-100  text-yellow-700  border-yellow-200',
  valide:      'bg-green-100   text-green-700   border-green-200',
  default:     'bg-warm-100    text-warm-700    border-warm-200',
};

const Badge = ({ children, variant = 'default', className }) => (
  <span
    className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      variants[variant] ?? variants.default,
      className
    )}
  >
    {children}
  </span>
);

export default Badge;
