-- =============================================================================
-- 038 — Deux articles actifs ne peuvent plus porter le même nom
--
-- CE QUI S'EST PASSÉ. Le 06/09 à 18h00, un « Plateau service » a été créé à la
-- volée alors qu'un autre existait depuis le 10/06 — dans une autre catégorie,
-- ce qui suffit à ne pas le voir dans la liste. Le second n'a jamais porté de
-- stock ; il a été archivé.
--
-- POURQUOI LE GARDE-FOU DE LA 033 N'A PAS JOUÉ. `enregistrer_achat` réutilise
-- un nom déjà pris plutôt que de le dupliquer — mais l'app n'emprunte pas ce
-- chemin : le formulaire crée d'abord la fiche, puis l'achat référence son
-- identifiant. La RPC reçoit un `article_id` et n'a plus rien à décider.
--
-- D'où le choix de poser la règle EN BASE plutôt que dans un formulaire. Une
-- vérification côté écran ne protège que l'écran qui la porte ; celle-ci vaut
-- pour tous les chemins, présents et à venir — l'app, la RPC, le bot Telegram,
-- l'éditeur SQL.
--
-- INDEX PARTIEL, sur les actifs seulement. Un article archivé garde son nom :
-- il porte de l'histoire, des lignes d'inventaire, des mouvements qu'on ne
-- réécrit pas. Lui interdire son propre nom obligerait à le renommer pour
-- l'archiver, et un « Plateau service (ancien) » dans l'historique ment sur ce
-- qui s'est réellement passé.
--
-- NORMALISATION identique à celle de `enregistrer_achat` : `lower(btrim())`.
-- Les deux doivent s'accorder, sinon la RPC réutiliserait là où l'index refuse,
-- ou l'inverse.
-- =============================================================================

create unique index if not exists idx_articles_nom_unique_actifs
  on articles (lower(btrim(name)))
  where active;

comment on index idx_articles_nom_unique_actifs is
  'Un nom d article actif est unique, casse et espaces de bord ignores. '
  'Partiel : les articles archives gardent leur nom, ils portent de l histoire.';
