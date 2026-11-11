import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { PlayerView } from './components/PlayerView';
import { VodView } from './components/VodView';
import { PlaylistModal } from './components/PlaylistModal';
import { SettingsModal } from './components/SettingsModal';
import { SeriesModal } from './components/SeriesModal';
import { PinModal } from './components/PinModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { groupChannelsByQuality } from './utils/channelGrouping';
import { saveRecentSearch } from './utils/recentSearches';

// Helper de detecção rigorosa de conteúdo adulto (+18 / XXX)
const isAdultCategory = (name = '', category = '') => {
  const combined = `${name || ''} ${category || ''}`.trim();
  if (!combined) return false;
  return /\b(xxx|adult[ao]s?|adults?|18\+|porno?s?|porn|playboy|sexy|venus|prive|privé|penthouse|hustler|brazzers|red\s*hot|erotic[ao]s?|erótic[ao]s?|sensual|hentai|onlyfans|amador|sex|babes|fetish|hardcore|softcore|for\s*man|camerashow|xvideos|pornhub|redhot|sexx)\b|\+18|18\+|\[\+?18\]|\(18\+\)/i.test(combined);
};

export function App() {
  // 🎨 Tema / Paleta de Cores do Aplicativo (Salva no navegador)
  const [appTheme, setAppTheme] = useState(() => {
    try {
      return localStorage.getItem('orizon_app_theme') || 'slate';
    } catch {
      return 'slate';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
    try {
      localStorage.setItem('orizon_app_theme', appTheme);
    } catch {}
  }, [appTheme]);

  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const saved = localStorage.getItem('orizon_active_tab') || 'live';
      return saved === 'adult' ? 'live' : saved;
    } catch {
      return 'live';
    }
  });

  const [isPlayingVod, setIsPlayingVod] = useState(false);
  const [isAdultUnlocked, setIsAdultUnlocked] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const setActiveTab = (newTab) => {
    if (newTab === 'adult' && !isAdultUnlocked) {
      setIsPinModalOpen(true);
      return;
    }
    setActiveTabState(newTab);
    try {
      localStorage.setItem('orizon_active_tab', newTab);
    } catch {}
    setIsPlayingVod(false);

    // Limpa a categoria selecionada para evitar que o catálogo herde IDs de canais ao vivo de outras abas
    try {
      const savedCat = localStorage.getItem(`orizon_category_${newTab}`);
      if (savedCat) {
        setSelectedCategory(savedCat);
      } else {
        setSelectedCategory(null);
      }
    } catch {
      setSelectedCategory(null);
    }
  };

  const handleLockAdult = () => {
    setIsAdultUnlocked(false);
    setActiveTabState('live');
    try {
      localStorage.setItem('orizon_active_tab', 'live');
    } catch {}
    setIsPlayingVod(false);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loadedCategory, setLoadedCategory] = useState('');
  const [channels, setChannels] = useState([]);
  const [totalChannels, setTotalChannels] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  // Cache em memória de canais por categoria para troca instantânea sem piscada
  const channelsCacheRef = useRef({});
  const activeRequestRef = useRef(0);

  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [activeSeriesData, setActiveSeriesData] = useState(null);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  const [categoriesConfig, setCategoriesConfig] = useState({ order: [], hidden: [] });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset de cache ao trocar de playlist ou aba principal
  useEffect(() => {
    channelsCacheRef.current = {};
    setLoadedCategory('');
    setChannels([]);
  }, [selectedPlaylist?.id, activeTab]);

  // 1. Carrega dados iniciais do backend (playlists, favoritos, histórico, categorias customizadas, settings)
  const loadInitialData = useCallback(async () => {
    try {
      const [resPl, resFav, resHist, resCustom, resSettings] = await Promise.all([
        fetch('/api/playlists').then(r => r.json()).catch(() => []),
        fetch('/api/favorites').then(r => r.json()).catch(() => []),
        fetch('/api/history').then(r => r.json()).catch(() => []),
        fetch('/api/custom-categories').then(r => r.json()).catch(() => ({ customCategories: [], config: { order: [], hidden: [] } })),
        fetch('/api/settings').then(r => r.json()).catch(() => ({}))
      ]);

      const plList = Array.isArray(resPl) ? resPl : [];
      setPlaylists(plList);
      setFavorites(Array.isArray(resFav) ? resFav : []);
      setHistory(Array.isArray(resHist) ? resHist : []);
      if (resCustom) {
        setCustomCategories(resCustom.customCategories || []);
        if (resCustom.config) {
          setCategoriesConfig(resCustom.config);
        }
      }

      // Restaura o perfil/playlist que o usuário estava usando
      let savedId = null;
      try {
        savedId = localStorage.getItem('orizon_active_playlist_id');
      } catch {}
      if (!savedId && resSettings && resSettings.activePlaylistId) {
        savedId = resSettings.activePlaylistId;
      }

      if (plList.length > 0) {
        const matched = (savedId && plList.find(p => p.id === savedId)) || plList[0];
        setSelectedPlaylist(matched);
        try {
          localStorage.setItem('orizon_active_playlist_id', matched.id);
        } catch {}
      } else {
        setSelectedPlaylist(null);
        try {
          localStorage.removeItem('orizon_active_playlist_id');
        } catch {}
      }
    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
    } finally {
      // Delay suave para transição fluida, eliminando o flash da tela de login
      setTimeout(() => {
        setIsAppLoading(false);
      }, 300);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Carrega as categorias adequadas para a aba atual (Ao vivo, Esportes, Filmes, Séries)
  useEffect(() => {
    if (!selectedPlaylist) {
      setCategories([]);
      setChannels([]);
      setSelectedCategory('');
      setLoadedCategory('');
      return;
    }

    if (activeTab === 'favorites') {
      const groupedFavs = groupChannelsByQuality(favorites);
      setCategories([{ name: 'Favoritos', count: groupedFavs.length }]);
      setChannels(groupedFavs);
      setTotalChannels(groupedFavs.length);
      setSelectedCategory('Favoritos');
      setLoadedCategory('Favoritos');
      setIsLoadingChannels(false);
      return;
    }

    // Se for uma categoria personalizada criada pelo usuário
    const customCat = (customCategories || []).find(c => c.id === activeTab || `custom_${c.id}` === activeTab);
    if (customCat) {
      const itemsList = customCat.items || [];
      setCategories([{ name: customCat.name, count: itemsList.length }]);
      setChannels(itemsList);
      setTotalChannels(itemsList.length);
      setSelectedCategory(customCat.name);
      setLoadedCategory(customCat.name);
      setIsLoadingChannels(false);
      return;
    }

    if (activeTab === 'history') {
      const histList = history || [];
      const liveItems = histList.filter(h => !h.type || h.type === 'live');
      const movieItems = histList.filter(h => h.type === 'movie');
      const seriesItems = histList.filter(h => h.type === 'series');

      const histCats = [
        { name: 'Histórico Recente', count: histList.length, id: 'all' }
      ];
      if (liveItems.length > 0) {
        histCats.push({ name: 'Canais Ao Vivo', count: liveItems.length, id: 'live' });
      }
      if (movieItems.length > 0) {
        histCats.push({ name: 'Filmes Assistidos', count: movieItems.length, id: 'movies' });
      }
      if (seriesItems.length > 0) {
        histCats.push({ name: 'Séries Assistidas', count: seriesItems.length, id: 'series' });
      }

      setCategories(histCats);
      const targetCat = histCats[0].name;
      setSelectedCategory(targetCat);
      setChannels(histList);
      setTotalChannels(histList.length);
      setLoadedCategory(targetCat);
      setIsLoadingChannels(false);
      return;
    }

    let section = 'live';
    if (activeTab === 'movies') section = 'movies';
    if (activeTab === 'series') section = 'series';
    if (activeTab === 'adult') section = 'adult';

    fetch(`/api/playlists/${selectedPlaylist.id}/categories?section=${section}`)
      .then(r => r.json())
      .then(data => {
        let catList = data.categories || [];

        // Filtro estrito: Conteúdo adulto isolado unicamente na aba 'adult'
        if (activeTab === 'adult') {
          catList = catList.filter(c => isAdultCategory(typeof c === 'string' ? c : (c.name || '')));
        } else {
          catList = catList.filter(c => !isAdultCategory(typeof c === 'string' ? c : (c.name || '')));
        }

        // Filtro específico para a aba de esportes
        if (activeTab === 'sports') {
          catList = catList.filter(c => /esporte|sport|futebol|combate|premiere|espn/i.test(typeof c === 'string' ? c : (c.name || '')));
        }

        setCategories(catList);
        if (catList.length > 0) {
          let savedCat = '';
          try {
            savedCat = localStorage.getItem(`orizon_category_${activeTab}`);
          } catch {}

          const found = savedCat ? catList.find(c => {
            const name = typeof c === 'string' ? c : (c.name || '');
            return name.trim().toLowerCase() === savedCat.trim().toLowerCase();
          }) : null;

          const targetCat = found || catList[0];
          setSelectedCategory(targetCat);
          const firstCatName = typeof targetCat === 'string' ? targetCat : (targetCat.name || 'Geral');
          const firstCatId = typeof targetCat === 'object' && targetCat.id ? targetCat.id : null;

          // Somente busca canais de TV ao vivo se a aba não for de catálogo VOD/Séries
          if (activeTab !== 'movies' && activeTab !== 'series' && activeTab !== 'adult') {
            loadChannelsForCategory(selectedPlaylist.id, firstCatName, firstCatId, 1);
          }
        } else {
          setChannels([]);
          setTotalChannels(0);
          setLoadedCategory('');
        }
      })
      .catch(err => {
        console.error('Erro ao carregar categorias:', err);
      });
  }, [selectedPlaylist, activeTab, favorites, history, customCategories]);

  // 3. Função para carregar canais de uma categoria específica (com cache em memória e sem vazamento de categorias anteriores)
  const loadChannelsForCategory = async (playlistId, catName, catId = null, pageNum = 1) => {
    if (!playlistId) return;

    const nameStr = typeof catName === 'string' ? catName : (catName?.name || 'Geral');
    const idStr = catId || (typeof catName === 'object' && catName?.id ? catName.id : null);
    const cacheKey = `${playlistId}_${activeTab}_${nameStr.trim().toLowerCase()}_${idStr || ''}_${searchQuery.trim().toLowerCase()}`;

    // 1. Resposta instantânea se já estiver em cache na sessão (zero delay, sem piscar nada)
    if (channelsCacheRef.current[cacheKey]) {
      const cached = channelsCacheRef.current[cacheKey];
      setChannels(cached.channels);
      setTotalChannels(cached.total);
      setLoadedCategory(nameStr);
      setIsLoadingChannels(false);
      if (!selectedChannel && cached.channels.length > 0) {
        setSelectedChannel(cached.channels[0]);
      }
      return;
    }

    // 2. Não está no cache: Limpa os canais anteriores imediatamente para NUNCA piscar canais errados
    setChannels([]);
    setLoadedCategory('');
    setIsLoadingChannels(true);

    const requestId = ++activeRequestRef.current;

    try {
      const params = new URLSearchParams({
        category: nameStr,
        page: pageNum.toString(),
        limit: '150',
        include_adult: (isAdultUnlocked && activeTab === 'adult') ? 'true' : 'false'
      });
      if (idStr) {
        params.append('category_id', idStr.toString());
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(`/api/playlists/${playlistId}/channels?${params.toString()}`);
      const data = await res.json();

      // Ignora respostas atrasadas se o usuário clicou em outra categoria enquanto essa carregava
      if (activeRequestRef.current !== requestId) return;

      let newChannels = data.channels || [];
      if (!isAdultUnlocked || activeTab !== 'adult') {
        newChannels = newChannels.filter(c => !isAdultCategory(c.name || '', c.category || ''));
      }
      const grouped = groupChannelsByQuality(newChannels);
      const totalCount = data.total ? (grouped.length === newChannels.length ? data.total : grouped.length) : grouped.length;

      // Armazena no cache da sessão
      channelsCacheRef.current[cacheKey] = {
        channels: grouped,
        total: totalCount
      };

      setChannels(grouped);
      setTotalChannels(totalCount);
      setLoadedCategory(nameStr);
      setPage(pageNum);

      if (!selectedChannel && grouped.length > 0) {
        setSelectedChannel(grouped[0]);
      }
    } catch (err) {
      if (activeRequestRef.current === requestId) {
        console.error('Erro ao carregar canais da categoria:', err);
      }
    } finally {
      if (activeRequestRef.current === requestId) {
        setIsLoadingChannels(false);
      }
    }
  };

  // Troca de categoria disparada pelo clique no acordeão ou cards da Sidebar
  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    const catName = typeof cat === 'string' ? cat : (cat?.name || 'Geral');
    const catId = typeof cat === 'object' && cat?.id ? cat.id : null;
    try {
      localStorage.setItem(`orizon_category_${activeTab}`, catName);
    } catch {}

    // Ao navegar entre categorias em Filmes ou Séries, fecha o player e abre o catálogo da nova categoria
    if (activeTab === 'movies' || activeTab === 'series') {
      setIsPlayingVod(false);
      setActiveSeriesData(null);
    }

    if (activeTab === 'history') {
      let itemsToShow = history || [];
      if (catName === 'Canais Ao Vivo' || catId === 'live') {
        itemsToShow = (history || []).filter(h => !h.type || h.type === 'live');
      } else if (catName === 'Filmes Assistidos' || catId === 'movies') {
        itemsToShow = (history || []).filter(h => h.type === 'movie');
      } else if (catName === 'Séries Assistidas' || catId === 'series') {
        itemsToShow = (history || []).filter(h => h.type === 'series');
      }
      setChannels(itemsToShow);
      setTotalChannels(itemsToShow.length);
      setLoadedCategory(catName);
      return;
    }

    if (activeTab === 'favorites') {
      const groupedFavs = groupChannelsByQuality(favorites);
      setChannels(groupedFavs);
      setTotalChannels(groupedFavs.length);
      setLoadedCategory(catName);
      return;
    }

    const isCustomCat = (customCategories || []).find(c => c.id === activeTab || `custom_${c.id}` === activeTab);
    if (isCustomCat) {
      const itemsList = isCustomCat.items || [];
      setChannels(itemsList);
      setTotalChannels(itemsList.length);
      setLoadedCategory(isCustomCat.name);
      return;
    }

    if (selectedPlaylist && activeTab !== 'movies' && activeTab !== 'series' && activeTab !== 'adult') {
      loadChannelsForCategory(selectedPlaylist.id, catName, catId, 1);
    }
  };

  // 4. Seleção de Canal / Stream (com conexão automática de contexto de Séries, TV Ao Vivo e Filmes para itens do Histórico)
  const handleSelectChannel = (channel) => {
    // Salva automaticamente a pesquisa feita quando o usuário clica em qualquer canal, filme ou série
    if (searchQuery && searchQuery.trim().length >= 2) {
      saveRecentSearch(searchQuery.trim());
    }

    const streamType = channel.type || (activeTab === 'movies' ? 'movie' : activeTab === 'series' ? 'series' : 'live');
    const enriched = { ...channel, type: streamType };
    setSelectedChannel(enriched);

    if (streamType === 'movie' || streamType === 'series') {
      setIsPlayingVod(true);
    } else {
      setIsPlayingVod(false);
    }

    const isFromHistoryTab = activeTab === 'history';

    // Se o clique veio da aba de Histórico, abre exatamente no contexto correspondente (TV Ao Vivo, Filmes ou Séries)
    if (isFromHistoryTab) {
      if (streamType === 'live') {
        setActiveTabState('live');
        try { localStorage.setItem('orizon_active_tab', 'live'); } catch {}
        if (channel.category) {
          try { localStorage.setItem('orizon_category_live', channel.category); } catch {}
          setSelectedCategory(channel.category);
          if (selectedPlaylist?.id) {
            loadChannelsForCategory(selectedPlaylist.id, channel.category, channel.categoryId, 1);
          }
        }
      } else if (streamType === 'movie') {
        setActiveTabState('movies');
        try { localStorage.setItem('orizon_active_tab', 'movies'); } catch {}
        if (channel.category) {
          try { localStorage.setItem('orizon_category_movies', channel.category); } catch {}
          setSelectedCategory(channel.category);
          if (selectedPlaylist?.id) {
            loadChannelsForCategory(selectedPlaylist.id, channel.category, channel.categoryId, 1);
          }
        }
      } else if (streamType === 'series') {
        setActiveTabState('series');
        try { localStorage.setItem('orizon_active_tab', 'series'); } catch {}
      }
    }

    // Se for um episódio de série (vindo do histórico, favoritos ou catálogo)
    const isSeriesEpisode = Boolean(
      streamType === 'series' &&
      (channel.isEpisode || channel.seasonNumber || channel.episodeNum || channel.seriesId)
    );

    if (isSeriesEpisode && selectedPlaylist?.id) {
      const sId = channel.seriesId || (channel.id && String(channel.id).startsWith('xt_ep_') ? null : channel.id);
      const targetSeason = (channel.seasonNumber || '1').toString();

      if (sId) {
        // Se a série já for a mesma atualmente ativa, só sincroniza a temporada
        if (activeSeriesData && (activeSeriesData.seriesId == sId || activeSeriesData.series?.seriesId == sId)) {
          setActiveSeriesData(prev => ({
            ...prev,
            selectedSeason: targetSeason
          }));
        } else {
          // Busca os metadados completos para reabrir a série inteira (temporadas e episódios)
          fetch(`/api/xtream/${selectedPlaylist.id}/series-info/${sId}`)
            .then(r => r.json())
            .then(data => {
              if (!data || data.error) return;
              const seriesObj = {
                id: `xt_series_${sId}`,
                seriesId: sId,
                name: channel.seriesName || data.name || 'Série',
                cover: data.cover || channel.image || '',
                backdrop: data.backdrop || channel.image || '',
                plot: data.plot || channel.plot || '',
                logo: data.cover || channel.image || ''
              };
              setSelectedSeries(seriesObj);
              setActiveSeriesData({
                ...data,
                series: seriesObj,
                selectedSeason: targetSeason
              });
            })
            .catch(err => console.warn('[Orizon TV] Erro ao carregar contexto da série pelo histórico:', err));
        }
      }
    }

    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enriched)
    })
      .then(r => r.json())
      .then(updated => setHistory(updated))
      .catch(e => console.error(e));
  };

  // Remover Item Único do Histórico
  const handleRemoveFromHistory = async (channelOrId) => {
    if (!channelOrId) return;
    const targetId = typeof channelOrId === 'object'
      ? (channelOrId.id || channelOrId.url || channelOrId.name)
      : channelOrId;

    try {
      const res = await fetch(`/api/history/${encodeURIComponent(targetId)}`, {
        method: 'DELETE'
      });
      const updated = await res.json();
      setHistory(updated || []);

      if (activeTab === 'history') {
        setChannels(prev => prev.filter(c => 
          c.id !== targetId && 
          c.url !== targetId && 
          String(c.id) !== String(targetId) &&
          c.name !== targetId
        ));
        setTotalChannels(prev => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Erro ao remover item do histórico:', e);
    }
  };

  // Limpar Todo o Histórico de Reprodução
  const handleClearHistory = async () => {
    try {
      await fetch('/api/history', { method: 'DELETE' });
      setHistory([]);
      if (activeTab === 'history') {
        setChannels([]);
        setTotalChannels(0);
      }
    } catch (e) {
      console.error('Erro ao limpar histórico:', e);
    }
  };

  // 4.1. Gerenciamento de Posição das Categorias e Categorias Customizadas
  const handleSaveCategoriesOrder = async (newConfig) => {
    try {
      const res = await fetch('/api/categories-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      const data = await res.json();
      setCategoriesConfig(data);
    } catch (err) {
      console.error('Erro ao salvar ordem das categorias:', err);
    }
  };

  const handleSaveCustomCategory = async (catData) => {
    try {
      const res = await fetch('/api/custom-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catData)
      });
      const data = await res.json();
      setCustomCategories(data.customCategories || []);
      if (data.config) {
        setCategoriesConfig(data.config);
      }
    } catch (err) {
      console.error('Erro ao salvar categoria customizada:', err);
    }
  };

  const handleDeleteCustomCategory = async (id) => {
    try {
      const res = await fetch(`/api/custom-categories/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      setCustomCategories(data.customCategories || []);
      if (data.config) {
        setCategoriesConfig(data.config);
      }
      if (activeTab === id || activeTab === `custom_${id}`) {
        setActiveTab('live');
      }
    } catch (err) {
      console.error('Erro ao excluir categoria customizada:', err);
    }
  };

  // 5. Toggle Favorito
  const handleToggleFavorite = (channel) => {
    fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(channel)
    })
      .then(r => r.json())
      .then(updated => setFavorites(updated))
      .catch(e => console.error(e));
  };

  // 6. Fullscreen Toggle do Player (Foca no container do vídeo)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const playerEl = document.getElementById('orizon-player-container');
      const targetEl = playerEl || document.documentElement;
      if (targetEl.requestFullscreen) {
        targetEl.requestFullscreen().catch(e => console.error('Erro ao entrar em tela cheia:', e));
      } else if (targetEl.webkitRequestFullscreen) {
        targetEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(e => console.error('Erro ao sair de tela cheia:', e));
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  // Listener para sincronizar estado isFullscreen (inclusive ao pressionar Esc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 7. Atalhos Globais de Notebook (Ctrl+K, F, Espaço, Setas)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Atalho Ctrl+K ou Command+K para focar busca
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput) searchInput.focus();
        return;
      }

      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        return;
      }

      if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      } else if (!selectedChannel && channels.length > 0) {
        if (e.key === 'ArrowRight') {
          const idx = channels.findIndex(c => c.id === selectedChannel?.id || c.url === selectedChannel?.url);
          if (idx !== -1 && idx < channels.length - 1) {
            handleSelectChannel(channels[idx + 1]);
          }
        } else if (e.key === 'ArrowLeft') {
          const idx = channels.findIndex(c => c.id === selectedChannel?.id || c.url === selectedChannel?.url);
          if (idx > 0) {
            handleSelectChannel(channels[idx - 1]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, selectedChannel]);

  // 8. Reset Completo do Aplicativo
  const handleResetApp = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
      try {
        localStorage.removeItem('orizon_active_playlist_id');
      } catch {}
      setPlaylists([]);
      setSelectedPlaylist(null);
      setCategories([]);
      setSelectedCategory('');
      setChannels([]);
      setTotalChannels(0);
      setSelectedChannel(null);
      setFavorites([]);
      setHistory([]);
      setIsSettingsModalOpen(false);
      setIsPlaylistModalOpen(true);
    } catch (e) {
      console.error('Erro ao resetar aplicativo:', e);
    }
  };

  const handlePreviousChannel = () => {
    if (channels.length === 0) return;
    const idx = channels.findIndex(c => c.id === selectedChannel?.id || c.url === selectedChannel?.url);
    if (idx > 0) {
      handleSelectChannel(channels[idx - 1]);
    }
  };

  const handleNextChannel = () => {
    if (channels.length === 0) return;
    const idx = channels.findIndex(c => c.id === selectedChannel?.id || c.url === selectedChannel?.url);
    if (idx !== -1 && idx < channels.length - 1) {
      handleSelectChannel(channels[idx + 1]);
    }
  };

  // Navegação inteligente que avança/volta episódios se estiver assistindo série
  const handlePreviousMedia = () => {
    if (activeSeriesData && selectedChannel?.type === 'series') {
      const curSeason = activeSeriesData.selectedSeason || '1';
      const eps = activeSeriesData.episodesBySeason?.[curSeason] || [];
      const curIdx = eps.findIndex(e => e.id === selectedChannel.id || e.url === selectedChannel.url);
      if (curIdx > 0) {
        handleSelectChannel(eps[curIdx - 1]);
        return;
      }
    }
    handlePreviousChannel();
  };

  const handleNextMedia = () => {
    if (activeSeriesData && selectedChannel?.type === 'series') {
      const curSeasonStr = (activeSeriesData.selectedSeason || '1').toString();
      const eps = activeSeriesData.episodesBySeason?.[curSeasonStr] || [];
      const curIdx = eps.findIndex(e => e.id === selectedChannel.id || e.url === selectedChannel.url);
      if (curIdx !== -1 && curIdx < eps.length - 1) {
        handleSelectChannel(eps[curIdx + 1]);
        return;
      }
      // Se for o último episódio da temporada atual, avança para o primeiro da próxima temporada
      const epsBySeason = activeSeriesData.episodesBySeason || {};
      const seasonNums = Object.keys(epsBySeason).map(s => parseInt(s, 10)).sort((a, b) => a - b);
      const currentSeasonNum = parseInt(curSeasonStr, 10);
      const nextSeasonNum = seasonNums.find(n => n > currentSeasonNum);
      if (nextSeasonNum && epsBySeason[nextSeasonNum.toString()]?.length > 0) {
        const nextEp = epsBySeason[nextSeasonNum.toString()][0];
        setActiveSeriesData(prev => ({ ...prev, selectedSeason: nextSeasonNum.toString() }));
        handleSelectChannel({ ...nextEp, type: 'series', isEpisode: true });
        return;
      }
    }
    handleNextChannel();
  };

  const handleSelectPlaylist = (p) => {
    if (!p) return;
    setSelectedPlaylist(p);
    setSelectedChannel(null);
    setCategories([]);
    setChannels([]);
    setSelectedCategory('');
    setSearchQuery('');

    // Salva a playlist selecionada no localStorage e no backend
    try {
      localStorage.setItem('orizon_active_playlist_id', p.id);
    } catch (e) {
      console.warn('Erro ao salvar playlist no localStorage:', e);
    }

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activePlaylistId: p.id })
    }).catch(err => console.warn('Erro ao salvar playlist ativa no servidor:', err));
  };

  const handlePlaylistDeleted = (deletedId) => {
    const updated = playlists.filter(p => p.id !== deletedId);
    setPlaylists(updated);
    if (selectedPlaylist?.id === deletedId) {
      if (updated.length > 0) {
        handleSelectPlaylist(updated[0]);
      } else {
        setSelectedPlaylist(null);
        setSelectedChannel(null);
        setCategories([]);
        setChannels([]);
        try {
          localStorage.removeItem('orizon_active_playlist_id');
        } catch {}
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activePlaylistId: null })
        }).catch(() => {});
        setIsPlaylistModalOpen(true);
      }
    }
  };

  const handlePlaylistReloaded = (updatedPlaylist) => {
    setPlaylists(prev => prev.map(p => p.id === updatedPlaylist.id ? updatedPlaylist : p));
    if (selectedPlaylist?.id === updatedPlaylist.id) {
      setSelectedPlaylist({ ...updatedPlaylist });
      let section = 'live';
      if (activeTab === 'movies') section = 'movies';
      if (activeTab === 'series') section = 'series';

      fetch(`/api/playlists/${updatedPlaylist.id}/categories?section=${section}`)
        .then(r => r.json())
        .then(data => {
          const catList = data.categories || [];
          setCategories(catList);
          if (catList.length > 0) {
            const firstCat = catList[0].name;
            setSelectedCategory(firstCat);
            loadChannelsForCategory(updatedPlaylist.id, firstCat, null, 1);
          }
        })
        .catch(err => console.error('Erro ao recarregar categorias:', err));
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
      position: 'relative',
      padding: isFullscreen ? 0 : '10px',
      gap: isFullscreen ? 0 : '10px',
      boxSizing: 'border-box'
    }}>
      {/* Faixa superior de arrasto invisível no topo da janela (Electron) */}
      {!isFullscreen && (
        <div 
          className="app-drag-region"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: '145px',
            height: '10px',
            zIndex: 100,
            pointerEvents: 'auto'
          }}
        />
      )}

      {/* 🚀 SPLASH SCREEN / LOADING INICIAL (Elimina qualquer flash da tela de login) */}
      {isAppLoading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.98) 0%, #07090e 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none'
          }}
        >
          {/* Faixa superior de arrasto da janela no Electron */}
          <div 
            className="app-drag-region"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: '150px',
              height: '38px',
              zIndex: 100000
            }}
          />

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'splashFadeIn 0.35s ease-out'
          }}>
            {/* Logo com brilho e borda arredondada */}
            <div style={{
              width: '92px',
              height: '92px',
              borderRadius: '24px',
              overflow: 'hidden',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '2px solid var(--border-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 40px var(--accent-subtle), 0 12px 32px rgba(0,0,0,0.8)',
              marginBottom: '20px',
              position: 'relative'
            }}>
              <img 
                src="/logo.jpg" 
                alt="Orizon TV" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block'
                }} 
              />
            </div>

            {/* Título */}
            <h1 style={{
              fontSize: '26px',
              fontWeight: '800',
              letterSpacing: '-0.5px',
              color: '#ffffff',
              margin: '0 0 6px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              ORIZON <span style={{ color: 'var(--accent-primary)' }}>TV</span>
            </h1>

            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              fontWeight: '500',
              margin: '0 0 24px 0',
              letterSpacing: '0.2px'
            }}>
              Carregando sua lista e canais...
            </p>

            {/* Barra de progresso com animação suave */}
            <div style={{
              width: '210px',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: '45%',
                background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
                borderRadius: '999px',
                animation: 'shimmerLoad 1.3s infinite ease-in-out'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* 📁 COLUNA ESQUERDA: Sidebar de Canais (~340px fixo - Oculta em Tela Cheia) */}
      <div style={{ display: isFullscreen ? 'none' : 'flex', height: '100%', flexShrink: 0 }}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categories={categories}
          selectedCategory={selectedCategory}
          loadedCategory={loadedCategory}
          onSelectCategory={handleSelectCategory}
          channels={channels}
          selectedChannel={selectedChannel}
          onSelectChannel={handleSelectChannel}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          history={history}
          onClearHistory={handleClearHistory}
          onRemoveFromHistory={handleRemoveFromHistory}
          onOpenPlaylistModal={() => setIsPlaylistModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          isLoadingChannels={isLoadingChannels}
          playlists={playlists}
          selectedPlaylist={selectedPlaylist}
          activeSeriesData={activeSeriesData}
          onExitSeriesMode={() => {
            setActiveSeriesData(null);
            setIsPlayingVod(false);
          }}
          onSelectSeriesSeason={(sNum) => setActiveSeriesData(prev => prev ? { ...prev, selectedSeason: sNum } : null)}
          isAdultUnlocked={isAdultUnlocked}
          onRequestUnlockAdult={() => setIsPinModalOpen(true)}
          onLockAdult={handleLockAdult}
          appTheme={appTheme}
          onChangeAppTheme={setAppTheme}
          categoriesConfig={categoriesConfig}
          customCategories={customCategories}
          onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
          onPlaySeries={(seriesItem) => {
            setSelectedSeries(seriesItem);
            setIsSeriesModalOpen(true);
          }}
        />
      </div>

      {/* 📺 COLUNA DIREITA: Player Principal, Grade VOD ou Tela de Login */}
      <main style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {!isAppLoading && !selectedPlaylist ? (
          /* Tela de Boas-Vindas / Pedido de Login */
          <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.06) 0%, #07090e 70%)',
            padding: '40px',
            textAlign: 'center',
            position: 'relative',
            borderRadius: isFullscreen ? 0 : '18px',
            border: isFullscreen ? 'none' : '1px solid var(--border-subtle)',
            boxShadow: isFullscreen ? 'none' : '0 12px 36px rgba(0, 0, 0, 0.45)'
          }}>
            {/* Faixa Superior de Arrasto da Janela */}
            <div 
              className="app-drag-region"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: '150px',
                height: '38px',
                zIndex: 10
              }}
            />
            <div style={{
              width: '90px',
              height: '90px',
              borderRadius: '24px',
              overflow: 'hidden',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '2px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 35px rgba(2, 132, 199, 0.35)',
              marginBottom: '24px'
            }}>
              <img 
                src="/logo.jpg" 
                alt="Orizon TV" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block'
                }} 
              />
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>
              Bem-vindo ao <span style={{ color: 'var(--accent-primary)' }}>Orizon TV</span>
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '440px', lineHeight: '1.6', marginBottom: '28px' }}>
              Você não possui nenhum perfil ou lista conectado no momento. Faça login com suas credenciais do Xtream Codes ou insira sua lista M3U.
            </p>

            <button
              onClick={() => setIsPlaylistModalOpen(true)}
              style={{
                padding: '14px 28px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 0 25px rgba(16, 185, 129, 0.4)',
                cursor: 'pointer'
              }}
            >
              Conectar Lista / Fazer Login
            </button>
          </div>
        ) : (activeTab === 'movies' || activeTab === 'series') && !isPlayingVod ? (
          <div style={{ flex: 1, height: '100%' }}>
            <VodView
              type={activeTab}
              playlist={selectedPlaylist}
              selectedCategory={selectedCategory}
              onPlayItem={(item, groupTerm) => {
                const termToSave = (groupTerm || searchQuery || '').trim();
                if (termToSave) {
                  saveRecentSearch(termToSave);
                }
                if (activeTab === 'series' || item.type === 'series') {
                  setSelectedSeries(item);
                  setIsSeriesModalOpen(true);
                } else {
                  handleSelectChannel({ ...item, type: 'movie' });
                  setIsPlayingVod(true);
                }
              }}
              searchQuery={searchQuery}
              isAdultUnlocked={isAdultUnlocked}
            />
          </div>
        ) : (
          <PlayerView
            currentStream={selectedChannel}
            activeSeriesData={activeSeriesData}
            onPreviousChannel={handlePreviousMedia}
            onNextChannel={handleNextMedia}
            onPlayNextEpisode={(ep, seasonNum) => {
              if (ep) {
                handleSelectChannel({ ...ep, type: 'series', isEpisode: true });
                if (seasonNum && activeSeriesData) {
                  setActiveSeriesData(prev => ({
                    ...prev,
                    selectedSeason: seasonNum.toString()
                  }));
                }
              } else {
                handleNextMedia();
              }
            }}
            enableProxy={true}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
            onOpenEpisodes={() => {
              if (selectedSeries) {
                setIsSeriesModalOpen(true);
              } else if (activeSeriesData?.series) {
                setSelectedSeries(activeSeriesData.series);
                setIsSeriesModalOpen(true);
              }
            }}
            onBackToCatalog={() => {
              setActiveSeriesData(null);
              setIsPlayingVod(false);
            }}
            onRemoveFromHistory={handleRemoveFromHistory}
            onBackToLive={() => {
              setActiveTab('live');
              setIsPlayingVod(false);
            }}
            isInHistory={Boolean(
              selectedChannel &&
              history.some(h => 
                (h.id && selectedChannel.id && String(h.id) === String(selectedChannel.id)) ||
                (h.url && selectedChannel.url && h.url === selectedChannel.url) ||
                (h.name && selectedChannel.name && h.name.toLowerCase() === selectedChannel.name.toLowerCase())
              )
            )}
          />
        )}
      </main>

      {/* Modais */}
      <SeriesModal
        isOpen={isSeriesModalOpen}
        onClose={() => setIsSeriesModalOpen(false)}
        series={selectedSeries || activeSeriesData?.series}
        playlist={selectedPlaylist}
        currentPlayingEpisode={selectedChannel}
        initialSeason={activeSeriesData?.selectedSeason || selectedChannel?.seasonNumber?.toString() || '1'}
        onPlayEpisode={(ep, seriesData) => {
          handleSelectChannel({ ...ep, type: 'series', isEpisode: true });
          if (seriesData) {
            setActiveSeriesData({
              ...seriesData,
              series: selectedSeries,
              selectedSeason: ep.seasonNumber ? ep.seasonNumber.toString() : '1'
            });
          }
          setIsPlayingVod(true);
        }}
      />

      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        playlists={playlists}
        selectedPlaylist={selectedPlaylist}
        onSelectPlaylist={handleSelectPlaylist}
        onPlaylistCreated={(newP) => {
          setPlaylists(prev => [...prev, newP]);
          handleSelectPlaylist(newP);
        }}
        onPlaylistDeleted={handlePlaylistDeleted}
        onPlaylistReloaded={handlePlaylistReloaded}
        onResetApp={handleResetApp}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onResetApp={handleResetApp}
        appTheme={appTheme}
        onChangeAppTheme={setAppTheme}
        onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
        isAdultUnlocked={isAdultUnlocked}
        onRequestUnlockAdult={() => setIsPinModalOpen(true)}
        onLockAdult={handleLockAdult}
      />

      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        playlist={selectedPlaylist}
        customCategories={customCategories}
        categoriesConfig={categoriesConfig}
        onSaveOrder={handleSaveCategoriesOrder}
        onSaveCustomCategory={handleSaveCustomCategory}
        onDeleteCustomCategory={handleDeleteCustomCategory}
      />

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={() => {
          setIsAdultUnlocked(true);
          setIsPinModalOpen(false);
          setActiveTabState('adult');
          try {
            localStorage.setItem('orizon_active_tab', 'adult');
          } catch {}
          setIsPlayingVod(false);
        }}
      />
    </div>
  );
}

export default App;
