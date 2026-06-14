import { useState } from 'react';
import { cn } from '../../lib/utils';
import BriefingSection1 from './BriefingSection1';
import BriefingSection2 from './BriefingSection2';
import BriefingSection3 from './BriefingSection3';

const SECTIONS = [
  { id: 's1', label: '1. Informations client',    Component: BriefingSection1 },
  { id: 's2', label: '2. Configuration des bars', Component: BriefingSection2 },
  { id: 's3', label: '3. Menu par bar',           Component: BriefingSection3 },
];

const BriefingTabs = ({ eventId }) => {
  const [active, setActive] = useState('s1');
  const current = SECTIONS.find((s) => s.id === active);

  return (
    <div className="flex flex-col gap-4">
      {/* Navigation sections */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(s.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex-shrink-0 min-h-[36px]',
              active === s.id
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-primary/40'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Section active */}
      {current && <current.Component eventId={eventId} />}
    </div>
  );
};

export default BriefingTabs;
