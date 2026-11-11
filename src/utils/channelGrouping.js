/**
 * Utilitário de Normalização e Agrupamento de Canais por Resolução (4K, FHD, HD, SD)
 * Reúne canais idênticos que diferem apenas pela qualidade em uma única entrada.
 */

// Extrai a qualidade e o nome base limpo do canal
export function extractChannelBaseNameAndQuality(rawName = '') {
  if (!rawName || typeof rawName !== 'string') {
    return { baseName: 'Canal', quality: 'HD' };
  }

  let name = rawName.trim();
  let detectedQuality = null;

  // 1. Identifica a qualidade (Prioridade: 4K/UHD > FHD/1080p > HD/720p > SD/480p > H265/HEVC)
  if (/\b(4k|uhd|2160p?)\b/i.test(name) || /\[4k\]|\(4k\)/i.test(name)) {
    detectedQuality = '4K';
  } else if (/\b(fhd|1080p?)\b/i.test(name) || /\[fhd\]|\(fhd\)/i.test(name)) {
    detectedQuality = 'FHD';
  } else if (/\b(hd|720p?)\b/i.test(name) || /\[hd\]|\(hd\)/i.test(name)) {
    detectedQuality = 'HD';
  } else if (/\b(sd|480p?|576p?)\b/i.test(name) || /\[sd\]|\(sd\)/i.test(name)) {
    detectedQuality = 'SD';
  } else if (/\b(hevc|h265|h\.265)\b/i.test(name)) {
    detectedQuality = 'H265';
  }

  // 2. Remove os marcadores de qualidade do nome base para agrupamento perfeito
  let cleaned = name
    // Remove colchetes ou parênteses com tags de qualidade: [4K], (FHD), [1080p], etc.
    .replace(/\[\s*(4k|uhd|2160p?|fhd|1080p?|hd|720p?|sd|480p?|576p?|hevc|h265|h\.265)\s*\]/gi, '')
    .replace(/\(\s*(4k|uhd|2160p?|fhd|1080p?|hd|720p?|sd|480p?|576p?|hevc|h265|h\.265)\s*\)/gi, '')
    // Remove sufixos/prefixos separados por barras, hífens ou dois pontos: " | 4K", " - FHD", etc.
    .replace(/[\s\-_|:]+\s*(4k|uhd|2160p?|fhd|1080p?|hd|720p?|sd|480p?|576p?|hevc|h265|h\.265)\b/gi, '')
    .replace(/\b(4k|uhd|2160p?|fhd|1080p?|hd|720p?|sd|480p?|576p?|hevc|h265|h\.265)\s*[\-_|:]+/gi, '')
    // Remove palavras soltas de qualidade no início ou fim do nome
    .replace(/\b(4k|uhd|2160p?|fhd|1080p?|hd|720p?|sd|480p?|576p?|hevc|h265|h\.265)\b$/gi, '')
    .replace(/^\b(4k|uhd|2160p?|fhd|1080p?|hd|720p?|sd|480p?|576p?|hevc|h265|h\.265)\b/gi, '')
    // Limpa múltiplos espaços
    .replace(/\s+/g, ' ')
    .trim();

  // Remove caracteres residuais pontuais nas bordas: "-", "|", ":", "."
  cleaned = cleaned.replace(/^[\s\-_|:.]+|[\s\-_|:.]+$/g, '').trim();

  // Se por algum motivo o nome ficou vazio, restaura o original
  if (!cleaned) {
    cleaned = name;
  }

  return {
    baseName: cleaned,
    quality: detectedQuality || 'HD'
  };
}

// Ordem de prioridade para classificação e seleção padrão (Maior resolução primeiro)
const QUALITY_WEIGHTS = {
  '4K': 50,
  'FHD': 40,
  'HD': 30,
  'H265': 25,
  'SD': 10
};

/**
 * Agrupa uma lista de canais reunindo as versões de qualidade em um único registro.
 * Cada canal agrupado terá `sources: [{ quality, url, streamId, id, rawName }]`
 */
export function groupChannelsByQuality(channelList = []) {
  if (!Array.isArray(channelList) || channelList.length === 0) {
    return [];
  }

  const groupMap = new Map();

  channelList.forEach((channel, originalIdx) => {
    const rawName = channel.name || 'Canal';
    const { baseName, quality } = extractChannelBaseNameAndQuality(rawName);

    // Chave de agrupamento: Categoria + Nome Base normalizado
    const groupKey = `${(channel.category || '').trim().toLowerCase()}:::${baseName.toLowerCase()}`;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        ...channel,
        id: channel.id || `ch_grp_${originalIdx}`,
        baseName,
        name: baseName, // Nome unificado limpo
        sources: [],
        originalIndex: originalIdx
      });
    }

    const group = groupMap.get(groupKey);

    // Adiciona a fonte se não for duplicata da mesma qualidade
    const existingSource = group.sources.find(s => s.quality === quality);
    if (!existingSource) {
      group.sources.push({
        quality,
        url: channel.url,
        streamId: channel.streamId,
        id: channel.id,
        rawName
      });
    }

    // Preserva o melhor logo disponível
    if (!group.logo && channel.logo) {
      group.logo = channel.logo;
    }
  });

  // Finaliza cada grupo ordenando as fontes pela melhor resolução
  return Array.from(groupMap.values()).map(group => {
    group.sources.sort((a, b) => {
      const weightA = QUALITY_WEIGHTS[a.quality] || 0;
      const weightB = QUALITY_WEIGHTS[b.quality] || 0;
      return weightB - weightA;
    });

    const defaultSource = group.sources[0] || {};
    const defaultQuality = defaultSource.quality || 'HD';

    return {
      ...group,
      url: defaultSource.url || group.url,
      currentQuality: defaultQuality,
      availableQualities: group.sources.map(s => s.quality)
    };
  });
}
