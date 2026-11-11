/**
 * Utilitário de formatação e limpeza inteligente para Séries e Episódios
 */

export const cleanEpisodeTitle = (rawTitle, episodeNum, seriesName = '') => {
  const defaultTitle = `Episódio ${episodeNum || 1}`;
  if (!rawTitle) return defaultTitle;

  let title = String(rawTitle).trim();

  // Remove tags comuns do IPTV como [L], [D], [FHD], [4K], etc.
  title = title.replace(/\[\s*(L|D|LEG|DUB|4K|FHD|HD|SD|DUBLADO|LEGENDADO)\s*\]/gi, '').trim();

  // Se o título contiver o nome da série no início, remove
  if (seriesName) {
    const cleanSeries = seriesName.replace(/\[\s*(L|D|LEG|DUB|4K|FHD|HD|SD|DUBLADO|LEGENDADO)\s*\]/gi, '').trim();
    const escaped = cleanSeries.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`^${escaped}\\s*[-:•–—]?\\s*`, 'i'), '').trim();
  }

  // Detecta se há um código de episódio no início (S01E01, S01 E01, T01E01, EP 01, etc.)
  const codeRegex = /^(?:s\d+\s*e\d+|t\d+\s*e\d+|temporada\s*\d+\s*epis[oó]dio\s*\d+|temp\.?\s*\d+\s*ep\.?\s*\d+|ep\.?\s*\d+|e\d+)\s*[-:•–—]?\s*(.*)$/i;
  const match = title.match(codeRegex);

  if (match) {
    const leftover = (match[1] || '').trim();
    // Se sobrou um nome real específico (ex: "O Começo de Tudo")
    if (leftover && !/^(?:epis[oó]dio|ep|cap[ií]tulo)\s*\d+$/i.test(leftover) && leftover.length >= 2) {
      return leftover;
    }
    return defaultTitle;
  }

  // Se o título que sobrou for exatamente o código da temporada/episódio ou ficou vazio
  if (!title || /^(?:s\d+\s*e\d+|t\d+\s*e\d+|temporada\s*\d+|ep\s*\d+|epis[oó]dio\s*\d+)$/i.test(title)) {
    return defaultTitle;
  }

  // Se o que sobrou é idêntico ao nome da série, volta para "Episódio X"
  if (seriesName && title.toLowerCase() === seriesName.toLowerCase()) {
    return defaultTitle;
  }

  return title;
};

/**
 * Formata duração em minutos limpos (ex: "00:45:20" -> "45 min" ou "1h 15m")
 */
export const formatEpisodeDuration = (durationStr, durationSecs) => {
  if (durationSecs && durationSecs > 0) {
    const mins = Math.round(durationSecs / 60);
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${mins} min`;
  }

  if (typeof durationStr === 'string' && durationStr.includes(':')) {
    const parts = durationStr.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 3) {
      const [h, m] = parts;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m} min`;
    }
  }

  return '';
};

