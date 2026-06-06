import { WifiOff, RefreshCw } from 'lucide-react';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { getQueueLength } from '../../lib/syncQueue';
import { cn } from '../../lib/utils';

const OfflineBanner = () => {
  const isOnline = useOnlineStatus();
  const pending  = getQueueLength();

  if (isOnline && pending === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium',
        isOnline
          ? 'bg-primary text-white'
          : 'bg-gray-800 text-white'
      )}
    >
      {isOnline ? (
        <>
          <RefreshCw size={14} className="animate-spin" />
          Synchronisation en cours… ({pending} opération{pending > 1 ? 's' : ''})
        </>
      ) : (
        <>
          <WifiOff size={14} />
          Hors-ligne — les données affichées peuvent être en cache
        </>
      )}
    </div>
  );
};

export default OfflineBanner;
