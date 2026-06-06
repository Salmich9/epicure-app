// ============================================================
// EPICURE — Configuration du Briefing Événement
// SOURCE DE VÉRITÉ UNIQUE : toute la structure du formulaire
// est ici. Le composant de rendu est générique.
//
// Pour modifier le formulaire : éditer ce fichier uniquement.
// Aucune logique métier dans le renderer.
// ============================================================

export const BRIEFING_SECTIONS = [
  // ── 1. Informations générales ────────────────────────────
  {
    id: 'infos_generales',
    title: 'Informations générales',
    questions: [
      { key: 'responsable_evenement',    label: 'Responsable événement',          type: 'text',       placeholder: 'Nom et prénom' },
      { key: 'responsable_coordination', label: 'Responsable coordination',        type: 'text',       placeholder: 'Nom et prénom' },
      { key: 'date_evenement',           label: 'Date de l\'événement',            type: 'text',       placeholder: 'JJ/MM/AAAA' },
      { key: 'jour_semaine',             label: 'Jour de la semaine',              type: 'select_one', options: ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'] },
      { key: 'type_prestation',          label: 'Type de prestation boissons',     type: 'select_one', options: ['Cocktails','Verse','Les deux'] },
      { key: 'ville',                    label: 'Ville',                           type: 'text',       placeholder: 'Ex : Casablanca' },
      { key: 'lieu',                     label: 'Lieu / Salle',                    type: 'text',       placeholder: 'Nom du lieu' },
      { key: 'lieu_maps',                label: 'Lien Google Maps',                type: 'text',       placeholder: 'https://maps.google.com/...' },
      { key: 'nature_evenement',         label: 'Nature de l\'événement',          type: 'text',       placeholder: 'Ex : Mariage, Corporate, Birthday...' },
      { key: 'heure_debut',              label: 'Heure de début',                  type: 'text',       placeholder: 'Ex : 19h00' },
      { key: 'heure_fin',                label: 'Heure de fin',                    type: 'text',       placeholder: 'Ex : 02h00' },
      { key: 'duree',                    label: 'Durée',                           type: 'text',       placeholder: 'Ex : 7h' },
      { key: 'theme',                    label: 'Thème',                           type: 'text',       placeholder: 'Ex : Tropical, Black & White...' },
      { key: 'nb_invites',               label: 'Nombre d\'invités',               type: 'number',     placeholder: '0' },
      { key: 'tranche_age',              label: 'Tranche d\'âge dominante',        type: 'select_one', options: ['Moins de 25 ans','25–35 ans','35–50 ans','50+ ans','Mixte'] },
      { key: 'nationalites',             label: 'Nationalités dominantes',         type: 'text',       placeholder: 'Ex : Marocain, Français...' },
    ],
  },

  // ── 2. Agence & Client ───────────────────────────────────
  {
    id: 'agence_client',
    title: 'Agence & Client',
    questions: [
      { key: 'agence_intermediaire',   label: 'Agence intermédiaire ?',                   type: 'select_one', options: ['Oui','Non'] },
      { key: 'agence_nom',             label: 'Nom de l\'agence',                         type: 'text',       showIf: { question_key: 'agence_intermediaire', operator: 'equals', value: 'Oui' } },
      { key: 'agence_contact',         label: 'Contact agence',                           type: 'text',       showIf: { question_key: 'agence_intermediaire', operator: 'equals', value: 'Oui' } },
      { key: 'agence_telephone',       label: 'Téléphone agence',                         type: 'text',       showIf: { question_key: 'agence_intermediaire', operator: 'equals', value: 'Oui' } },
      { key: 'agence_externe',         label: 'Agence externe (autre que intermediaire) ?', type: 'select_one', options: ['Oui','Non'] },
      { key: 'client_final',           label: 'Client final',                             type: 'text',       placeholder: 'Nom ou raison sociale' },
      { key: 'google_agenda',          label: 'Google Agenda créé ?',                     type: 'select_one', options: ['Oui','Non'] },
      { key: 'google_agenda_invites',  label: 'Invités à ajouter au Google Agenda',       type: 'text',       multiline: true, placeholder: 'Emails séparés par des virgules', showIf: { question_key: 'google_agenda', operator: 'equals', value: 'Oui' } },
    ],
  },

  // ── 3. Responsables opérationnels ────────────────────────
  {
    id: 'responsables_operationnels',
    title: 'Responsables opérationnels',
    questions: [
      { key: 'responsable_mixologie',         label: 'Responsable mixologie',  type: 'select_one', options: ['Salmane Tazi','Adam Benali','Yasmine Alaoui','Mehdi Karimi','Autre'] },
      { key: 'responsable_mixologie_autre',   label: 'Précisez (mixologie)',   type: 'text',       showIf: { question_key: 'responsable_mixologie',  operator: 'equals', value: 'Autre' } },
      { key: 'responsable_logistique',        label: 'Responsable logistique', type: 'select_one', options: ['Salmane Tazi','Adam Benali','Yasmine Alaoui','Mehdi Karimi','Autre'] },
      { key: 'responsable_logistique_autre',  label: 'Précisez (logistique)',  type: 'text',       showIf: { question_key: 'responsable_logistique', operator: 'equals', value: 'Autre' } },
      { key: 'responsable_service',           label: 'Responsable service',    type: 'select_one', options: ['Salmane Tazi','Adam Benali','Yasmine Alaoui','Mehdi Karimi','Autre'] },
      { key: 'responsable_service_autre',     label: 'Précisez (service)',     type: 'text',       showIf: { question_key: 'responsable_service',    operator: 'equals', value: 'Autre' } },
    ],
  },

  // ── 4. Bars & Service ────────────────────────────────────
  {
    id: 'bars_service',
    title: 'Bars & Service',
    questions: [
      { key: 'nb_bars',           label: 'Nombre de bars',        type: 'select_one', options: ['1','2','3','4','5'] },
      { key: 'emplacement_bar_1', label: 'Emplacement bar 1',     type: 'text',       showIf: { question_key: 'nb_bars', operator: 'is_not_blank', value: '' } },
      { key: 'emplacement_bar_2', label: 'Emplacement bar 2',     type: 'text',       showIf: { question_key: 'nb_bars', operator: 'greater_than', value: '1' } },
      { key: 'emplacement_bar_3', label: 'Emplacement bar 3',     type: 'text',       showIf: { question_key: 'nb_bars', operator: 'greater_than', value: '2' } },
      { key: 'emplacement_bar_4', label: 'Emplacement bar 4',     type: 'text',       showIf: { question_key: 'nb_bars', operator: 'greater_than', value: '3' } },
      { key: 'emplacement_bar_5', label: 'Emplacement bar 5',     type: 'text',       showIf: { question_key: 'nb_bars', operator: 'greater_than', value: '4' } },
      { key: 'ramener_bar',       label: 'Devons-nous ramener notre bar ?',  type: 'select_one', options: ['Oui','Non'] },
      { key: 'agence_fournit_bar',label: 'L\'agence fournit-elle le bar ?', type: 'select_one', options: ['Oui','Non'] },
    ],
  },

  // ── 5. Boissons & Cocktails ──────────────────────────────
  {
    id: 'boissons_cocktails',
    title: 'Boissons & Cocktails',
    questions: [
      // Cocktails — visibles si prestation ≠ Verse
      {
        key: 'cocktails_noms', label: 'Cocktails prévus', type: 'multi_select',
        options: [
          'Mojito','Cosmopolitan','Margarita','Daiquiri','Piña Colada',
          'Negroni','Aperol Spritz','Bellini','Hugo','Sex on the Beach',
          'Tequila Sunrise','Long Island','Blue Lagoon','Caipirinha',
          'Virgin Mojito','Jus de fruits mixés','Punch maison','Autre',
        ],
        showIf: { question_key: 'type_prestation', operator: 'not_equals', value: 'Verse' },
      },
      {
        key: 'cocktails_details', label: 'Détails cocktails (quantité, verrerie, garnish, recette)',
        type: 'text', multiline: true,
        placeholder: 'Ex :\nMojito — 100 verres — High Ball — Menthe + citron vert\nMargarita — 60 verres — Coupette — Sel + citron',
        showIf: { question_key: 'type_prestation', operator: 'not_equals', value: 'Verse' },
      },
      // Verse — visibles si prestation ≠ Cocktails
      {
        key: 'verse_type_alcool', label: 'Type d\'alcool (verse)', type: 'multi_select',
        options: ['Whisky','Vodka','Rhum','Gin','Tequila','Champagne','Vin rouge','Vin blanc','Rosé','Bière','Autre'],
        showIf: { question_key: 'type_prestation', operator: 'not_equals', value: 'Cocktails' },
      },
      {
        key: 'verse_gamme', label: 'Gamme (verse)', type: 'select_one',
        options: ['Classique','Middle','Premium'],
        showIf: { question_key: 'type_prestation', operator: 'not_equals', value: 'Cocktails' },
      },
      {
        key: 'verse_quantite', label: 'Quantité estimée (verse)', type: 'text',
        placeholder: 'Ex : 20 btl Whisky, 10 btl Vodka...',
        showIf: { question_key: 'type_prestation', operator: 'not_equals', value: 'Cocktails' },
      },
      // Coupages & Eau — toujours visibles
      { key: 'coupages_details',          label: 'Coupages (type, quantité, conditionnement)', type: 'text', multiline: true, placeholder: 'Ex :\nCoca-Cola — 50 canettes\nTonic — 24 canettes\nJus d\'orange — 6 L' },
      { key: 'eau_plate_quantite',         label: 'Eau plate — Quantité',         type: 'text',       placeholder: 'Ex : 48 btl 1.5L' },
      { key: 'eau_plate_conditionnement',  label: 'Eau plate — Conditionnement',  type: 'select_one', options: ['Bouteille 1.5L','Bouteille 50cl','Fontaine','Bonbonne'] },
      { key: 'eau_gazeuse_quantite',       label: 'Eau gazeuse — Quantité',       type: 'text',       placeholder: 'Ex : 24 canettes' },
      { key: 'eau_gazeuse_conditionnement',label: 'Eau gazeuse — Conditionnement',type: 'select_one', options: ['Bouteille 1.5L','Bouteille 50cl','Canette','Fontaine'] },
    ],
  },

  // ── 6. Glace & Verrerie ──────────────────────────────────
  {
    id: 'glace_verrerie',
    title: 'Glace & Verrerie',
    questions: [
      { key: 'glace_type',          label: 'Type de glace',                        type: 'multi_select', options: ['Cube alimentaire','Pilée','Carbonique','Transparente'] },
      { key: 'glace_quantite',      label: 'Quantité de glace',                    type: 'text',         placeholder: 'Ex : 100 kg' },
      { key: 'glace_barometre',     label: 'Prélèvement Baromètre possible ?',     type: 'select_one',   options: ['Oui','Non'] },
      { key: 'verrerie_details',    label: 'Verrerie (type + quantité)',            type: 'text',         multiline: true, placeholder: 'Ex :\nHigh Ball — 120 pcs\nCocktail — 80 pcs\nFlûte — 60 pcs' },
      { key: 'responsable_verrerie',label: 'Responsable verrerie',                 type: 'text',         placeholder: 'Nom et prénom' },
    ],
  },

  // ── 7. Logistique Équipe ─────────────────────────────────
  {
    id: 'logistique_equipe',
    title: 'Logistique Équipe',
    questions: [
      { key: 'uniforme_prevu',         label: 'Uniforme prévu ?',                 type: 'select_one', options: ['Oui','Non'] },
      { key: 'lavage_avant',           label: 'Lavage avant événement ?',         type: 'select_one', options: ['Oui','Non'] },
      { key: 'lavage_apres',           label: 'Lavage après événement ?',         type: 'select_one', options: ['Oui','Non'] },
      { key: 'nourriture_team',        label: 'Nourriture team prévue ?',         type: 'select_one', options: ['Oui','Non'] },
      { key: 'nourriture_provenance',  label: 'Provenance de la nourriture',      type: 'text',       showIf: { question_key: 'nourriture_team', operator: 'equals', value: 'Oui' } },
      { key: 'nourriture_nb_repas',    label: 'Nombre de repas',                  type: 'number',     showIf: { question_key: 'nourriture_team', operator: 'equals', value: 'Oui' } },
      { key: 'nourriture_responsable', label: 'Responsable nourriture',           type: 'text',       showIf: { question_key: 'nourriture_team', operator: 'equals', value: 'Oui' } },
      { key: 'transport_type',         label: 'Type de véhicule',                 type: 'select_one', options: ['Camion','Van','Berline','Utilitaire','Autre'] },
      { key: 'transport_nb',           label: 'Nombre de véhicules',              type: 'number' },
      { key: 'transport_facturation',  label: 'Facturation transport',            type: 'select_one', options: ['Epicure','Client','Agence'] },
      { key: 'talkie_walkie_nb',       label: 'Nombre de talkies-walkies',        type: 'number' },
    ],
  },

  // ── 8. Repérage & Timeline ───────────────────────────────
  {
    id: 'reperage_timeline',
    title: 'Repérage & Timeline',
    questions: [
      { key: 'reperage_effectue',          label: 'Repérage effectué ?',                                                    type: 'select_one', options: ['Oui','Non'] },
      { key: 'reperage_photos_lien',       label: 'Lien photos repérage (WhatsApp, Drive…)',                                 type: 'text', placeholder: 'Coller le lien ici', showIf: { question_key: 'reperage_effectue', operator: 'equals', value: 'Oui' } },
      { key: 'reperage_zones_ok',          label: 'Zones photographiées', type: 'multi_select', options: ['Entrée principale','Entrée service','Bar(s)','Backoffice','Cuisine','Poubelles'], showIf: { question_key: 'reperage_effectue', operator: 'equals', value: 'Oui' } },
      { key: 'timeline_arrivee_equipe',    label: 'Timeline — Arrivée équipe',  type: 'text',       placeholder: 'Ex : 14h00' },
      { key: 'timeline_montage',           label: 'Timeline — Montage',         type: 'text',       placeholder: 'Ex : 14h30 → 17h00' },
      { key: 'timeline_testing',           label: 'Timeline — Testing',         type: 'text',       placeholder: 'Ex : 17h00 → 18h00' },
      { key: 'timeline_debut_event',       label: 'Timeline — Début événement', type: 'text',       placeholder: 'Ex : 18h30' },
      { key: 'timeline_fin_event',         label: 'Timeline — Fin événement',   type: 'text',       placeholder: 'Ex : 01h00' },
      { key: 'timeline_demontage',         label: 'Timeline — Démontage',       type: 'text',       placeholder: 'Ex : 01h00 → 03h00' },
      { key: 'timeline_retour_depot',      label: 'Timeline — Retour dépôt',    type: 'text',       placeholder: 'Ex : 04h00' },
    ],
  },
];

// ── Helpers exportés ──────────────────────────────────────────

// Toutes les questions à plat (pour la résolution récursive des conditions)
export const ALL_QUESTIONS = BRIEFING_SECTIONS.flatMap((s) => s.questions);

// Évalue si une question est visible étant donné l'état des réponses.
// Récursif : si la question référencée est elle-même cachée, la question courante est cachée.
export function isVisible(question, answers) {
  if (!question.showIf) return true;
  const { question_key, operator, value } = question.showIf;

  // Récursivité : la question parente doit elle-même être visible
  const parent = ALL_QUESTIONS.find((q) => q.key === question_key);
  if (parent && !isVisible(parent, answers)) return false;

  const answer = answers[question_key];
  const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

  switch (operator) {
    case 'equals':       return answer === value;
    case 'not_equals':   return answer !== value;
    case 'includes':     return Array.isArray(answer) ? answer.includes(value) : String(answer ?? '').includes(value);
    case 'greater_than': return Number(answer) > Number(value);
    case 'is_blank':     return isEmpty(answer);
    case 'is_not_blank': return !isEmpty(answer);
    default:             return true;
  }
}

// Calcule le statut de complétion d'une section
export function sectionStatus(section, answers) {
  const visible = section.questions.filter((q) => isVisible(q, answers));
  if (visible.length === 0) return 'complete';
  const answered = visible.filter((q) => {
    const v = answers[q.key];
    return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
  });
  if (answered.length === 0) return 'empty';
  if (answered.length === visible.length) return 'complete';
  return 'partial';
}
