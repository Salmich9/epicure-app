// Compression des photos d'article, dans le navigateur, avant tout envoi.
//
// Ces photos servent à reconnaître un article dans une liste — « c'est bien
// cette coupette-là » — pas à l'admirer. Une vignette floue de 15 Ko répond à
// la question ; une photo de téléphone de 4 Mo y répond aussi, mais coûte
// 250 fois plus de stockage et se charge 250 fois plus lentement sur le
// réseau d'un dépôt.
//
// D'où des réglages volontairement bas. Si le résultat te semble trop flou,
// monte COTE_MAX avant QUALITE : la taille d'affichage se voit, la
// compression JPEG beaucoup moins.

const COTE_MAX = 400;   // pixels sur le plus grand côté
const QUALITE = 0.5;    // 0 à 1
const TAILLE_VISEE = 512000; // le plafond du bucket, en octets

// WebP compresse mieux que JPEG à qualité égale, et tous les navigateurs
// actuels savent l'encoder. Le repli existe pour les vieux Safari.
const formatSupporte = () => {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL('image/webp').startsWith('data:image/webp')
      ? 'image/webp' : 'image/jpeg';
  } catch {
    return 'image/jpeg';
  }
};

const chargerImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });

const versBlob = (canvas, type, qualite) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression impossible'))),
      type,
      qualite,
    );
  });

/**
 * Réduit et compresse une image. Rend un File prêt à téléverser.
 *
 * Si quoi que ce soit échoue — format exotique, canvas indisponible — le
 * fichier d'origine est rendu tel quel : mieux vaut une photo lourde que pas
 * de photo. Le plafond du bucket reste là pour trancher.
 */
export const compresserImage = async (file, options = {}) => {
  const coteMax = options.coteMax ?? COTE_MAX;
  const qualite = options.qualite ?? QUALITE;

  if (!file || !file.type?.startsWith('image/')) return file;

  try {
    const img = await chargerImage(file);

    const facteur = Math.min(1, coteMax / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * facteur));
    canvas.height = Math.max(1, Math.round(img.height * facteur));

    const ctx = canvas.getContext('2d');
    // Un aplat blanc d'abord : sans lui, une PNG transparente vire au noir
    // une fois encodée en JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const type = formatSupporte();
    let blob = await versBlob(canvas, type, qualite);

    // Filet : une image très bruitée peut rester lourde malgré tout. On
    // redescend la qualité plutôt que de laisser le bucket refuser l'envoi.
    let essai = qualite;
    while (blob.size > TAILLE_VISEE && essai > 0.2) {
      essai -= 0.15;
      blob = await versBlob(canvas, type, essai);
    }

    if (blob.size >= file.size) return file; // déjà plus léger à l'origine

    const extension = type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `photo.${extension}`, { type });
  } catch {
    return file;
  }
};

export const poidsLisible = (octets) =>
  octets >= 1024 * 1024
    ? `${(octets / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.round(octets / 1024)} Ko`;
