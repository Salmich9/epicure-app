import { supabase } from '../lib/supabase';

// Charge toutes les réponses d'un événement sous forme { question_key: value }
// Les multi_select sont désérialisés en tableaux.
export const fetchBriefing = async (eventId) => {
  const { data, error } = await supabase
    .from('event_briefing')
    .select('question_key, answer_value')
    .eq('event_id', eventId);
  if (error) throw error;

  const answers = {};
  (data ?? []).forEach(({ question_key, answer_value }) => {
    if (!answer_value) { answers[question_key] = ''; return; }
    if (answer_value.startsWith('[')) {
      try { answers[question_key] = JSON.parse(answer_value); return; } catch {}
    }
    answers[question_key] = answer_value;
  });
  return answers;
};

// Sauvegarde un sous-ensemble de réponses (upsert).
// Les valeurs tableau (multi_select) sont sérialisées en JSON.
export const saveBriefingAnswers = async (eventId, sectionAnswers) => {
  const rows = Object.entries(sectionAnswers)
    .map(([question_key, value]) => ({
      event_id: eventId,
      question_key,
      answer_value: Array.isArray(value) ? JSON.stringify(value) : String(value ?? ''),
      answered_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('event_briefing')
    .upsert(rows, { onConflict: 'event_id,question_key' });
  if (error) throw error;
};

