import { cn } from '../../lib/utils';

const Spinner = ({ size = 'md', className }) => {
  const s = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' }[size];
  return (
    <span
      className={cn(
        'border-2 border-[var(--color-border)] border-t-primary rounded-full animate-spin block',
        s, className
      )}
    />
  );
};

export const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-[50vh]">
    <Spinner size="lg" />
  </div>
);

export default Spinner;
