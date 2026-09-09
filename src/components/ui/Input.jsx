import { cn } from '../../lib/utils';

const Input = ({ label, error, hint, className, containerClassName, ...props }) => (
  <div className={cn('flex flex-col gap-1', containerClassName)}>
    {label && (
      <label className="text-sm font-medium text-[var(--color-text)]">
        {label}
      </label>
    )}
    <input
      className={cn(
        'h-11 rounded-[var(--radius-md)] border border-[var(--color-border)]',
        'px-3 text-base sm:text-sm bg-white text-[var(--color-text)]',
        'placeholder:text-[var(--color-text-faint)]',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
        'transition-colors duration-150',
        error && 'border-red-400 focus:ring-red-200 focus:border-red-500',
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-500">{error}</p>}
    {hint && !error && <p className="text-xs text-[var(--color-text-faint)]">{hint}</p>}
  </div>
);

export const Select = ({ label, error, children, className, containerClassName, ...props }) => (
  <div className={cn('flex flex-col gap-1', containerClassName)}>
    {label && (
      <label className="text-sm font-medium text-[var(--color-text)]">
        {label}
      </label>
    )}
    <select
      className={cn(
        'h-11 rounded-[var(--radius-md)] border border-[var(--color-border)]',
        'px-3 text-base sm:text-sm bg-white text-[var(--color-text)]',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
        'transition-colors duration-150',
        error && 'border-red-400',
        className
      )}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

export default Input;
