import { cn } from '../../lib/utils';

const variants = {
  primary:   'bg-primary text-white hover:bg-primary-600 active:bg-primary-700',
  accent:    'bg-accent text-white hover:bg-accent-600 active:bg-accent-700',
  outline:   'border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-warm-100',
  ghost:     'text-[var(--color-text-muted)] hover:bg-warm-100',
  danger:    'bg-red-600 text-white hover:bg-red-700',
  dangerOutline: 'border border-red-300 text-red-600 hover:bg-red-50',
};

const sizes = {
  sm:   'h-9 px-3 text-sm',
  md:   'h-11 px-4 text-sm',
  lg:   'h-12 px-6 text-base',
  icon: 'h-10 w-10 p-0 flex items-center justify-center',
};

const Button = ({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  loading,
  children,
  ...props
}) => (
  <button
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)]',
      'font-medium transition-colors duration-150 select-none',
      'disabled:opacity-50 disabled:pointer-events-none',
      'min-h-[44px] min-w-[44px]',
      variants[variant],
      sizes[size],
      className
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading && (
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    )}
    {children}
  </button>
);

export default Button;
