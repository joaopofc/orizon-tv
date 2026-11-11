import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.ORIZON_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Garante que a pasta data/ existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultData = {
  playlists: [],
  favorites: [],
  history: [],
  customCategories: [],
  mainCategoriesConfig: {
    order: ['live', 'sports', 'movies', 'series', 'favorites', 'history', 'adult'],
    hidden: []
  },
  settings: {
    userAgent: 'VLC/3.0.18 LibVLC/3.0.18',
    bufferLength: 30,
    enableProxy: true,
    enableVolumeBoost: false,
    theme: 'dark',
    activePlaylistId: null
  }
};

class Storage {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return { ...defaultData, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('[Storage] Erro ao carregar db.json:', err.message);
    }
    this.save(defaultData);
    return defaultData;
  }

  save(data = this.data) {
    try {
      this.data = data;
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage] Erro ao salvar db.json:', err.message);
    }
  }

  getPlaylists() {
    this.data = this.load();
    return this.data.playlists || [];
  }

  getPlaylist(id) {
    this.data = this.load();
    return (this.data.playlists || []).find(p => p.id === id);
  }

  savePlaylist(playlist) {
    const existingIndex = this.data.playlists.findIndex(p => p.id === playlist.id);
    if (existingIndex >= 0) {
      this.data.playlists[existingIndex] = { ...this.data.playlists[existingIndex], ...playlist, updatedAt: Date.now() };
    } else {
      this.data.playlists.push({
        ...playlist,
        id: playlist.id || `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    this.save();
    return playlist;
  }

  deletePlaylist(id) {
    this.data = this.load();
    this.data.playlists = (this.data.playlists || []).filter(p => p.id !== id);
    if (this._indexedCache && this._indexedCache[id]) {
      delete this._indexedCache[id];
    }
    // Também limpa arquivo de cache de canais se existir
    const cacheFile = path.join(DATA_DIR, `channels_${id}.json`);
    if (fs.existsSync(cacheFile)) {
      try { fs.unlinkSync(cacheFile); } catch (e) {}
    }
    this.save();
    return this.data.playlists;
  }

  // Cache indexado em memória para não ler arquivos de 100MB+ repetidamente
  getPlaylistChannelsIndexed(playlistId) {
    if (!this._indexedCache) this._indexedCache = {};
    if (this._indexedCache[playlistId]) {
      return this._indexedCache[playlistId];
    }

    const file = path.join(DATA_DIR, `channels_${playlistId}.json`);
    if (fs.existsSync(file)) {
      try {
        console.log(`[Storage] Indexando canais em memória para ${playlistId}...`);
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        
        // Agrupa canais por categoria em Map para busca O(1)
        const categoryMap = new Map();
        const channels = parsed.channels || [];
        
        for (let i = 0; i < channels.length; i++) {
          const ch = channels[i];
          const cat = ch.category || 'Geral';
          if (!categoryMap.has(cat)) {
            categoryMap.set(cat, []);
          }
          categoryMap.get(cat).push(ch);
        }

        const categoriesWithCount = (parsed.categories || []).map(catName => ({
          name: catName,
          count: (categoryMap.get(catName) || []).length
        }));

        this._indexedCache[playlistId] = {
          categories: categoriesWithCount,
          categoryMap,
          total: channels.length,
          allChannels: channels
        };

        console.log(`[Storage] Indexação concluída: ${channels.length} canais em ${categoriesWithCount.length} categorias.`);
        return this._indexedCache[playlistId];
      } catch (err) {
        console.error('[Storage] Erro ao indexar canais:', err.message);
      }
    }

    return { categories: [], categoryMap: new Map(), total: 0, allChannels: [] };
  }

  // Cache separado de canais por playlist para não sobrecarregar o db.json
  savePlaylistChannels(playlistId, channels, categories = []) {
    const file = path.join(DATA_DIR, `channels_${playlistId}.json`);
    fs.writeFileSync(file, JSON.stringify({ categories, channels }, null, 0), 'utf-8');
    if (this._indexedCache) delete this._indexedCache[playlistId];
  }

  getPlaylistChannels(playlistId) {
    return this.getPlaylistChannelsIndexed(playlistId);
  }

  reset() {
    this._indexedCache = {};
    this.data = {
      playlists: [],
      favorites: [],
      history: [],
      settings: defaultData.settings
    };
    this.save();

    // Apaga todos os arquivos channels_*.json da pasta data/
    try {
      const files = fs.readdirSync(DATA_DIR);
      for (const file of files) {
        if (file.startsWith('channels_')) {
          fs.unlinkSync(path.join(DATA_DIR, file));
        }
      }
    } catch (e) {
      console.error('[Storage Reset Error]', e.message);
    }

    console.log('[Storage] App limpo e resetado com sucesso!');
    return this.data;
  }

  getFavorites() {
    return this.data.favorites || [];
  }

  toggleFavorite(item) {
    const exists = this.data.favorites.some(f => f.id === item.id || f.url === item.url);
    if (exists) {
      this.data.favorites = this.data.favorites.filter(f => f.id !== item.id && f.url !== item.url);
    } else {
      this.data.favorites.unshift({ ...item, addedAt: Date.now() });
    }
    this.save();
    return this.data.favorites;
  }

  getHistory() {
    return this.data.history || [];
  }

  addToHistory(item) {
    this.data.history = (this.data.history || []).filter(h => h.id !== item.id && h.url !== item.url);
    this.data.history.unshift({ ...item, watchedAt: Date.now() });
    if (this.data.history.length > 50) {
      this.data.history = this.data.history.slice(0, 50);
    }
    this.save();
    return this.data.history;
  }

  clearHistory() {
    this.data.history = [];
    this.save();
    return [];
  }

  removeFromHistory(idOrUrl) {
    if (!idOrUrl) return this.data.history || [];
    const targetStr = String(idOrUrl).trim().toLowerCase();
    this.data.history = (this.data.history || []).filter(h => {
      const hId = h.id ? String(h.id).trim().toLowerCase() : '';
      const hUrl = h.url ? String(h.url).trim().toLowerCase() : '';
      const hName = h.name ? String(h.name).trim().toLowerCase() : '';
      return hId !== targetStr && hUrl !== targetStr && hName !== targetStr;
    });
    this.save();
    return this.data.history;
  }

  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }

  getCustomCategories() {
    return this.data.customCategories || [];
  }

  saveCustomCategory(category) {
    if (!this.data.customCategories) this.data.customCategories = [];
    const id = category.id || `custom_${Date.now()}`;
    const newCat = { ...category, id, updatedAt: Date.now() };
    const idx = this.data.customCategories.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.data.customCategories[idx] = newCat;
    } else {
      this.data.customCategories.push(newCat);
      if (!this.data.mainCategoriesConfig) {
        this.data.mainCategoriesConfig = {
          order: ['live', 'sports', 'movies', 'series', 'favorites', 'history', 'adult'],
          hidden: []
        };
      }
      if (!this.data.mainCategoriesConfig.order.includes(id)) {
        this.data.mainCategoriesConfig.order.push(id);
      }
    }
    this.save();
    return this.data.customCategories;
  }

  deleteCustomCategory(id) {
    if (!this.data.customCategories) return [];
    this.data.customCategories = this.data.customCategories.filter(c => c.id !== id);
    if (this.data.mainCategoriesConfig?.order) {
      this.data.mainCategoriesConfig.order = this.data.mainCategoriesConfig.order.filter(o => o !== id);
    }
    this.save();
    return this.data.customCategories;
  }

  getMainCategoriesConfig() {
    const defaultConfig = {
      order: ['live', 'sports', 'movies', 'series', 'favorites', 'history', 'adult'],
      hidden: []
    };
    return this.data.mainCategoriesConfig || defaultConfig;
  }

  updateMainCategoriesConfig(config) {
    this.data.mainCategoriesConfig = {
      ...this.getMainCategoriesConfig(),
      ...config
    };
    this.save();
    return this.data.mainCategoriesConfig;
  }
}

export const storage = new Storage();
