import { formatMAD } from '../../lib/utils';

/**
 * L'évolution de la valeur du dépôt, en barres.
 *
 * DES BARRES, ET PAS UNE COURBE. Une ligne relie ses points, donc elle affirme
 * quelque chose entre eux : « le dépôt valait 42 000 MAD le 15 juillet ». C'est
 * faux — la valeur entre deux inventaires n'a pas été comptée, elle a été
 * calculée, et c'est justement ce que l'inventaire suivant vient corriger. Les
 * inventaires ne sont pas non plus régulièrement espacés : la pente d'une
 * courbe serait un artefact de l'axe des abscisses. Des barres disent « voici
 * N mesures », ce qui est exactement vrai.
 *
 * DESSINÉ À LA MAIN, ET C'EST DÉLIBÉRÉ. Le projet n'embarque aucune
 * bibliothèque de graphiques et ne contient pas un seul SVG. Recharts pèserait
 * une centaine de kilo-octets compressés pour quatre à douze points par an —
 * sur un bundle déjà à 156 ko, pour un écran consulté quelques fois par mois.
 *
 * LA TABLE RESTE SOUS LE GRAPHIQUE. Une barre se compare, elle ne se lit pas :
 * personne ne déduit « 42 137 MAD » d'une hauteur.
 */
const BarresValeurs = ({ points = [], hauteur = 140 }) => {
  if (points.length === 0) return null;

  const valeurs = points.map((p) => Number(p.valeur ?? 0));
  const max = Math.max(...valeurs, 1);

  return (
    <div className="bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 mb-4 overflow-x-auto">
      <div
        className="flex items-end gap-2 min-w-fit"
        style={{ height: hauteur }}
        role="img"
        aria-label={`Valeur du dépôt sur ${points.length} inventaire${points.length > 1 ? 's' : ''}, de ${formatMAD(valeurs[0])} à ${formatMAD(valeurs[valeurs.length - 1])}`}
      >
        {points.map((p, i) => {
          // Un plancher à 4 px : une valeur non nulle mais minuscule doit
          // rester visible, sinon la barre disparaît et le point avec elle.
          const h = Math.max(4, Math.round((Number(p.valeur ?? 0) / max) * (hauteur - 28)));
          const dernier = i === points.length - 1;
          return (
            <div key={p.id ?? i} className="flex flex-col items-center justify-end gap-1 flex-1 min-w-[38px]">
              <span className="text-[10px] text-[var(--color-text-faint)] whitespace-nowrap tabular-nums">
                {Math.round(Number(p.valeur ?? 0) / 1000)}k
              </span>
              <div
                className={`w-full rounded-t transition-none ${dernier ? 'bg-primary' : 'bg-primary/35'}`}
                style={{ height: h }}
                title={`${p.label} — ${formatMAD(p.valeur)}`}
              />
              <span className="text-[10px] text-[var(--color-text-faint)] whitespace-nowrap">{p.abrege}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BarresValeurs;
