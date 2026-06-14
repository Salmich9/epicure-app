-- ============================================================
-- EPICURE — Migration 009 : Table app_settings
-- Toutes les valeurs métier configurables, jamais hardcodées.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Valeurs par défaut
INSERT INTO app_settings (key, value, label, description) VALUES
  ('devise',                 'MAD',  'Devise',                      'Devise utilisée pour les prix et valeurs'),
  ('taux_retour_alerte',     '80',   'Taux de retour alerte (%)',   'Taux de retour minimum attendu par événement (en %). En dessous = alerte.'),
  ('seuil_ecart_valeur',     '500',  'Seuil écart valeur (MAD)',    'Valeur MAD à partir de laquelle un écart est considéré significatif sur le dashboard.'),
  ('stock_alerte_defaut',    '5',    'Seuil stock alerte par défaut','Seuil d''alerte stock appliqué aux nouveaux articles si non renseigné.'),
  ('dashboard_cache_ttl',    '120',  'Cache dashboard (secondes)',  'Durée de cache des KPIs du dashboard en secondes.'),
  ('max_articles_panier',    '200',  'Max articles par panier',     'Nombre maximum d''articles différents dans un prélèvement événement.')
ON CONFLICT (key) DO UPDATE
  SET value      = EXCLUDED.value,
      label      = EXCLUDED.label,
      description = EXCLUDED.description,
      updated_at = now();

-- RLS : lecture publique (authentifié), écriture super_admin uniquement via code
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_read" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "app_settings_write" ON app_settings
  FOR ALL USING (true);
