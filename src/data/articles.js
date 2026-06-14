import { supabase } from '../lib/supabase';
import { logAudit } from './auditLog';

export const fetchArticles = async ({ activeOnly = true } = {}) => {
  let q = supabase
    .from('articles')
    .select(`
      *,
      categories:category_id ( id, name, sort_order ),
      units:unit_id ( id, name, abbreviation )
    `)
    .order('name');
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export const createArticle = async (fields, actorId) => {
  const { data, error } = await supabase
    .from('articles')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'article', entityId: data.id, action: 'create', actor: actorId, payload: fields });
  return data;
};

export const updateArticle = async (id, updates, actorId) => {
  const { data, error } = await supabase
    .from('articles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ entity: 'article', entityId: id, action: 'update', actor: actorId, payload: updates });
  return data;
};

// Soft-delete : préserve l'historique
export const deactivateArticle = async (id, actorId) => {
  return updateArticle(id, { active: false }, actorId);
};

// Upload photo vers Supabase Storage (bucket : article-photos, public)
export const uploadArticlePhoto = async (file, articleId) => {
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${articleId}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('article-photos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from('article-photos').getPublicUrl(path);
  return data.publicUrl;
};
