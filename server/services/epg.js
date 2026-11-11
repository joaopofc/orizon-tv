import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import zlib from 'zlib';


export class EPGService {
  constructor() {
    this.epgData = new Map();
    this.lastUpdated = null;
  }

  async loadFromUrl(url) {
    if (!url) return false;
    try {
      console.log('[EPG] Baixando guia de programação de:', url);
      const isGz = url.endsWith('.gz');

      const response = await axios.get(url, {
        responseType: isGz ? 'arraybuffer' : 'text',
        timeout: 45000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      let xmlText = '';
      if (isGz) {
        xmlText = zlib.gunzipSync(response.data).toString('utf-8');
      } else {
        xmlText = response.data;
      }

      this.parseXML(xmlText);
      this.lastUpdated = Date.now();
      console.log(`[EPG] Guia carregado com sucesso. ${this.epgData.size} canais mapeados.`);
      return true;
    } catch (err) {
      console.error('[EPG Error] Falha ao processar EPG:', err.message);
      return false;
    }
  }

  parseXML(xmlText) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });

    const parsed = parser.parse(xmlText);
    const tv = parsed.tv;
    if (!tv) return;

    this.epgData.clear();

    const programmes = Array.isArray(tv.programme) ? tv.programme : (tv.programme ? [tv.programme] : []);

    for (const prog of programmes) {
      const channelId = prog['@_channel'];
      if (!channelId) continue;

      const title = typeof prog.title === 'string' ? prog.title : (prog.title ? prog.title['#text'] || '' : '');
      const desc = typeof prog.desc === 'string' ? prog.desc : (prog.desc ? prog.desc['#text'] || '' : '');
      const startStr = prog['@_start'];
      const stopStr = prog['@_stop'];

      const start = parseXMLTVDate(startStr);
      const stop = parseXMLTVDate(stopStr);

      if (!this.epgData.has(channelId)) {
        this.epgData.set(channelId, []);
      }

      this.epgData.get(channelId).push({
        title,
        desc,
        start,
        stop
      });
    }
  }

  getChannelProgrammes(channelId) {
    if (!channelId) return [];
    return this.epgData.get(channelId) || [];
  }

  getCurrentAndNext(channelId) {
    const list = this.getChannelProgrammes(channelId);
    if (!list.length) return { current: null, next: null };

    const now = Date.now();
    let current = null;
    let next = null;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (item.start <= now && item.stop >= now) {
        current = item;
        next = list[i + 1] || null;
        break;
      }
    }

    return { current, next };
  }
}

function parseXMLTVDate(str) {
  // Exemplo: 20261027050000 +0000
  if (!str) return 0;
  const match = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!match) return 0;

  const [_, year, month, day, hour, min, sec] = match;
  return new Date(Date.UTC(+year, +month - 1, +day, +hour, +min, +sec)).getTime();
}

export const epgService = new EPGService();
