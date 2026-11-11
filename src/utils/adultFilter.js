// Utilitário central de detecção de conteúdo e categorias adultas (+18 / XXX)
export const isAdultContent = (name = '', category = '') => {
  const combined = `${name || ''} ${category || ''}`.trim();
  if (!combined) return false;
  return /\b(xxx|adult[ao]s?|adults?|18\+|porno?s?|porn|playboy|sexy|venus|prive|privé|penthouse|hustler|brazzers|red\s*hot|erotic[ao]s?|erótic[ao]s?|sensual|hentai|onlyfans|amador|sex|babes|fetish|hardcore|softcore|for\s*man|camerashow|xvideos|pornhub|redhot|sexx)\b|\+18|18\+|\[\+?18\]|\(18\+\)/i.test(combined);
};

