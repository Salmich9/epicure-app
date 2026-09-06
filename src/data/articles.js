import { supabase } from '../lib/supabase';
import { compresserImage } from '../lib/image';
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

// Le bucket s'appelle `article_photos`, avec un souligne. Le code visait
// `article-photos` avec un tiret : le televersement echouait donc toujours,
// sur un bucket introuvable.
const BUCKET_PHOTOS = 'article_photos';

// Upload photo vers Supabase Storage (bucket public).
//
// L'image est compressee AVANT l'envoi : une vignette suffit a reconnaitre un
// article dans une liste, et le reseau d'un depot n'est pas celui d'un bureau.
// Voir `lib/image.js` pour les reglages.
export const uploadArticlePhoto = async (file, articleId) => {
  const compresse = await compresserImage(file);

  // Le nom porte l'horodatage : sans lui, le CDN continuerait de servir
  // l'ancienne image apres un remplacement, et l'utilisateur croirait que
  // son envoi n'a pas fonctionne.
  const extension = compresse.type === 'image/webp' ? 'webp'
                  : compresse.type === 'image/png'  ? 'png' : 'jpg';
  const chemin = `${articleId}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_PHOTOS)
    .upload(chemin, compresse, { upsert: true, contentType: compresse.type });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET_PHOTOS).getPublicUrl(chemin);
  return data.publicUrl;
};

// Retire la photo d'un article, du stockage comme de la fiche.
export const supprimerArticlePhoto = async (photoUrl) => {
  if (!photoUrl) return;
  const nom = photoUrl.split('/').pop()?.split('?')[0];
  if (nom) await supabase.storage.from(BUCKET_PHOTOS).remove([nom]);
};
