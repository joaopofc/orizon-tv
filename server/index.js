import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './services/storage.js';
import { parseM3U } from './services/m3uParser.js';
import { XtreamCodesClient } from './services/xtream.js';
import { handleStreamProxy } from './services/proxy.js';
import { epgService } from './services/epg.js';
import { handleImageCache, clearImageCache } from './services/imageCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// Limite ampliado para permitir upload de arquivos M3U grandes
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 1. Status do Servidor
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    app: 'Orizon TV Engine',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
});

// 2. Configurações
app.get('/api/settings', (req, res) => {
  res.json(storage.getSettings());
});

app.post('/api/settings', (req, res) => {
  const updated = storage.updateSettings(req.body);
  res.json(updated);
});

// 3. Gerenciamento de Playlists
app.get('/api/playlists', (req, res) => {
  res.json(storage.getPlaylists());
});

app.post('/api/playlists', async (req, res) => {
  try {
    let { name, type, url, username, password, content, epgUrl, forceM3u } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'O nome da lista é obrigatório' });
    }

    // Auto-detecção de links Xtream disfarçados de M3U (somente se não foi forçado M3U pelo usuário)
    if (!forceM3u && type === 'm3u' && url && (url.includes('get.php') || (url.includes('username=') && url.includes('password=')))) {
      try {
        const parsedUrl = new URL(url);
        const u = parsedUrl.searchParams.get('username') || parsedUrl.searchParams.get('user');
        const p = parsedUrl.searchParams.get('password') || parsedUrl.searchParams.get('pass');
        if (u && p) {
          console.log('[Auto-Detect] URL M3U get.php identificada como servidor Xtream Codes!');
          type = 'xtream';
          const port = parsedUrl.port ? `:${parsedUrl.port}` : '';
          url = `${parsedUrl.protocol}//${parsedUrl.hostname}${port}`;
          username = u;
          password = p;
        }
      } catch (e) {
        console.log('[Auto-Detect] Falha ao parsear URL para Xtream:', e.message);
      }
    }

    const playlistId = `pl_${Date.now()}`;
    let channels = [];
    let categories = [];

    if (type === 'xtream') {
      const client = new XtreamCodesClient(url, username, password);
      const auth = await client.authenticate();
      if (!auth.success) {
        return res.status(400).json({ error: auth.error });
      }

      // Salva a playlist Xtream
      const newPlaylist = storage.savePlaylist({
        id: playlistId,
        name,
        type: 'xtream',
        url,
        username,
        password,
        serverInfo: auth.serverInfo,
        userInfo: auth.userInfo,
        channelsCount: 0
      });

      return res.json({ success: true, playlist: newPlaylist });

    } else {
      // Tipo M3U
      let rawM3U = content;
      if (!rawM3U && url) {
        const cleanUrl = url.trim();
        const localPath = cleanUrl.startsWith('file:///')
          ? cleanUrl.replace('file:///', '')
          : cleanUrl.startsWith('file://')
            ? cleanUrl.replace('file://', '')
            : cleanUrl;

        if (fs.existsSync(localPath)) {
          console.log(`[M3U] Lendo arquivo local de: ${localPath}`);
          rawM3U = fs.readFileSync(localPath, 'utf-8');
        } else {
          console.log(`[M3U] Baixando playlist de: ${cleanUrl}`);
          const response = await axios.get(cleanUrl, {
            timeout: 45000,
            headers: { 'User-Agent': storage.getSettings().userAgent || 'VLC/3.0.18' }
          });
          rawM3U = response.data;
        }
      }

      if (!rawM3U) {
        return res.status(400).json({ error: 'Forneça uma URL válida ou o caminho/conteúdo do arquivo M3U' });
      }

      const parsed = await parseM3U(rawM3U);
      channels = parsed.channels;
      categories = parsed.categories;

      // Se for um stream HLS direto que não tinha múltiplos canais
      if (channels.length === 0 && url && (rawM3U.includes('#EXT-X-') || rawM3U.includes('#EXTINF:'))) {
        channels = [{
          id: `ch_${Date.now()}`,
          name: name || 'Transmissão Ao Vivo',
          tvgId: '',
          tvgName: name || 'Transmissão Ao Vivo',
          logo: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400',
          category: 'Geral',
          catchup: null,
          url: url.trim(),
          headers: {}
        }];
        categories = ['Geral'];
      }

      // Salva os canais no cache em disco
      storage.savePlaylistChannels(playlistId, channels, categories);

      const newPlaylist = storage.savePlaylist({
        id: playlistId,
        name,
        type: 'm3u',
        url: url || '',
        epgUrl: epgUrl || '',
        channelsCount: channels.length,
        categoriesCount: categories.length
      });

      // Se tiver EPG URL configurada, dispara em segundo plano
      if (epgUrl) {
        epgService.loadFromUrl(epgUrl).catch(err => console.error('[EPG Sync Background]', err));
      }

      return res.json({ success: true, playlist: newPlaylist, totalChannels: channels.length });
    }
  } catch (err) {
    console.error('[Create Playlist Error]', err);
    res.status(500).json({ error: `Erro ao adicionar playlist: ${err.message}` });
  }
});

// 4. Reset Total do App (Limpar tudo)
app.post('/api/reset', (req, res) => {
  const cleanData = storage.reset();
  res.json({ success: true, message: 'Dados e listas limpos com sucesso.', data: cleanData });
});

app.delete('/api/playlists/:id', (req, res) => {
  const { id } = req.params;
  const remaining = storage.deletePlaylist(id);

  // Limpa caches de VOD e Séries da playlist excluída
  for (const key of vodCache.keys()) {
    if (key.startsWith(id)) vodCache.delete(key);
  }
  for (const key of seriesCache.keys()) {
    if (key.startsWith(id)) seriesCache.delete(key);
  }

  console.log(`[Storage] Playlist ${id} removida com sucesso. Restantes: ${remaining.length}`);
  res.json({ success: true, message: 'Playlist removida com sucesso.', playlists: remaining });
});

// 4.1. Recarregar / Sincronizar Playlist
app.post('/api/playlists/:id/reload', async (req, res) => {
  const { id } = req.params;
  const playlist = storage.getPlaylist(id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist não encontrada' });
  }

  try {
    if (playlist.type === 'xtream') {
      console.log(`[Xtream Reload] Sincronizando playlist ${playlist.name} (${id})...`);
      const client = new XtreamCodesClient(playlist.url, playlist.username, playlist.password);
      const auth = await client.authenticate();
      if (!auth.success) {
        return res.status(400).json({ error: 'Falha ao reautenticar com o servidor: ' + auth.error });
      }

      // Limpa caches de VOD e Séries
      for (const key of vodCache.keys()) {
        if (key.startsWith(id)) vodCache.delete(key);
      }
      for (const key of seriesCache.keys()) {
        if (key.startsWith(id)) seriesCache.delete(key);
      }

      const updated = storage.savePlaylist({
        ...playlist,
        serverInfo: auth.serverInfo,
        userInfo: auth.userInfo,
        updatedAt: Date.now()
      });

      console.log(`[Xtream Reload] Playlist ${playlist.name} sincronizada com sucesso!`);
      return res.json({ success: true, playlist: updated, message: 'Perfil Xtream Codes sincronizado com sucesso!' });

    } else {
      // M3U Reload
      if (!playlist.url) {
        return res.status(400).json({ error: 'Esta lista M3U não possui URL ou caminho de arquivo para recarregar.' });
      }

      let rawData = '';
      const cleanUrl = playlist.url.trim();
      const localPath = cleanUrl.startsWith('file:///')
        ? cleanUrl.replace('file:///', '')
        : cleanUrl.startsWith('file://')
          ? cleanUrl.replace('file://', '')
          : cleanUrl;

      if (fs.existsSync(localPath)) {
        console.log(`[M3U Reload] Lendo arquivo local atualizado de: ${localPath}`);
        rawData = fs.readFileSync(localPath, 'utf-8');
      } else {
        console.log(`[M3U Reload] Baixando playlist atualizada de: ${cleanUrl}`);
        const response = await axios.get(cleanUrl, {
          timeout: 45000,
          headers: { 'User-Agent': storage.getSettings().userAgent || 'VLC/3.0.18' }
        });
        rawData = response.data;
      }

      const parsed = await parseM3U(rawData);
      let channels = parsed.channels;
      let categories = parsed.categories;

      if (channels.length === 0 && (rawData.includes('#EXT-X-') || rawData.includes('#EXTINF:'))) {
        channels = [{
          id: `ch_${Date.now()}`,
          name: playlist.name || 'Transmissão Ao Vivo',
          tvgId: '',
          tvgName: playlist.name || 'Transmissão Ao Vivo',
          logo: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400',
          category: 'Geral',
          catchup: null,
          url: cleanUrl,
          headers: {}
        }];
        categories = ['Geral'];
      }

      storage.savePlaylistChannels(id, channels, categories);

      const updated = storage.savePlaylist({
        ...playlist,
        channelsCount: parsed.channels.length,
        categoriesCount: parsed.categories.length,
        updatedAt: Date.now()
      });

      console.log(`[M3U Reload] Playlist ${playlist.name} recarregada: ${parsed.channels.length} canais.`);
      return res.json({
        success: true,
        playlist: updated,
        totalChannels: parsed.channels.length,
        message: 'Lista M3U recarregada com sucesso!'
      });
    }
  } catch (err) {
    console.error('[Reload Error]', err.message);
    res.status(500).json({ error: `Erro ao recarregar lista: ${err.message}` });
  }
});

// Helper robusto para detectar conteúdos e categorias adultas (+18 / XXX)
const isAdultCategory = (name = '', category = '') => {
  const combined = `${name || ''} ${category || ''}`.trim();
  if (!combined) return false;
  return /\b(xxx|adult[ao]s?|adults?|18\+|porno?s?|porn|playboy|sexy|venus|prive|privé|penthouse|hustler|brazzers|red\s*hot|erotic[ao]s?|erótic[ao]s?|sensual|hentai|onlyfans|amador|sex|babes|fetish|hardcore|softcore|for\s*man|camerashow|xvideos|pornhub|redhot|sexx)\b|\+18|18\+|\[\+?18\]|\(18\+\)/i.test(combined);
};

// 5. Categorias de uma Playlist (Instantâneo para M3U e Xtream)
app.get('/api/playlists/:id/categories', async (req, res) => {
  const playlist = storage.getPlaylist(req.params.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist não encontrada' });

  const section = req.query.section || 'live'; // 'live', 'movies', 'series', 'adult'

  if (playlist.type === 'xtream') {
    const client = new XtreamCodesClient(playlist.url, playlist.username, playlist.password);
    try {
      let rawCategories = [];
      if (section === 'movies') {
        const vodCats = await client.getVodCategories();
        rawCategories = vodCats.filter(c => !isAdultCategory(c.category_name));
      } else if (section === 'series') {
        const seriesCats = await client.getSeriesCategories();
        rawCategories = seriesCats.filter(c => !isAdultCategory(c.category_name));
      } else if (section === 'adult') {
        const [liveCats, vodCats] = await Promise.all([
          client.getLiveCategories().catch(() => []),
          client.getVodCategories().catch(() => [])
        ]);
        const adultLive = (liveCats || []).filter(c => isAdultCategory(c.category_name)).map(c => ({ ...c, isVod: false }));
        const adultVod = (vodCats || []).filter(c => isAdultCategory(c.category_name)).map(c => ({ ...c, isVod: true }));
        rawCategories = [...adultLive, ...adultVod];
      } else {
        // live (canais ao vivo - remove conteúdos adultos)
        const liveCats = await client.getLiveCategories();
        rawCategories = (liveCats || []).filter(c => !isAdultCategory(c.category_name));
      }

      let previewMap = new Map();
      if (section === 'movies' || section === 'series') {
        previewMap = await getCategoryPreviewMap(playlist, section);
      }

      const formatted = rawCategories.map(c => {
        const catIdStr = c.category_id?.toString() || '';
        const catNameNorm = (c.category_name || '').toString().trim().toLowerCase();
        const previews = previewMap.get(catIdStr) || previewMap.get(catNameNorm) || [];
        return {
          id: c.category_id,
          name: c.category_name,
          isVod: Boolean(c.isVod),
          count: null,
          previewImages: previews
        };
      });

      return res.json({
        totalCategories: formatted.length,
        categories: formatted
      });
    } catch (err) {
      console.error('[Xtream Categories Error]', err.message);
      return res.status(500).json({ error: 'Falha ao buscar categorias Xtream: ' + err.message });
    }
  }

  // M3U
  const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
  let filtered = indexed.categories;
  if (section === 'adult') {
    filtered = indexed.categories.filter(c => isAdultCategory(c.name));
  } else if (section === 'movies') {
    filtered = indexed.categories.filter(c => /filme|vod|cine/i.test(c.name) && !isAdultCategory(c.name));
  } else if (section === 'series') {
    filtered = indexed.categories.filter(c => /serie|série|novela/i.test(c.name) && !isAdultCategory(c.name));
  } else if (section === 'live') {
    filtered = indexed.categories.filter(c => (!/filme|vod|novela|serie|série/i.test(c.name) || (/24h|canais/i.test(c.name) && !/serie|série/i.test(c.name))) && !isAdultCategory(c.name));
  }

  let previewMapM3U = new Map();
  if (section === 'movies' || section === 'series') {
    previewMapM3U = await getCategoryPreviewMap(playlist, section);
  }

  const formattedM3U = filtered.map(c => {
    const catName = typeof c === 'string' ? c : (c.name || '');
    const catNameNorm = catName.trim().toLowerCase();
    const previews = previewMapM3U.get(catNameNorm) || [];
    return typeof c === 'object'
      ? { id: c.id || catName, ...c, previewImages: previews }
      : { id: catName, name: catName, previewImages: previews };
  });

  res.json({
    totalCategories: formattedM3U.length,
    categories: formattedM3U
  });
});

// 6. Canais de uma Playlist (com paginação e suporte a Xtream e M3U)
app.get('/api/playlists/:id/channels', async (req, res) => {
  const playlist = storage.getPlaylist(req.params.id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist não encontrada' });
  }

  const { category, category_id, search, page = 1, limit = 150, include_adult } = req.query;
  const includeAdult = include_adult === 'true';
  const pageNum = Math.max(1, parseInt(page));
  const pageLimit = Math.min(300, Math.max(20, parseInt(limit)));

  if (playlist.type === 'xtream') {
    const client = new XtreamCodesClient(playlist.url, playlist.username, playlist.password);
    try {
      const categories = await client.getLiveCategories();
      let targetCategoryId = category_id;
      let targetCategoryName = '';
      let isVodStream = false;

      // Se passou category_id, localiza em Live ou VOD
      if (targetCategoryId) {
        const foundById = categories.find(c => c.category_id.toString() === targetCategoryId.toString());
        if (foundById) {
          targetCategoryName = foundById.category_name;
        } else {
          const vodCats = await client.getVodCategories().catch(() => []);
          const foundVod = vodCats.find(c => c.category_id.toString() === targetCategoryId.toString());
          if (foundVod) {
            targetCategoryName = foundVod.category_name;
            isVodStream = true;
          }
        }
      }

      // Se não passou ID mas passou nome (e não é '[object Object]' nem 'Todos')
      if (!targetCategoryId && category && category !== 'Todos' && category !== '[object Object]') {
        const catClean = category.trim().toLowerCase();
        let found = categories.find(c => 
          c.category_name.trim().toLowerCase() === catClean ||
          c.category_id.toString() === category.trim()
        );
        if (found) {
          targetCategoryId = found.category_id;
          targetCategoryName = found.category_name;
        } else {
          const vodCats = await client.getVodCategories().catch(() => []);
          found = vodCats.find(c => 
            c.category_name.trim().toLowerCase() === catClean ||
            c.category_id.toString() === category.trim()
          );
          if (found) {
            targetCategoryId = found.category_id;
            targetCategoryName = found.category_name;
            isVodStream = true;
          }
        }
      }

      // Fallback seguro se não encontrou categoria
      if (!targetCategoryId && categories.length > 0) {
        targetCategoryId = categories[0].category_id;
        targetCategoryName = categories[0].category_name;
      }

      console.log(`[Xtream Channels] Buscando canais para categoria: "${targetCategoryName}" (ID: ${targetCategoryId}, isVod: ${isVodStream})`);
      let rawChannels = isVodStream 
        ? await client.getVodStreams(targetCategoryId)
        : await client.getLiveStreams(targetCategoryId);

      // Injeta o nome da categoria correta nos canais
      let channels = rawChannels.map(ch => ({
        ...ch,
        category: targetCategoryName || ch.category || 'Ao Vivo'
      }));

      if (search) {
        const q = search.toLowerCase();
        channels = channels.filter(c => {
          if (!includeAdult && isAdultCategory(c.name, c.category)) return false;
          return (c.name || '').toLowerCase().includes(q);
        });
      } else if (!includeAdult) {
        channels = channels.filter(c => !isAdultCategory(c.name, c.category));
      }

      const total = channels.length;
      const startIndex = (pageNum - 1) * pageLimit;
      const paginatedChannels = channels.slice(startIndex, startIndex + pageLimit);

      return res.json({
        categories: categories.map(c => c.category_name),
        channels: paginatedChannels,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / pageLimit),
        activeCategory: targetCategoryName || category || 'Ao Vivo'
      });
    } catch (err) {
      console.error('[Xtream Channels Error]', err.message);
      return res.status(500).json({ error: 'Erro ao carregar canais Xtream: ' + err.message });
    }
  } else {
    // M3U Indexado
    const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
    let list = [];

    if (category && category !== 'Todos') {
      list = indexed.categoryMap.get(category) || [];
      if (!includeAdult) {
        list = list.filter(c => !isAdultCategory(c.name, c.category));
      }
    } else if (search) {
      const q = search.toLowerCase();
      list = (indexed.allChannels || []).filter(c => {
        if (!includeAdult && isAdultCategory(c.name, c.category)) return false;
        return (c.name || '').toLowerCase().includes(q);
      });
    } else {
      const firstCat = indexed.categories[0]?.name;
      list = firstCat ? (indexed.categoryMap.get(firstCat) || []) : indexed.allChannels.slice(0, pageLimit);
      if (!includeAdult) {
        list = list.filter(c => !isAdultCategory(c.name, c.category));
      }
    }

    if (search && category && category !== 'Todos') {
      const q = search.toLowerCase();
      list = list.filter(c => {
        if (!includeAdult && isAdultCategory(c.name, c.category)) return false;
        return (c.name || '').toLowerCase().includes(q);
      });
    }

    const total = list.length;
    const startIndex = (pageNum - 1) * pageLimit;
    const paginatedChannels = list.slice(startIndex, startIndex + pageLimit);

    res.json({
      categories: indexed.categories.map(c => c.name),
      channels: paginatedChannels,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageLimit),
      activeCategory: category || (indexed.categories[0]?.name || 'Geral')
    });
  }
});

// 5. VOD e Séries para Xtream Codes (Paginado & Otimizado)
const vodCache = new Map(); // key: `${playlistId}_${categoryId}` -> { data, time }
const seriesCache = new Map();

// Funções de Normalização e Busca Inteligente (ignora acentos, hífens, pontuações e ordem de palavras)
function normalizeSearchText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_.:,;!?()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesSearch(title, query) {
  const normTitle = normalizeSearchText(title);
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return false;
  if (normTitle.includes(normQuery)) return true;
  const words = normQuery.split(' ').filter(w => w.length > 0);
  return words.length > 0 && words.every(word => normTitle.includes(word));
}

// Cache global de todos os títulos no SSD e em memória para busca instantânea em outros grupos
const allVodCache = new Map(); // playlistId -> { data, time, promise }
const allSeriesCache = new Map();
const allLiveCache = new Map();
const baseDataDir = process.env.ORIZON_DATA_DIR || path.join(process.cwd(), 'data');
const CACHE_DIR = path.join(baseDataDir, 'cache');

async function getAllLiveForPlaylist(playlist) {
  const now = Date.now();
  const cached = allLiveCache.get(playlist.id);
  if (cached && cached.data && cached.data.length > 0 && (now - cached.time < 30 * 60 * 1000)) {
    return cached.data;
  }
  if (cached && cached.promise) {
    return cached.promise;
  }

  // 1. Tenta carregar do SSD (instantâneo, < 30ms para milhares de canais)
  const diskFile = path.join(CACHE_DIR, `live_all_${playlist.id}.json`);
  if (!cached && fs.existsSync(diskFile)) {
    try {
      const raw = fs.readFileSync(diskFile, 'utf-8');
      const diskData = JSON.parse(raw);
      if (Array.isArray(diskData) && diskData.length > 0) {
        allLiveCache.set(playlist.id, { data: diskData, time: now, promise: null });
        console.log(`[Xtream Live Cache SSD] ${diskData.length} canais ao vivo carregados do disco.`);
        return diskData;
      }
    } catch (e) {
      console.warn('[Xtream Live Disk Cache Error]', e.message);
    }
  }

  // 2. Não tem no SSD ou cache expirou: busca da API Xtream Codes
  const client = new XtreamCodesClient(playlist.url, playlist.username, playlist.password);
  const promise = (async () => {
    try {
      console.log(`[Xtream Global Live] Carregando canais ao vivo da API Xtream (${playlist.name || playlist.id})...`);
      const [categories, allStreams] = await Promise.all([
        client.getLiveCategories().catch(() => []),
        client.getLiveStreams(null).catch(() => [])
      ]);

      const catMap = new Map();
      categories.forEach(c => {
        if (c.category_id) catMap.set(c.category_id.toString(), c.category_name);
      });

      const enriched = (allStreams || []).map(ch => {
        const catName = (ch.categoryId && catMap.get(ch.categoryId.toString())) || ch.category || 'Ao Vivo';
        return {
          ...ch,
          category: catName
        };
      });

      allLiveCache.set(playlist.id, { data: enriched, time: Date.now(), promise: null });

      // Salva no SSD para consultas instantâneas futuras
      try {
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(diskFile, JSON.stringify(enriched), 'utf-8');
        console.log(`[Xtream Live Cache SSD] ${enriched.length} canais ao vivo salvos no SSD.`);
      } catch (errWrite) {
        console.warn('[Xtream Live Save SSD Error]', errWrite.message);
      }

      return enriched;
    } catch (err) {
      console.error('[Xtream Global Live Error]', err.message);
      allLiveCache.delete(playlist.id);
      return [];
    }
  })();

  allLiveCache.set(playlist.id, { data: [], time: 0, promise });
  return promise;
}

async function getAllVodForPlaylist(playlist) {
  const now = Date.now();
  const cached = allVodCache.get(playlist.id);
  if (cached && cached.data && cached.data.length > 0 && (now - cached.time < 30 * 60 * 1000)) {
    return cached.data;
  }
  if (cached && cached.promise) {
    return cached.promise;
  }

  // 1. Tenta carregar do SSD (instantâneo, < 30ms para 25.000+ títulos)
  const diskFile = path.join(CACHE_DIR, `vod_all_${playlist.id}.json`);
  if (!cached && fs.existsSync(diskFile)) {
    try {
      const raw = fs.readFileSync(diskFile, 'utf-8');
      const diskData = JSON.parse(raw);
      if (Array.isArray(diskData) && diskData.length > 0) {
        allVodCache.set(playlist.id, { data: diskData, time: now, promise: null });
        console.log(`[Xtream VOD Cache SSD] ${diskData.length} filmes carregados do disco.`);
        return diskData;
      }
    } catch (e) {
      console.warn('[Xtream VOD Disk Cache Error]', e.message);
    }
  }

  // 2. Não tem no SSD ou cache expirou: busca da API Xtream Codes
  const client = new XtreamCodesClient(playlist.url, playlist.username, playlist.password);
  const promise = (async () => {
    try {
      console.log(`[Xtream Global VOD] Carregando catálogo completo da API Xtream (${playlist.name || playlist.id})...`);
      const [categories, allStreams] = await Promise.all([
        client.getVodCategories().catch(() => []),
        client.getVodStreams(null).catch(() => [])
      ]);

      const catMap = new Map();
      categories.forEach(c => {
        if (c.category_id) catMap.set(c.category_id.toString(), c.category_name);
      });

      const enriched = (allStreams || []).map(vod => {
        const catName = (vod.categoryId && catMap.get(vod.categoryId.toString())) || vod.category || 'Filmes';
        return {
          ...vod,
          category: catName
        };
      });

      allVodCache.set(playlist.id, { data: enriched, time: Date.now(), promise: null });

      // Salva no SSD para consultas instantâneas futuras
      try {
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(diskFile, JSON.stringify(enriched), 'utf-8');
        console.log(`[Xtream VOD Cache SSD] ${enriched.length} filmes salvos no SSD.`);
      } catch (errWrite) {
        console.warn('[Xtream VOD Save SSD Error]', errWrite.message);
      }

      return enriched;
    } catch (err) {
      console.error('[Xtream Global VOD Error]', err.message);
      allVodCache.delete(playlist.id);
      return [];
    }
  })();

  allVodCache.set(playlist.id, { data: [], time: 0, promise });
  return promise;
}

async function getAllSeriesForPlaylist(playlist) {
  const now = Date.now();
  const cached = allSeriesCache.get(playlist.id);
  if (cached && cached.data && cached.data.length > 0 && (now - cached.time < 30 * 60 * 1000)) {
    return cached.data;
  }
  if (cached && cached.promise) {
    return cached.promise;
  }

  // 1. Tenta carregar do SSD
  const diskFile = path.join(CACHE_DIR, `series_all_${playlist.id}.json`);
  if (!cached && fs.existsSync(diskFile)) {
    try {
      const raw = fs.readFileSync(diskFile, 'utf-8');
      const diskData = JSON.parse(raw);
      if (Array.isArray(diskData) && diskData.length > 0) {
        allSeriesCache.set(playlist.id, { data: diskData, time: now, promise: null });
        console.log(`[Xtream Series Cache SSD] ${diskData.length} séries carregadas do disco.`);
        return diskData;
      }
    } catch (e) {
      console.warn('[Xtream Series Disk Cache Error]', e.message);
    }
  }

  // 2. Busca da API Xtream Codes
  const client = new XtreamCodesClient(playlist.url, playlist.username, playlist.password);
  const promise = (async () => {
    try {
      console.log(`[Xtream Global Series] Carregando catálogo completo da API Xtream (${playlist.name || playlist.id})...`);
      const [categories, allStreams] = await Promise.all([
        client.getSeriesCategories().catch(() => []),
        client.getSeries(null).catch(() => [])
      ]);

      const catMap = new Map();
      categories.forEach(c => {
        if (c.category_id) catMap.set(c.category_id.toString(), c.category_name);
      });

      const enriched = (allStreams || []).map(s => {
        const catName = (s.categoryId && catMap.get(s.categoryId.toString())) || s.category || 'Séries';
        return {
          ...s,
          category: catName
        };
      });

      allSeriesCache.set(playlist.id, { data: enriched, time: Date.now(), promise: null });

      // Salva no SSD
      try {
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(diskFile, JSON.stringify(enriched), 'utf-8');
        console.log(`[Xtream Series Cache SSD] ${enriched.length} séries salvas no SSD.`);
      } catch (errWrite) {
        console.warn('[Xtream Series Save SSD Error]', errWrite.message);
      }

      return enriched;
    } catch (err) {
      console.error('[Xtream Global Series Error]', err.message);
      allSeriesCache.delete(playlist.id);
      return [];
    }
  })();

  allSeriesCache.set(playlist.id, { data: [], time: 0, promise });
  return promise;
}

// Cache em memória dos previews de categorias para resposta instantânea (< 2ms)
const categoryPreviewCache = new Map();

async function getCategoryPreviewMap(playlist, section) {
  if (!playlist || (section !== 'movies' && section !== 'series')) {
    return new Map();
  }

  const cacheKey = `${playlist.id}_${section}`;
  const now = Date.now();
  const cached = categoryPreviewCache.get(cacheKey);
  if (cached && (now - cached.time < 15 * 60 * 1000)) {
    return cached.map;
  }

  const previewMap = new Map();

  try {
    let items = [];
    if (playlist.type === 'xtream') {
      const diskFile = path.join(CACHE_DIR, `${section === 'movies' ? 'vod' : 'series'}_all_${playlist.id}.json`);
      if (fs.existsSync(diskFile)) {
        try {
          const raw = fs.readFileSync(diskFile, 'utf-8');
          items = JSON.parse(raw);
        } catch (e) {
          console.warn('[CategoryPreview Disk Read Error]', e.message);
        }
      }

      // Se ainda não estava no disco, tenta consultar cache em memória ou busca leve
      if (!Array.isArray(items) || items.length === 0) {
        const fetchPromise = section === 'movies' ? getAllVodForPlaylist(playlist) : getAllSeriesForPlaylist(playlist);
        items = await Promise.race([
          fetchPromise,
          new Promise(resolve => setTimeout(() => resolve([]), 350))
        ]);
      }
    } else {
      // M3U
      const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
      items = indexed.allChannels || [];
    }

    if (Array.isArray(items)) {
      for (const it of items) {
        const catId = (it.categoryId || it.category_id || '').toString();
        const catName = (it.category || it.group || '').toString().trim().toLowerCase();
        const img = it.logo || it.stream_icon || it.cover || it.image || it.tvgLogo;

        if (!img || typeof img !== 'string' || (!img.startsWith('http') && !img.startsWith('data:'))) {
          continue;
        }

        // Indexa por ID da categoria
        if (catId) {
          let list = previewMap.get(catId);
          if (!list) {
            list = [];
            previewMap.set(catId, list);
          }
          if (list.length < 3 && !list.includes(img)) {
            list.push(img);
          }
        }

        // Indexa por Nome da categoria
        if (catName) {
          let listName = previewMap.get(catName);
          if (!listName) {
            listName = [];
            previewMap.set(catName, listName);
          }
          if (listName.length < 3 && !listName.includes(img)) {
            listName.push(img);
          }
        }
      }
    }

    if (previewMap.size > 0) {
      categoryPreviewCache.set(cacheKey, { map: previewMap, time: now });
    }
  } catch (err) {
    console.warn('[getCategoryPreviewMap Error]', err.message);
  }

  return previewMap;
}

app.get('/api/xtream/:id/vod', async (req, res) => {
  const playlist = storage.getPlaylist(req.params.id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist não encontrada' });
  }

  const { page = 1, limit = 40, search } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const pageLimit = Math.min(100, Math.max(10, parseInt(limit)));
  const includeAdult = req.query.include_adult === 'true';

  // Suporte a Catálogo VOD para listas M3U
  if (playlist.type === 'm3u') {
    const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
    const movieCats = (indexed.categories || []).filter(c => /filme|vod|cine/i.test(c.name) && !isAdultCategory(c.name));

    let targetCategoryName = (req.query.category || req.query.category_id || '').toString().trim();
    let rawList = [];
    if (targetCategoryName && targetCategoryName.toLowerCase() !== 'geral') {
      const matchedMovieCat = movieCats.find(c => 
        c.name.trim().toLowerCase() === targetCategoryName.toLowerCase() ||
        c.id?.toString() === targetCategoryName
      );
      if (matchedMovieCat) {
        targetCategoryName = matchedMovieCat.name;
        rawList = indexed.categoryMap.get(targetCategoryName) || [];
      } else {
        const catNorm = normalizeSearchText(targetCategoryName);
        const catClean = targetCategoryName.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [k, v] of indexed.categoryMap.entries()) {
          const kNorm = normalizeSearchText(k);
          const kClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (kNorm === catNorm || kClean === catClean || k.toLowerCase().trim() === targetCategoryName.toLowerCase().trim()) {
            rawList = v;
            targetCategoryName = k;
            break;
          }
        }
      }
    }
    
    // Se não encontrou ou pertence a canais ao vivo, usa a primeira categoria válida de filmes
    if (rawList.length === 0 && movieCats.length > 0) {
      const firstCat = movieCats[0].name;
      rawList = indexed.categoryMap.get(firstCat) || [];
      targetCategoryName = firstCat;
    }

    let movies = rawList.map(ch => ({
      id: ch.id,
      stream_id: ch.id,
      streamId: ch.id,
      name: ch.name,
      title: ch.name,
      stream_icon: ch.logo,
      cover: ch.logo,
      logo: ch.logo,
      url: ch.url,
      category: ch.category || targetCategoryName,
      stream_type: 'movie',
      rating: null,
      container_extension: (ch.url || '').includes('.m3u8') ? 'm3u8' : 'mp4'
    }));

    if (search) {
      movies = movies.filter(m => {
        if (!includeAdult && isAdultCategory(m.name, targetCategoryName)) return false;
        return matchesSearch(m.name, search);
      });
    } else if (!includeAdult) {
      if (isAdultCategory(targetCategoryName)) {
        movies = [];
      } else {
        movies = movies.filter(m => !isAdultCategory(m.name, targetCategoryName));
      }
    }

    const total = movies.length;
    const startIndex = (pageNum - 1) * pageLimit;
    const paginated = movies.slice(startIndex, startIndex + pageLimit);

    return res.json({
      categories: movieCats.map(c => ({ category_id: c.name, category_name: c.name })),
      movies: paginated,
      activeCategoryId: targetCategoryName,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageLimit)
    });
  }

  if (playlist.type !== 'xtream') {
    return res.status(400).json({ error: 'Formato de playlist inválido para VOD' });
  }

  try {
    const client = new XtreamCodesClient(playlist.url, playlist.username, playlist.password);
    const categories = await client.getVodCategories();

    let targetCategoryId = null;
    let targetCategoryName = '';
    const categoryIdParam = (req.query.category_id || '').toString().trim();
    const categoryNameParam = (req.query.category || '').toString().trim().toLowerCase();

    // 1. Tenta encontrar por ID exato nas categorias de Séries
    if (categoryIdParam) {
      const foundById = categories.find(c => c.category_id?.toString() === categoryIdParam);
      if (foundById) {
        targetCategoryId = foundById.category_id;
        targetCategoryName = foundById.category_name || '';
      }
    }

    // 2. Se não encontrou por ID, tenta por nome
    if (!targetCategoryId && categoryNameParam && categoryNameParam !== 'geral') {
      const foundByName = categories.find(c => c.category_name?.trim().toLowerCase() === categoryNameParam);
      if (foundByName) {
        targetCategoryId = foundByName.category_id;
        targetCategoryName = foundByName.category_name || '';
      }
    }

    // 3. Fallback seguro: se o ID pertencia a outra seção (ex: TV Ao Vivo) ou era inválido, usa a 1ª categoria válida de Séries
    if (!targetCategoryId && categories.length > 0) {
      targetCategoryId = categories[0].category_id;
      targetCategoryName = categories[0].category_name || '';
    }

    const cacheKey = `${playlist.id}_vod_${targetCategoryId}`;
    let movies = [];
    const now = Date.now();

    if (vodCache.has(cacheKey) && (now - vodCache.get(cacheKey).time < 5 * 60 * 1000)) {
      movies = vodCache.get(cacheKey).data;
    } else {
      movies = await client.getVodStreams(targetCategoryId);
      vodCache.set(cacheKey, { data: movies, time: now });
    }

    const includeAdult = req.query.include_adult === 'true';

    if (search) {
      movies = movies.filter(m => {
        if (!includeAdult && isAdultCategory(m.name, targetCategoryName)) return false;
        return matchesSearch(m.name, search);
      });
    } else if (!includeAdult) {
      if (isAdultCategory(targetCategoryName)) {
        movies = [];
      } else {
        movies = movies.filter(m => !isAdultCategory(m.name, targetCategoryName));
      }
    }

    const total = movies.length;
    const startIndex = (pageNum - 1) * pageLimit;
    const paginated = movies.slice(startIndex, startIndex + pageLimit);

    res.json({
      categories,
      movies: paginated,
      activeCategoryId: targetCategoryId,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageLimit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/xtream/:id/series', async (req, res) => {
  const playlist = storage.getPlaylist(req.params.id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist não encontrada' });
  }

  const { page = 1, limit = 40, search, include_adult } = req.query;
  const includeAdult = include_adult === 'true';
  const pageNum = Math.max(1, parseInt(page));
  const pageLimit = Math.min(100, Math.max(10, parseInt(limit)));

  // Suporte a Séries para listas M3U
  if (playlist.type === 'm3u') {
    const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
    const seriesCats = (indexed.categories || []).filter(c => /serie|série|novela/i.test(c.name) && !isAdultCategory(c.name));

    let targetCategoryName = (req.query.category || req.query.category_id || '').toString().trim();
    let rawList = [];
    if (targetCategoryName && targetCategoryName.toLowerCase() !== 'geral') {
      const matchedSeriesCat = seriesCats.find(c => 
        c.name.trim().toLowerCase() === targetCategoryName.toLowerCase() ||
        c.id?.toString() === targetCategoryName
      );
      if (matchedSeriesCat) {
        targetCategoryName = matchedSeriesCat.name;
        rawList = indexed.categoryMap.get(targetCategoryName) || [];
      } else {
        const catNorm = normalizeSearchText(targetCategoryName);
        const catClean = targetCategoryName.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [k, v] of indexed.categoryMap.entries()) {
          const kNorm = normalizeSearchText(k);
          const kClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (kNorm === catNorm || kClean === catClean || k.toLowerCase().trim() === targetCategoryName.toLowerCase().trim()) {
            rawList = v;
            targetCategoryName = k;
            break;
          }
        }
      }
    }
    
    // Se ainda não encontrou e existem categorias de séries, usa a primeira categoria válida
    if (rawList.length === 0 && seriesCats.length > 0) {
      const firstCat = seriesCats[0].name;
      rawList = indexed.categoryMap.get(firstCat) || [];
      targetCategoryName = firstCat;
    }

    // Agrupamento inteligente de episódios por série em listas M3U
    const seriesMap = new Map();
    const episodeRegex = /^(.*?)\s*[-_•]?\s*(?:[SsTt](\d{1,2})\s*[-_•]?\s*[Ee](\d{1,2})|temp(?:orada)?\.?\s*(\d+)\s*[-_•]?\s*ep(?:is[oó]dio)?\.?\s*(\d+))(.*)$/i;

    for (const ch of rawList) {
      const m = ch.name.match(episodeRegex);
      if (m) {
        const showTitle = m[1].trim();
        const seasonNum = parseInt(m[2] || m[4] || '1', 10);
        const epNum = parseInt(m[3] || m[5] || '1', 10);
        const key = showTitle.toLowerCase();
        
        if (!seriesMap.has(key)) {
          const sId = `m3u_series_${Buffer.from(key).toString('hex').substring(0, 16)}`;
          seriesMap.set(key, {
            id: sId,
            series_id: sId,
            seriesId: sId,
            name: showTitle,
            title: showTitle,
            stream_icon: ch.logo,
            cover: ch.logo,
            logo: ch.logo,
            url: ch.url,
            category: ch.category || targetCategoryName,
            stream_type: 'series',
            rating: null,
            episodeCount: 0,
            seasons: new Set()
          });
        }
        const sObj = seriesMap.get(key);
        sObj.episodeCount += 1;
        sObj.seasons.add(seasonNum);
        if (!sObj.cover && ch.logo) sObj.cover = ch.logo;
        if (!sObj.logo && ch.logo) sObj.logo = ch.logo;
      } else {
        // Item individual sem padrão de episódio
        seriesMap.set(ch.id, {
          id: ch.id,
          series_id: ch.id,
          seriesId: ch.id,
          name: ch.name,
          title: ch.name,
          stream_icon: ch.logo,
          cover: ch.logo,
          logo: ch.logo,
          url: ch.url,
          category: ch.category || targetCategoryName,
          stream_type: 'series',
          rating: null,
          episodeCount: 1,
          seasons: new Set([1])
        });
      }
    }

    let series = Array.from(seriesMap.values()).map(s => ({
      ...s,
      totalSeasons: s.seasons ? s.seasons.size : 1,
      totalEpisodes: s.episodeCount || 1
    }));

    if (search) {
      series = series.filter(s => {
        if (!includeAdult && isAdultCategory(s.name, targetCategoryName)) return false;
        return matchesSearch(s.name, search);
      });
    } else if (!includeAdult) {
      if (isAdultCategory(targetCategoryName)) {
        series = [];
      } else {
        series = series.filter(s => !isAdultCategory(s.name, targetCategoryName));
      }
    }

    const total = series.length;
    const startIndex = (pageNum - 1) * pageLimit;
    const paginated = series.slice(startIndex, startIndex + pageLimit);

    return res.json({
      categories: seriesCats.map(c => ({ category_id: c.name, category_name: c.name })),
      series: paginated,
      activeCategoryId: targetCategoryName,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageLimit)
    });
  }

  if (playlist.type !== 'xtream') {
    return res.status(400).json({ error: 'Formato de playlist inválido para Séries' });
  }

  try {
    const client = new XtreamCodesClient(playlist.url, playlist.username, playlist.password);
    const categories = await client.getSeriesCategories();

    let targetCategoryId = null;
    let targetCategoryName = '';
    const categoryIdParam = (req.query.category_id || '').toString().trim();
    const categoryNameParam = (req.query.category || '').toString().trim().toLowerCase();

    // 1. Tenta encontrar por ID exato nas categorias de Séries
    if (categoryIdParam) {
      const foundById = categories.find(c => c.category_id?.toString() === categoryIdParam);
      if (foundById) {
        targetCategoryId = foundById.category_id;
        targetCategoryName = foundById.category_name || '';
      }
    }

    // 2. Se não encontrou por ID, tenta por nome
    if (!targetCategoryId && categoryNameParam && categoryNameParam !== 'geral') {
      const foundByName = categories.find(c => c.category_name?.trim().toLowerCase() === categoryNameParam);
      if (foundByName) {
        targetCategoryId = foundByName.category_id;
        targetCategoryName = foundByName.category_name || '';
      }
    }

    // 3. Fallback seguro: se o ID pertencia a outra seção (ex: TV Ao Vivo) ou era inválido, usa a 1ª categoria válida de Séries
    if (!targetCategoryId && categories.length > 0) {
      targetCategoryId = categories[0].category_id;
      targetCategoryName = categories[0].category_name || '';
    }

    const cacheKey = `${playlist.id}_series_${targetCategoryId}`;
    let series = [];
    const now = Date.now();

    if (seriesCache.has(cacheKey) && (now - seriesCache.get(cacheKey).time < 5 * 60 * 1000)) {
      series = seriesCache.get(cacheKey).data;
    } else {
      series = await client.getSeries(targetCategoryId);
      seriesCache.set(cacheKey, { data: series, time: now });
    }

    if (search) {
      series = series.filter(s => {
        if (!includeAdult && isAdultCategory(s.name, targetCategoryName)) return false;
        return matchesSearch(s.name, search);
      });
    } else if (!includeAdult) {
      if (isAdultCategory(targetCategoryName)) {
        series = [];
      } else {
        series = series.filter(s => !isAdultCategory(s.name, targetCategoryName));
      }
    }

    const total = series.length;
    const startIndex = (pageNum - 1) * pageLimit;
    const paginated = series.slice(startIndex, startIndex + pageLimit);

    res.json({
      categories,
      series: paginated,
      activeCategoryId: targetCategoryId,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageLimit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pesquisa expandida de filmes em outros grupos (excluindo a categoria atualmente selecionada)
app.get('/api/xtream/:id/vod/search-others', async (req, res) => {
  const playlist = storage.getPlaylist(req.params.id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist não encontrada' });
  }

  const { search, exclude_category_id, exclude_category, limit = 80, include_adult } = req.query;
  const includeAdult = include_adult === 'true';
  if (!search || !search.trim()) {
    return res.json({ items: [], total: 0 });
  }

  // Suporte a pesquisa em outros grupos para M3U
  if (playlist.type === 'm3u') {
    const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
    const q = search.trim();
    const excludeIdStr = (exclude_category_id || '').toString().trim().toLowerCase();
    const excludeNameStr = normalizeSearchText(exclude_category || '');

    const allMovies = (indexed.allChannels || []).filter(c => /filme|vod|cine/i.test(c.category || ''));
    const results = allMovies.filter(item => {
      if (!includeAdult && isAdultCategory(item.name, item.category)) return false;
      if (!matchesSearch(item.name, q)) return false;
      const catNorm = normalizeSearchText(item.category || '');
      if (excludeNameStr && catNorm === excludeNameStr) return false;
      if (excludeIdStr && (item.category || '').toLowerCase() === excludeIdStr) return false;
      return true;
    }).map(ch => ({
      id: ch.id,
      stream_id: ch.id,
      streamId: ch.id,
      name: ch.name,
      title: ch.name,
      stream_icon: ch.logo,
      cover: ch.logo,
      logo: ch.logo,
      url: ch.url,
      category: ch.category,
      stream_type: 'movie',
      rating: null
    }));

    const maxLimit = Math.min(200, Math.max(10, parseInt(limit) || 80));
    return res.json({
      items: results.slice(0, maxLimit),
      total: results.length
    });
  }

  if (playlist.type !== 'xtream') {
    return res.status(400).json({ error: 'Playlist Xtream Codes necessária' });
  }

  try {
    const q = search.trim();
    const excludeIdStr = (exclude_category_id || '').toString().trim();
    const excludeNameStr = normalizeSearchText(exclude_category || '');

    const allMovies = await getAllVodForPlaylist(playlist);
    const results = allMovies.filter(item => {
      // Bloqueio Parental Rigoroso: nunca retorna itens adultos se não autorizado
      if (!includeAdult && isAdultCategory(item.name, item.category)) {
        return false;
      }

      const match = matchesSearch(item.name, q);
      if (!match) return false;

      // Exclui a categoria atual por ID
      if (excludeIdStr && item.categoryId && item.categoryId.toString() === excludeIdStr) {
        return false;
      }
      // Exclui a categoria atual por Nome normalizado
      if (excludeNameStr) {
        const itemCatNorm = normalizeSearchText(item.category || '');
        if (itemCatNorm === excludeNameStr) {
          return false;
        }
      }
      return true;
    });

    const maxLimit = Math.min(200, Math.max(10, parseInt(limit) || 80));
    res.json({
      items: results.slice(0, maxLimit),
      total: results.length
    });
  } catch (err) {
    console.error('[Search Others VOD Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Pesquisa expandida de séries em outros grupos (excluindo a categoria atualmente selecionada)
app.get('/api/xtream/:id/series/search-others', async (req, res) => {
  const playlist = storage.getPlaylist(req.params.id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist não encontrada' });
  }

  const { search, exclude_category_id, exclude_category, limit = 80, include_adult } = req.query;
  const includeAdult = include_adult === 'true';
  if (!search || !search.trim()) {
    return res.json({ items: [], total: 0 });
  }

  // Suporte a pesquisa em outros grupos de séries para M3U
  if (playlist.type === 'm3u') {
    const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
    const q = search.trim();
    const excludeIdStr = (exclude_category_id || '').toString().trim().toLowerCase();
    const excludeNameStr = normalizeSearchText(exclude_category || '');

    const allSeries = (indexed.allChannels || []).filter(c => /serie|série|novela/i.test(c.category || ''));
    const results = allSeries.filter(item => {
      if (!includeAdult && isAdultCategory(item.name, item.category)) return false;
      if (!matchesSearch(item.name, q)) return false;
      const catNorm = normalizeSearchText(item.category || '');
      if (excludeNameStr && catNorm === excludeNameStr) return false;
      if (excludeIdStr && (item.category || '').toLowerCase() === excludeIdStr) return false;
      return true;
    }).map(ch => ({
      id: ch.id,
      series_id: ch.id,
      seriesId: ch.id,
      name: ch.name,
      title: ch.name,
      stream_icon: ch.logo,
      cover: ch.logo,
      logo: ch.logo,
      url: ch.url,
      category: ch.category,
      stream_type: 'series',
      rating: null
    }));

    const maxLimit = Math.min(200, Math.max(10, parseInt(limit) || 80));
    return res.json({
      items: results.slice(0, maxLimit),
      total: results.length
    });
  }

  if (playlist.type !== 'xtream') {
    return res.status(400).json({ error: 'Playlist Xtream Codes necessária' });
  }

  try {
    const q = search.trim();
    const excludeIdStr = (exclude_category_id || '').toString().trim();
    const excludeNameStr = normalizeSearchText(exclude_category || '');

    const allSeries = await getAllSeriesForPlaylist(playlist);
    const results = allSeries.filter(item => {
      // Bloqueio Parental Rigoroso: nunca retorna séries adultas se não autorizado
      if (!includeAdult && isAdultCategory(item.name, item.category)) {
        return false;
      }

      const match = matchesSearch(item.name, q);
      if (!match) return false;

      if (excludeIdStr && item.categoryId && item.categoryId.toString() === excludeIdStr) {
        return false;
      }
      if (excludeNameStr) {
        const itemCatNorm = normalizeSearchText(item.category || '');
        if (itemCatNorm === excludeNameStr) {
          return false;
        }
      }
      return true;
    });

    const maxLimit = Math.min(200, Math.max(10, parseInt(limit) || 80));
    res.json({
      items: results.slice(0, maxLimit),
      total: results.length
    });
  } catch (err) {
    console.error('[Search Others Series Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Pesquisa expandida para playlists M3U em outros grupos
app.get('/api/playlists/:id/channels/search-others', (req, res) => {
  const playlist = storage.getPlaylist(req.params.id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist não encontrada' });
  }

  const { search, exclude_category, limit = 60, include_adult } = req.query;
  const includeAdult = include_adult === 'true';
  if (!search || !search.trim()) {
    return res.json({ items: [], total: 0 });
  }

  try {
    const q = search.trim().toLowerCase();
    const excludeNameStr = (exclude_category || '').trim().toLowerCase();

    const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
    const results = (indexed.allChannels || []).filter(item => {
      // Bloqueio Parental Rigoroso: nunca retorna canais adultos se não autorizado
      if (!includeAdult && isAdultCategory(item.name, item.category)) {
        return false;
      }

      const match = (item.name || '').toLowerCase().includes(q);
      if (!match) return false;
      if (excludeNameStr && (item.category || '').trim().toLowerCase() === excludeNameStr) {
        return false;
      }
      return true;
    });

    const maxLimit = Math.min(150, Math.max(10, parseInt(limit) || 60));
    res.json({
      items: results.slice(0, maxLimit),
      total: results.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const seriesInfoCache = new Map();

function cleanEpisodeTitle(rawTitle, episodeNum, seriesName = '') {
  const defaultTitle = `Episódio ${episodeNum || 1}`;
  if (!rawTitle) return defaultTitle;

  let title = String(rawTitle).trim();
  title = title.replace(/\[\s*(L|D|LEG|DUB|4K|FHD|HD|SD|DUBLADO|LEGENDADO)\s*\]/gi, '').trim();

  if (seriesName) {
    const cleanSeries = seriesName.replace(/\[\s*(L|D|LEG|DUB|4K|FHD|HD|SD|DUBLADO|LEGENDADO)\s*\]/gi, '').trim();
    const escaped = cleanSeries.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`^${escaped}\\s*[-:•–—]?\\s*`, 'i'), '').trim();
  }

  const codeRegex = /^(?:s\d+\s*e\d+|t\d+\s*e\d+|temporada\s*\d+\s*epis[oó]dio\s*\d+|temp\.?\s*\d+\s*ep\.?\s*\d+|ep\.?\s*\d+|e\d+)\s*[-:•–—]?\s*(.*)$/i;
  const match = title.match(codeRegex);

  if (match) {
    const leftover = (match[1] || '').trim();
    if (leftover && !/^(?:epis[oó]dio|ep|cap[ií]tulo)\s*\d+$/i.test(leftover) && leftover.length >= 2) {
      return leftover;
    }
    return defaultTitle;
  }

  if (!title || /^(?:s\d+\s*e\d+|t\d+\s*e\d+|temporada\s*\d+|ep\s*\d+|epis[oó]dio\s*\d+)$/i.test(title)) {
    return defaultTitle;
  }

  if (seriesName && title.toLowerCase() === seriesName.toLowerCase()) {
    return defaultTitle;
  }

  return title;
}

app.get('/api/xtream/:id/series-info/:seriesId', async (req, res) => {
  const { id, seriesId } = req.params;
  const playlist = storage.getPlaylist(id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist não encontrada' });
  }

  // Suporte nativo a Séries para listas M3U
  if (playlist.type === 'm3u') {
    const indexed = storage.getPlaylistChannelsIndexed(id);
    const episodeRegex = /^(.*?)\s*[-_•]?\s*(?:[SsTt](\d{1,2})\s*[-_•]?\s*[Ee](\d{1,2})|temp(?:orada)?\.?\s*(\d+)\s*[-_•]?\s*ep(?:is[oó]dio)?\.?\s*(\d+))(.*)$/i;

    let matchedChannels = [];
    let showTitle = '';
    let seriesLogo = '';
    let seriesCategory = 'Séries';

    // Procura por ID direto ou pela chave de série agrupada
    for (const ch of (indexed.allChannels || [])) {
      const m = ch.name.match(episodeRegex);
      if (m) {
        const title = m[1].trim();
        const sKey = `m3u_series_${Buffer.from(title.toLowerCase()).toString('hex').substring(0, 16)}`;
        if (sKey === seriesId || ch.id === seriesId || (showTitle && title.toLowerCase() === showTitle.toLowerCase())) {
          matchedChannels.push(ch);
          if (!showTitle) showTitle = title;
          if (!seriesLogo && ch.logo) seriesLogo = ch.logo;
          if (ch.category) seriesCategory = ch.category;
        }
      } else if (ch.id === seriesId) {
        matchedChannels.push(ch);
        if (!showTitle) showTitle = ch.name;
        if (!seriesLogo && ch.logo) seriesLogo = ch.logo;
        if (ch.category) seriesCategory = ch.category;
      }
    }

    if (matchedChannels.length === 0) {
      return res.status(404).json({ error: 'Série não encontrada nesta lista M3U' });
    }

    const seasonsMap = new Map();
    const episodesBySeason = {};

    matchedChannels.forEach((ch, idx) => {
      const m = ch.name.match(episodeRegex);
      let sNum = 1;
      let epNum = idx + 1;
      let epTitle = ch.name;

      if (m) {
        sNum = parseInt(m[2] || m[4] || '1', 10);
        epNum = parseInt(m[3] || m[5] || (idx + 1).toString(), 10);
        const extra = (m[6] || '').replace(/^[\s\-:]+/, '').trim();
        epTitle = extra || `Episódio ${epNum}`;
      }

      const sKey = sNum.toString();
      if (!seasonsMap.has(sNum)) {
        seasonsMap.set(sNum, {
          seasonNumber: sNum,
          name: `Temporada ${sNum}`,
          episodeCount: 0
        });
        episodesBySeason[sKey] = [];
      }

      seasonsMap.get(sNum).episodeCount += 1;

      episodesBySeason[sKey].push({
        id: ch.id || `m3u_ep_${sNum}_${epNum}`,
        streamId: ch.id,
        seriesId: seriesId,
        seriesName: showTitle,
        seasonNumber: sNum,
        episodeNum: epNum,
        title: epTitle,
        rawTitle: ch.name,
        fullTitle: `${showTitle} • Temp. ${sNum} • Ep. ${epNum}${epTitle ? ` • ${epTitle}` : ''}`,
        duration: '',
        durationSecs: 0,
        plot: `Episódio ${epNum} da Temporada ${sNum} de ${showTitle}.`,
        rating: '',
        image: ch.logo || seriesLogo || '',
        url: ch.url,
        type: 'series'
      });
    });

    const seasons = Array.from(seasonsMap.values()).sort((a, b) => a.seasonNumber - b.seasonNumber);

    return res.json({
      seriesId,
      name: showTitle,
      cover: seriesLogo,
      backdrop: seriesLogo,
      plot: `Assista a todas as temporadas de ${showTitle}.`,
      genre: seriesCategory,
      releaseDate: '',
      rating: '',
      seasons,
      episodesBySeason
    });
  }

  if (playlist.type !== 'xtream') {
    return res.status(400).json({ error: 'Playlist inválida para séries Xtream' });
  }

  const cacheKey = `${id}_series_info_${seriesId}`;
  const now = Date.now();
  if (seriesInfoCache.has(cacheKey) && (now - seriesInfoCache.get(cacheKey).time < 10 * 60 * 1000)) {
    return res.json(seriesInfoCache.get(cacheKey).data);
  }

  try {
    const client = new XtreamCodesClient(playlist.url, playlist.username, playlist.password);
    const rawData = await client.getSeriesInfo(seriesId);

    const seriesMeta = rawData.info || {};
    const rawEpisodes = rawData.episodes || {};

    // Extrai e ordena as temporadas disponíveis
    const seasonNumbers = Object.keys(rawEpisodes).map(s => parseInt(s, 10)).sort((a, b) => a - b);

    const formattedSeasons = seasonNumbers.map(sNum => {
      const eps = rawEpisodes[sNum.toString()] || [];
      return {
        seasonNumber: sNum,
        name: `Temporada ${sNum}`,
        episodeCount: eps.length
      };
    });

    // Formata os episódios agrupados por temporada com URLs de streaming prontas
    const episodesBySeason = {};
    for (const sNum of seasonNumbers) {
      const eps = rawEpisodes[sNum.toString()] || [];
      episodesBySeason[sNum.toString()] = eps.map(ep => {
        const epInfo = ep.info || {};
        const ext = ep.container_extension || 'mp4';
        const streamUrl = `${playlist.url}/series/${playlist.username}/${playlist.password}/${ep.id}.${ext}`;

        const epNum = parseInt(ep.episode_num || '1', 10);
        const epCleanTitle = cleanEpisodeTitle(ep.title, epNum, seriesMeta.name);

        return {
          id: `xt_ep_${ep.id}`,
          streamId: ep.id,
          seriesId: seriesId,
          seriesName: seriesMeta.name || 'Série',
          seasonNumber: sNum,
          episodeNum: epNum,
          title: epCleanTitle,
          rawTitle: ep.title || '',
          fullTitle: `${seriesMeta.name || 'Série'} • Temp. ${sNum} • Ep. ${epNum}`,
          duration: epInfo.duration || '',
          durationSecs: epInfo.duration_secs || 0,
          plot: epInfo.plot || '',
          rating: epInfo.rating || '',
          image: epInfo.movie_image || epInfo.cover_big || seriesMeta.cover || '',
          extension: ext,
          url: streamUrl,
          type: 'series'
        };
      });
    }

    const result = {
      seriesId,
      name: seriesMeta.name || '',
      cover: seriesMeta.cover || '',
      backdrop: seriesMeta.backdrop_path?.[0] || seriesMeta.cover || '',
      plot: seriesMeta.plot || '',
      cast: seriesMeta.cast || '',
      director: seriesMeta.director || '',
      genre: seriesMeta.genre || '',
      releaseDate: seriesMeta.releaseDate || '',
      rating: seriesMeta.rating || '',
      seasons: formattedSeasons,
      episodesBySeason
    };

    seriesInfoCache.set(cacheKey, { data: result, time: now });
    res.json(result);
  } catch (err) {
    console.error('[Series Info Error]', err.message);
    res.status(500).json({ error: `Erro ao buscar detalhes da série: ${err.message}` });
  }
});

// 6. EPG
app.get('/api/epg/programmes', (req, res) => {
  const channelId = req.query.channel_id;
  const info = epgService.getCurrentAndNext(channelId);
  res.json(info);
});

// 7. Favoritos e Histórico
app.get('/api/favorites', (req, res) => {
  res.json(storage.getFavorites());
});

app.post('/api/favorites/toggle', (req, res) => {
  const updated = storage.toggleFavorite(req.body);
  res.json(updated);
});

app.get('/api/history', (req, res) => {
  res.json(storage.getHistory());
});

app.post('/api/history', (req, res) => {
  const updated = storage.addToHistory(req.body);
  res.json(updated);
});

app.delete('/api/history/:id', (req, res) => {
  const target = decodeURIComponent(req.params.id);
  const updated = storage.removeFromHistory(target);
  res.json(updated);
});

app.delete('/api/history', (req, res) => {
  const targetId = req.query.id || req.body?.id || req.body?.url;
  if (targetId) {
    const updated = storage.removeFromHistory(targetId);
    return res.json(updated);
  }
  const updated = storage.clearHistory();
  res.json(updated);
});

// 7.1. Gerenciamento de Categorias Principais e Coleções Customizadas
app.get('/api/custom-categories', (req, res) => {
  res.json({
    customCategories: storage.getCustomCategories(),
    config: storage.getMainCategoriesConfig()
  });
});

app.post('/api/custom-categories', (req, res) => {
  const updated = storage.saveCustomCategory(req.body);
  res.json({
    customCategories: updated,
    config: storage.getMainCategoriesConfig()
  });
});

app.delete('/api/custom-categories/:id', (req, res) => {
  const updated = storage.deleteCustomCategory(req.params.id);
  res.json({
    customCategories: updated,
    config: storage.getMainCategoriesConfig()
  });
});

app.post('/api/categories-order', (req, res) => {
  const updated = storage.updateMainCategoriesConfig(req.body);
  res.json(updated);
});

// 7.2. Busca Unificada (Canais Ao Vivo, Filmes e Séries) para Categorias Customizadas
app.get('/api/playlists/:id/search-all', async (req, res) => {
  const { id } = req.params;
  const q = (req.query.q || '').trim();
  const includeAdult = req.query.include_adult === 'true';
  const playlist = storage.getPlaylists().find(p => p.id === id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist não encontrada' });
  }

  if (!q) {
    return res.json({ channels: [], movies: [], series: [] });
  }

  try {
    let channels = [];
    let movies = [];
    let series = [];

    // 1. Canais Ao Vivo
    if (playlist.type === 'xtream') {
      const allLive = await getAllLiveForPlaylist(playlist);
      channels = (allLive || [])
        .filter(c => {
          if (!includeAdult && isAdultCategory(c.name, c.category)) return false;
          return matchesSearch(c.name, q);
        })
        .slice(0, 50)
        .map(c => ({
          id: c.id || `xt_live_${c.streamId}`,
          streamId: c.streamId,
          name: c.name,
          logo: c.logo || c.stream_icon || '',
          category: c.category || 'Ao Vivo',
          type: 'live',
          url: c.url
        }));
    } else {
      const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
      channels = (indexed.allChannels || [])
        .filter(c => {
          if (!includeAdult && isAdultCategory(c.name, c.category)) return false;
          return matchesSearch(c.name, q) && (!c.type || c.type === 'live');
        })
        .slice(0, 50)
        .map(c => ({
          id: c.id,
          streamId: c.streamId || c.id,
          name: c.name,
          logo: c.logo || c.tvgLogo || '',
          category: c.category || c.group || 'Ao Vivo',
          type: 'live',
          url: c.url
        }));
    }

    // 2. Filmes (VOD)
    if (playlist.type === 'xtream') {
      const allVod = await getAllVodForPlaylist(playlist);
      movies = (allVod || [])
        .filter(m => {
          if (!includeAdult && isAdultCategory(m.name || m.title, m.category)) return false;
          return matchesSearch(m.name || m.title, q);
        })
        .slice(0, 50)
        .map(m => ({
          id: m.id || `xt_vod_${m.streamId || m.stream_id}`,
          streamId: m.streamId || m.stream_id,
          name: m.name || m.title,
          image: m.image || m.logo || m.stream_icon || m.cover || '',
          category: m.category || 'Filmes',
          type: 'movie',
          url: m.url
        }));
    } else {
      const indexed = storage.getPlaylistChannelsIndexed(playlist.id);
      movies = (indexed.allChannels || [])
        .filter(c => {
          if (!includeAdult && isAdultCategory(c.name, c.category)) return false;
          return matchesSearch(c.name, q) && c.type === 'movie';
        })
        .slice(0, 50)
        .map(c => ({
          id: c.id,
          streamId: c.streamId || c.id,
          name: c.name,
          image: c.logo || c.tvgLogo || '',
          category: c.category || c.group || 'Filmes',
          type: 'movie',
          url: c.url
        }));
    }

    // 3. Séries (Panorama Geral / Série Inteira)
    if (playlist.type === 'xtream') {
      const allSeries = await getAllSeriesForPlaylist(playlist);
      series = (allSeries || [])
        .filter(s => {
          if (!includeAdult && isAdultCategory(s.name || s.title, s.category)) return false;
          return matchesSearch(s.name || s.title, q);
        })
        .slice(0, 50)
        .map(s => ({
          id: s.id || `xt_series_${s.seriesId || s.series_id}`,
          seriesId: s.seriesId || s.series_id || s.id,
          name: s.name || s.title,
          image: s.image || s.cover || s.stream_icon || '',
          cover: s.cover || s.image || '',
          backdrop: s.backdrop || s.image || '',
          plot: s.plot || '',
          rating: s.rating || '',
          category: s.category || 'Séries',
          type: 'series'
        }));
    }

    res.json({ channels, movies, series });
  } catch (err) {
    console.error('[Search All Error]', err);
    res.status(500).json({ error: 'Erro ao buscar mídias: ' + err.message });
  }
});

// 8. Stream Proxy (CORS bypass, stream pipe e reescrita HLS)
app.get('/api/stream', handleStreamProxy);

// 9. Cache Local de Imagens em SSD
app.get('/api/image-cache', handleImageCache);

// 10. Limpeza de Cache de Imagens e Exportação de Dados
app.post('/api/cache/clear', (req, res) => {
  allLiveCache.clear();
  allVodCache.clear();
  allSeriesCache.clear();
  const result = clearImageCache();
  res.json(result);
});

app.get('/api/export-data', (req, res) => {
  try {
    const allData = {
      playlists: storage.getPlaylists(),
      favorites: storage.getFavorites(),
      history: storage.getHistory(),
      customCategories: storage.getCustomCategories(),
      categoriesConfig: storage.getMainCategoriesConfig(),
      settings: storage.getSettings(),
      exportedAt: new Date().toISOString()
    };
    res.setHeader('Content-Disposition', 'attachment; filename=orizon_tv_backup.json');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(allData, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao exportar dados: ' + err.message });
  }
});

// 11. Servir Frontend Estático (quando compilado para Desktop/Produção)
const distCandidates = [
  path.join(process.cwd(), 'dist'),
  path.join(__dirname, '..', 'dist'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, '..', '..', 'app.asar.unpacked', 'dist'),
  path.join(process.resourcesPath || '', 'app.asar.unpacked', 'dist')
];
const distPath = distCandidates.find(p => fs.existsSync(p));
if (distPath) {
  console.log(`[Static Frontend] Servindo build de produção em: ${distPath}`);
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`=========================================`);
  console.log(`🚀 Orizon TV Engine rodando em http://127.0.0.1:${PORT}`);
  console.log(`📡 Proxy de Stream Ativo em /api/stream`);
  console.log(`=========================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] A porta ${PORT} já está em uso.`);
  } else {
    console.error('[Server] Erro ao iniciar servidor:', err);
  }
});
