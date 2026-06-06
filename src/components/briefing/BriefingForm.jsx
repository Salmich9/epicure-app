import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, Save, Camera, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { BRIEFING_SECTIONS, isVisible, sectionStatus } from '../../data/briefingConfig';
import { fetchBriefing, saveBriefingAnswers, uploadBriefingPhoto } from '../../data/briefing';
import { cn } from '../../lib/utils';
import { PageLoader } from '../ui/Spinner';

// ── Inputs atomiques ──────────────────────────────────────────

const baseInput = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white';

const TextInput = ({ question, value, onChange }) => {
  const val = value ?? '';
  return question.multiline ? (
    <textarea
      className={cn(baseInput, 'resize-y min-h-[96px]')}
      value={val}
      placeholder={question.placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
    />
  ) : (
    <input
      type="text"
      className={baseInput}
      value={val}
      placeholder={question.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

const NumberInput = ({ question, value, onChange }) => (
  <input
    type="number"
    className={cn(baseInput, 'max-w-[180px]')}
    value={value ?? ''}
    placeholder={question.placeholder ?? '0'}
    min="0"
    onChange={(e) => onChange(e.target.value)}
  />
);

const SelectOne = ({ question, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {question.options.map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(value === opt ? '' : opt)}
        className={cn(
          'px-4 py-2 rounded-full text-sm font-medium border transition-colors min-h-[36px]',
          value === opt
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-[var(--color-text)] border-[var(--color-border)] hover:border-primary/50'
        )}
      >
        {opt}
      </button>
    ))}
  </div>
);

const MultiSelect = ({ question, value, onChange }) => {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (opt) => {
    const next = selected.includes(opt)
      ? selected.filter((v) => v !== opt)
      : [...selected, opt];
    onChange(next);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {question.options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors min-h-[36px]',
              active
                ? 'bg-primary/10 text-primary border-primary/40'
                : 'bg-white text-[var(--color-text)] border-[var(--color-border)] hover:border-primary/30'
            )}
          >
            {active && <span className="mr-1 text-primary">✓</span>}
            {opt}
          </button>
        );
      })}
    </div>
  );
};

const MediaInput = ({ question, value, onChange, eventId }) => {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadBriefingPhoto(eventId, question.key, file);
      onChange(url);
      toast.success('Photo uploadée');
    } catch {
      toast.error('Upload échoué — vérifiez que le bucket "briefing-photos" existe dans Supabase Storage');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <div className="relative w-fit">
          <img src={value} alt="preview" className="h-32 rounded-[var(--radius-md)] object-cover border border-[var(--color-border)]" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 bg-white rounded-full border border-[var(--color-border)] p-0.5 text-[var(--color-text-muted)] hover:text-red-500"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <label className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-muted)] cursor-pointer hover:border-primary/50 hover:text-primary transition-colors w-fit',
        uploading && 'opacity-50 pointer-events-none'
      )}>
        <Camera size={16} />
        {uploading ? 'Upload en cours…' : value ? 'Remplacer la photo' : 'Ajouter une photo'}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </label>
    </div>
  );
};

// ── Renderer d'une question ───────────────────────────────────

const QuestionField = ({ question, value, onChange, eventId }) => {
  switch (question.type) {
    case 'text':         return <TextInput     question={question} value={value} onChange={onChange} />;
    case 'number':       return <NumberInput   question={question} value={value} onChange={onChange} />;
    case 'select_one':   return <SelectOne     question={question} value={value} onChange={onChange} />;
    case 'multi_select': return <MultiSelect   question={question} value={value} onChange={onChange} />;
    case 'media':        return <MediaInput    question={question} value={value} onChange={onChange} eventId={eventId} />;
    default:             return <TextInput     question={question} value={value} onChange={onChange} />;
  }
};

// ── Indicateur de statut section ──────────────────────────────

const StatusDot = ({ status }) => {
  if (status === 'complete') return <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />;
  if (status === 'partial')  return <Circle size={14} className="text-amber-400 flex-shrink-0 fill-amber-100" />;
  return <Circle size={14} className="text-[var(--color-border)] flex-shrink-0" />;
};

// ── Composant principal ───────────────────────────────────────

const BriefingForm = ({ eventId }) => {
  const [answers,       setAnswers]       = useState({});
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [currentIndex,  setCurrentIndex]  = useState(0);

  // Charge les réponses existantes
  useEffect(() => {
    fetchBriefing(eventId)
      .then(setAnswers)
      .catch(() => toast.error('Impossible de charger le briefing'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const section = BRIEFING_SECTIONS[currentIndex];

  // Questions visibles de la section courante
  const visibleQuestions = section.questions.filter((q) => isVisible(q, answers));

  const setAnswer = useCallback((key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Sauvegarde les réponses de la section courante
  const handleSave = async () => {
    setSaving(true);
    try {
      const sectionAnswers = {};
      visibleQuestions.forEach((q) => { sectionAnswers[q.key] = answers[q.key] ?? ''; });
      await saveBriefingAnswers(eventId, sectionAnswers);
      toast.success('Section sauvegardée');
    } catch (e) {
      toast.error(e.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
    await handleSave();
    if (currentIndex < BRIEFING_SECTIONS.length - 1) setCurrentIndex((i) => i + 1);
  };

  if (loading) return <PageLoader />;

  const statuses = BRIEFING_SECTIONS.map((s) => sectionStatus(s, answers));
  const totalComplete = statuses.filter((s) => s === 'complete').length;
  const progress = Math.round((totalComplete / BRIEFING_SECTIONS.length) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* Barre de progression globale */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            {totalComplete} / {BRIEFING_SECTIONS.length} sections complètes
          </span>
          <span className="text-xs font-bold text-primary">{progress}%</span>
        </div>
        <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Navigation des sections */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {BRIEFING_SECTIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setCurrentIndex(i)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex-shrink-0',
              currentIndex === i
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-primary/40'
            )}
          >
            <StatusDot status={statuses[i]} />
            <span>{i + 1}. {s.title}</span>
          </button>
        ))}
      </div>

      {/* Contenu de la section */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <h3 className="font-display text-lg font-semibold text-[var(--color-text)] mb-4">
          {currentIndex + 1}. {section.title}
        </h3>

        <div className="flex flex-col gap-5">
          {visibleQuestions.length === 0 && (
            <p className="text-sm text-[var(--color-text-faint)] py-4 text-center">
              Aucune question disponible pour cette section avec les réponses actuelles.
            </p>
          )}

          {visibleQuestions.map((question) => (
            <div key={question.key}>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                {question.label}
              </label>
              <QuestionField
                question={question}
                value={answers[question.key]}
                onChange={(val) => setAnswer(question.key, val)}
                eventId={eventId}
              />
            </div>
          ))}
        </div>

        {/* Actions section */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => i - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-[var(--radius-md)] text-sm text-[var(--color-text-muted)] hover:bg-warm-100 disabled:opacity-30 disabled:pointer-events-none transition-colors min-h-[40px]"
          >
            <ChevronLeft size={16} /> Précédent
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium border border-[var(--color-border)] bg-white hover:bg-warm-50 text-[var(--color-text)] disabled:opacity-50 transition-colors min-h-[40px]"
            >
              <Save size={15} />
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>

            {currentIndex < BRIEFING_SECTIONS.length - 1 && (
              <button
                type="button"
                onClick={handleSaveAndNext}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors min-h-[40px]"
              >
                Sauvegarder & Suivant <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BriefingForm;
