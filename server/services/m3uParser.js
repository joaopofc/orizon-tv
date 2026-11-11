import readline from 'readline';
import { Readable } from 'stream';

/**
 * Parser de alta performance para listas M3U / M3U8 Plus
 */
export async function parseM3U(contentOrStream) {
  let stream;
  if (typeof contentOrStream === 'string') {
    stream = Readable.from(contentOrStream);
  } else {
    stream = contentOrStream;
  }

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  const channels = [];
  const categoriesSet = new Set();
  let currentItem = null;
  let customHeaders = {};

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentItem = parseExtInf(line);
      customHeaders = {};
    } else if (line.startsWith('#EXTVLCOPT:')) {
      // Exemplo: #EXTVLCOPT:http-user-agent=Mozilla/5.0
      const opt = line.substring(11);
      const eqIdx = opt.indexOf('=');
      if (eqIdx !== -1) {
        const key = opt.substring(0, eqIdx).trim();
        const val = opt.substring(eqIdx + 1).trim();
        customHeaders[key] = val;
      }
    } else if (!line.startsWith('#')) {
      // Linha de URL
      if (currentItem) {
        currentItem.url = line;
        currentItem.headers = { ...customHeaders };
        
        // Categoria padrão caso não exista
        if (!currentItem.category || currentItem.category.trim() === '') {
          currentItem.category = 'Outros';
        }
        categoriesSet.add(currentItem.category);

        channels.push(currentItem);
        currentItem = null;
      }
    }
  }

  return {
    categories: Array.from(categoriesSet).sort(),
    channels,
    total: channels.length
  };
}

function parseExtInf(line) {
  // Exemplo: #EXTINF:-1 tvg-id="Globo.br" tvg-name="Globo SP" tvg-logo="https://..." group-title="Abertos", Globo SP HD
  const commaIndex = line.lastIndexOf(',');
  let name = 'Sem Nome';
  let attributesString = line;

  if (commaIndex !== -1) {
    name = line.substring(commaIndex + 1).trim();
    attributesString = line.substring(0, commaIndex);
  }

  const tvgId = extractAttr(attributesString, 'tvg-id');
  const tvgName = extractAttr(attributesString, 'tvg-name');
  const tvgLogo = extractAttr(attributesString, 'tvg-logo');
  const groupTitle = extractAttr(attributesString, 'group-title');
  const catchup = extractAttr(attributesString, 'catchup');

  return {
    id: `ch_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
    name: name || tvgName || 'Canal Desconhecido',
    tvgId: tvgId || '',
    tvgName: tvgName || name || '',
    logo: tvgLogo || '',
    category: groupTitle || 'Geral',
    catchup: catchup || null
  };
}

function extractAttr(str, attrName) {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = str.match(regex);
  if (match) return match[1];

  // Tenta sem aspas
  const regexNoQuotes = new RegExp(`${attrName}=([^\\s]+)`, 'i');
  const matchNoQuotes = str.match(regexNoQuotes);
  return matchNoQuotes ? matchNoQuotes[1] : '';
}
