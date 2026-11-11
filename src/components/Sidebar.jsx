import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Tv, 
  Search, 
  Trophy, 
  Film, 
  Clapperboard, 
  Star, 
  History,
  Trash2,
  ChevronDown, 
  ChevronRight,
  Settings,
  PlusCircle,
  Radio,
  SlidersHorizontal,
  Loader2,
  FolderOpen,
  UserCheck,
  ArrowLeft,
  Play,
  Layers,
  Lock,
  Unlock,
  ShieldAlert,
  Palette,
  Clock,
  X,
  LayoutGrid,
  List
} from 'lucide-react';
import { useVodProgress, NetflixProgressBar } from '../utils/vodProgress';
import { CATEGORY_ICONS } from './CategoryManagerModal';
import { 
  getRecentSearches, 
  saveRecentSearch, 
  removeRecentSearch, 
  clearRecentSearches, 
  RECENT_SEARCHES_EVENT 
} from '../utils/recentSearches';
import { isAdultContent } from '../utils/adultFilter';
import { getGenreImage, getCategoryCover, cleanGenreName } from '../utils/genreImages';

export function Sidebar({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  categories = [],
  selectedCategory,
  loadedCategory = '',
  onSelectCategory,
  channels = [],
  selectedChannel,
  onSelectChannel,
  favorites = [],
  onToggleFavorite,
  history = [],
  onClearHistory,
  onRemoveFromHistory,
  onOpenPlaylistModal,
  onOpenSettingsModal,
  isLoadingChannels = false,
  playlists = [],
  selectedPlaylist,
  activeSeriesData = null,
  onExitSeriesMode,
  onSelectSeriesSeason,
  isAdultUnlocked = false,
  onRequestUnlockAdult,
  onLockAdult,
  appTheme = 'slate',
  onChangeAppTheme,
  categoriesConfig = { order: [], hidden: [] },
  customCategories = [],
  onOpenCategoryManager,
  onPlaySeries
}) {
  const { getProgress } = useVodProgress();
  const [recentSearches, setRecentSearches] = useState(getRecentSearches);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const searchBoxRef = useRef(null);
  const searchInputRef = useRef(null);

  // Modo de visualização de categorias de Filmes e Séries (Padrão: Grid de 3 colunas)
  const [vodViewMode, setVodViewMode] = useState(() => {
    try {
      return localStorage.getItem('orizon_vod_view_mode') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleSetVodViewMode = (mode) => {
    setVodViewMode(mode);
    try {
      localStorage.setItem('orizon_vod_view_mode', mode);
    } catch {
      // Ignora erro de local storage
    }
  };

  // Sincroniza histórico de pesquisas recentes com eventos e fecha ao clicar fora
  useEffect(() => {
    const onRecentUpdated = (e) => {
      if (e.detail) setRecentSearches(e.detail);
    };
    window.addEventListener(RECENT_SEARCHES_EVENT, onRecentUpdated);

    const handleClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setIsRecentOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener(RECENT_SEARCHES_EVENT, onRecentUpdated);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [expandedCategory, setExpandedCategory] = useState(() => {
    if (!selectedCategory) return '';
    return typeof selectedCategory === 'string' ? selectedCategory : (selectedCategory.name || '');
  });

  const formatWatchedAt = (timestamp) => {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    if (isToday) return `Visto hoje às ${hours}:${minutes}`;
    return `Visto em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hours}:${minutes}`;
  };

  // Sincroniza o acordeão quando a categoria ativa mudar externamente ou trocar de aba
  useEffect(() => {
    if (selectedCategory) {
      const catName = typeof selectedCategory === 'string' ? selectedCategory : (selectedCategory.name || '');
      setExpandedCategory(catName);
    }
  }, [selectedCategory, activeTab]);

  const filteredChannels = useMemo(() => {
    let list = channels;
    if (!isAdultUnlocked) {
      list = list.filter(c => !isAdultContent(c.name, c.category));
    }
    if (!searchQuery?.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [channels, searchQuery, isAdultUnlocked]);

  const isFav = (channel) => {
    return favorites.some(f => f.id === channel.id || f.url === channel.url);
  };

  const getQualityBadge = (name = '') => {
    const upper = name.toUpperCase();
    if (upper.includes('4K') || upper.includes('UHD')) return '4K';
    if (upper.includes('FHD') || upper.includes('1080')) return 'FHD';
    if (upper.includes('HD') || upper.includes('720')) return 'HD';
    return 'LIVE';
  };

  const handleCategoryClick = (cat) => {
    const catName = typeof cat === 'string' ? cat : (cat.name || 'Geral');
    if (onSelectCategory) {
      onSelectCategory(cat);
    }
    if (expandedCategory === catName) {
      setExpandedCategory('');
    } else {
      setExpandedCategory(catName);
    }
  };

  const isVodTab = activeTab === 'movies' || activeTab === 'series';

  // Abas de navegação dinâmica baseada na ordem personalizada e categorias customizadas
  const navigationTabs = useMemo(() => {
    const defaultTabsMap = {
      live: { id: 'live', label: 'Ao Vivo', icon: Tv },
      sports: { id: 'sports', label: 'Esportes', icon: Trophy },
      movies: { id: 'movies', label: 'Filmes', icon: Film },
      series: { id: 'series', label: 'Séries', icon: Clapperboard },
      favorites: { id: 'favorites', label: 'Favoritos', icon: Star },
      history: { id: 'history', label: 'Histórico', icon: History },
      adult: { id: 'adult', label: 'Adulto', icon: isAdultUnlocked ? Unlock : Lock, isAdult: true }
    };

    const customTabsMap = {};
    (customCategories || []).forEach(c => {
      const IconComponent = CATEGORY_ICONS[c.icon] || Star;
      customTabsMap[c.id] = {
        id: c.id,
        label: c.name,
        icon: IconComponent,
        isCustom: true,
        customData: c
      };
    });

    const combinedMap = { ...defaultTabsMap, ...customTabsMap };
    const orderList = categoriesConfig?.order && categoriesConfig.order.length > 0
      ? categoriesConfig.order
      : ['live', 'sports', 'movies', 'series', 'favorites', 'history', 'adult'];

    const hiddenSet = new Set(categoriesConfig?.hidden || []);

    const result = [];
    orderList.forEach(id => {
      if (!hiddenSet.has(id) && combinedMap[id]) {
        result.push(combinedMap[id]);
      }
    });

    // Garante que novas categorias customizadas apareçam
    (customCategories || []).forEach(c => {
      if (!hiddenSet.has(c.id) && !result.some(t => t.id === c.id)) {
        result.push(customTabsMap[c.id]);
      }
    });

    return result;
  }, [categoriesConfig, customCategories, isAdultUnlocked]);

  const renderSeriesContent = () => {
    if (!activeSeriesData) return null;

    const currentSeasonKey = activeSeriesData.selectedSeason || '1';
    const epList = activeSeriesData.episodesBySeason?.[currentSeasonKey] || [];
    const seasonsList = activeSeriesData.seasons || [];
    const meta = activeSeriesData.meta || {};
    const seriesTitle = meta.name || activeSeriesData.series?.name || 'Série';
    const seriesCover = meta.cover || activeSeriesData.series?.logo || '';

    return (
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 14px 20px',
        overflow: 'hidden'
      }}>
        {/* BOTÃO DESTACADO: Sair dos Episódios / Voltar às Séries */}
        <button
          onClick={onExitSeriesMode}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-accent)',
            color: 'var(--accent-primary)',
            fontWeight: '800',
            fontSize: '12px',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '12px',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-primary)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent-subtle)';
            e.currentTarget.style.color = 'var(--accent-primary)';
          }}
          title="Voltar ao catálogo de séries"
        >
          <ArrowLeft size={16} />
          <span>Voltar para o Catálogo de Séries</span>
        </button>

        {/* CARD DA SÉRIE ATIVA */}
        <div style={{
          padding: '10px 12px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid var(--border-accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
          flexShrink: 0
        }}>
          {seriesCover ? (
            <img 
              src={seriesCover} 
              alt="Capa"
              style={{
                width: '38px',
                height: '52px',
                objectFit: 'cover',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                flexShrink: 0
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : null}
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{
              fontSize: '9px',
              fontWeight: '800',
              color: 'var(--accent-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block'
            }}>
              SÉRIE EM REPRODUÇÃO
            </span>
            <h3 style={{
              fontSize: '13px',
              fontWeight: '800',
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '1px'
            }}>
              {seriesTitle}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '11px', color: '#94a3b8' }}>
              <Layers size={11} color="var(--accent-primary)" />
              <span>{seasonsList.length} {seasonsList.length === 1 ? 'Temporada' : 'Temporadas'}</span>
            </div>
          </div>
        </div>

        {/* SELETOR DE TEMPORADAS HORIZONTAL */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          scrollbarWidth: 'none',
          flexShrink: 0,
          marginBottom: '6px'
        }}>
          {seasonsList.map(s => {
            const sNumStr = s.seasonNumber.toString();
            const isSelected = currentSeasonKey === sNumStr;
            return (
              <button
                key={s.seasonNumber}
                onClick={() => onSelectSeriesSeason && onSelectSeriesSeason(sNumStr)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: isSelected ? '800' : '600',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? 'var(--accent-primary)' : '#94a3b8',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Temporada {s.seasonNumber}</span>
                <span style={{
                  fontSize: '9px',
                  marginLeft: '5px',
                  opacity: 0.8,
                  background: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.3)',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  {s.episodeCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* LISTA VERTICAL DE EPISÓDIOS COM ROLAGEM */}
        <div 
          className="visible-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            paddingRight: '2px'
          }}
        >
          {epList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '12px' }}>
              Nenhum episódio encontrado nesta temporada.
            </div>
          ) : (
            epList.map((ep, idx) => {
              const isCurrentEp = selectedChannel?.id === ep.id || selectedChannel?.url === ep.url;
              return (
                <div
                  key={ep.id || idx}
                  onClick={() => onSelectChannel(ep)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isCurrentEp 
                      ? 'var(--accent-subtle)' 
                      : 'rgba(255, 255, 255, 0.02)',
                    border: isCurrentEp 
                      ? '1px solid var(--accent-primary)' 
                      : '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentEp) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentEp) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                    {/* Miniatura Widescreen do Episódio */}
                    <div style={{
                      width: '52px',
                      height: '32px',
                      borderRadius: '5px',
                      overflow: 'hidden',
                      position: 'relative',
                      background: '#07090e',
                      flexShrink: 0
                    }}>
                      {ep.image ? (
                        <img 
                          src={ep.image} 
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            if (!e.target.dataset.triedProxy && ep.image.startsWith('http')) {
                              e.target.dataset.triedProxy = 'true';
                              e.target.src = `/api/image-cache?url=${encodeURIComponent(ep.image)}`;
                            } else {
                              e.target.style.display = 'none';
                            }
                          }}
                        />
                      ) : null}

                      {/* Overlay com número do episódio ou play */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: isCurrentEp ? 'var(--accent-primary)' : 'rgba(0, 0, 0, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isCurrentEp ? 'var(--text-on-accent)' : '#ffffff',
                        fontSize: '9px',
                        fontWeight: '800'
                      }}>
                        {isCurrentEp ? <Play size={12} fill="var(--text-on-accent)" color="var(--text-on-accent)" /> : `E${ep.episodeNum || idx + 1}`}
                      </div>

                      {/* Barrinha Vermelha Estilo Netflix */}
                      <NetflixProgressBar progress={getProgress(ep)} height={3} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: isCurrentEp ? '700' : '600',
                        color: isCurrentEp ? 'var(--accent-primary)' : '#f1f5f9',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {ep.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        {isCurrentEp && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: '800',
                            color: 'var(--accent-primary)',
                            background: 'var(--accent-subtle)',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            REPRODUZINDO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <aside 
      className="sidebar-container"
      style={{
        width: '340px',
        minWidth: '340px',
        maxWidth: '340px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRadius: '18px',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.08)',
        zIndex: 30,
        userSelect: 'none',
        overflow: 'hidden',
        position: 'relative'
      }}>
      {/* 1. Cabeçalho da Sidebar: Logo + Ao Vivo Dot + Ações Rápidas */}
      <div 
        className="app-drag-region"
        style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        {/* Ícone da TV + Botão do Perfil Ativo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Tv size={20} color="var(--text-on-accent)" strokeWidth={2.5} />
          </div>

          {/* Botão do Perfil com Dropdown Indicator */}
          <button
            onClick={onOpenPlaylistModal}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: '8px',
              textAlign: 'left',
              minWidth: 0,
              maxWidth: '180px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Clique para alternar de perfil ou gerenciar listas"
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '800',
                  color: '#ffffff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {selectedPlaylist ? selectedPlaylist.name : 'Conectar Perfil'}
                </span>
                <ChevronDown size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              </div>
              <div style={{
                fontSize: '10px',
                fontWeight: '700',
                color: 'var(--accent-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '1px'
              }}>
                <span className="animate-pulse-dot" style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  flexShrink: 0
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedPlaylist ? (selectedPlaylist.type === 'xtream' ? 'XTREAM CODES' : 'LISTA M3U') : 'OFFLINE'}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Botões de Ação Rápida */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Botão de Troca Rápida de Paleta do Aplicativo (1-Click) */}
          <button
            onClick={() => {
              if (onChangeAppTheme) {
                const themes = ['slate', 'cinema', 'amber', 'blackout', 'amethyst', 'emerald'];
                const nextIdx = (themes.indexOf(appTheme) + 1) % themes.length;
                onChangeAppTheme(themes[nextIdx]);
              }
            }}
            title={`Mudar Tema do App (${
              appTheme === 'cinema' ? 'Preto OLED & Vermelho' :
              appTheme === 'amber' ? 'Grafite & Âmbar' :
              appTheme === 'blackout' ? 'Blackout AMOLED 100%' :
              appTheme === 'amethyst' ? 'Ametista & Violeta' :
              appTheme === 'emerald' ? 'Verde Jade & Esmeralda' :
              'Cinza Ônix & Azul'
            })`}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--border-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              cursor: 'pointer'
            }}
          >
            <Palette size={15} />
          </button>

          <button
            onClick={onOpenPlaylistModal}
            title={selectedPlaylist ? `Lista: ${selectedPlaylist.name}` : 'Conectar Lista'}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            <PlusCircle size={15} color="var(--accent-primary)" />
          </button>
          <button
            onClick={onOpenSettingsModal}
            title="Configurações do Aplicativo"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8'
            }}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 2. Campo de Busca Rápido com Modal de Pesquisas Recentes */}
      <div 
        ref={searchBoxRef}
        style={{ padding: '10px 18px 8px', flexShrink: 0, position: 'relative', zIndex: 60 }}
      >
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: isRecentOpen ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.8)',
          border: isRecentOpen ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isRecentOpen ? '0 0 16px rgba(56, 189, 248, 0.2)' : 'none',
          borderRadius: '10px',
          padding: '0 12px',
          transition: 'all 0.2s ease'
        }}>
          <Search size={15} color={isRecentOpen ? "#38bdf8" : "#64748b"} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onFocus={() => {
              if (recentSearches.length > 0) setIsRecentOpen(true);
            }}
            onClick={() => {
              if (recentSearches.length > 0) setIsRecentOpen(true);
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isRecentOpen && recentSearches.length > 0) setIsRecentOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                saveRecentSearch(searchQuery.trim());
                setIsRecentOpen(false);
                searchInputRef.current?.blur();
              } else if (e.key === 'Escape') {
                setIsRecentOpen(false);
                searchInputRef.current?.blur();
              }
            }}
            placeholder={isVodTab ? "Buscar título..." : "Buscar canais..."}
            style={{
              width: '100%',
              padding: '8px 8px',
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px 4px'
              }}
              title="Limpar busca"
            >
              ✕
            </button>
          ) : (
            <div style={{
              fontSize: '10px',
              fontWeight: '700',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              padding: '2px 5px',
              borderRadius: '4px',
              letterSpacing: '0.5px'
            }}>
              Ctrl+K
            </div>
          )}
        </div>

        {/* Modal Dropdown de Pesquisas Recentes */}
        {isRecentOpen && recentSearches.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% - 2px)',
            left: '18px',
            right: '18px',
            background: '#0d131f',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '12px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(56, 189, 248, 0.2)',
            padding: '8px',
            zIndex: 9999,
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px 8px 8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '6px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: '700',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.6px'
              }}>
                <Clock size={13} color="#38bdf8" />
                <span>Pesquisas Recentes</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearRecentSearches();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: 0.85
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.85'}
                title="Limpar todo o histórico de pesquisas"
              >
                <Trash2 size={11} />
                <span>Limpar</span>
              </button>
            </div>

            {recentSearches
              .filter(term => !searchQuery.trim() || term.toLowerCase().includes(searchQuery.toLowerCase().trim()))
              .map((term, idx) => (
                <div
                  key={`${term}-${idx}`}
                  onClick={() => {
                    setSearchQuery(term);
                    saveRecentSearch(term);
                    setIsRecentOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.14)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#e2e8f0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <History size={13} color="#64748b" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {term}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentSearch(term);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.7,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#ef4444';
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title="Remover termo"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Se estiver no modo série, renderiza os episódios e temporadas. Senão, renderiza navegação normal */}
      {activeSeriesData ? (
        renderSeriesContent()
      ) : (
        <>
          {/* 3. Abas de Navegação Rápida (Reordenáveis & Dinâmicas) */}
          <div style={{
            padding: '0 16px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexShrink: 0
          }}>
            {navigationTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isAdultTab = tab.isAdult;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (isAdultTab && !isAdultUnlocked) {
                      if (onRequestUnlockAdult) onRequestUnlockAdult();
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: isActive ? '700' : '500',
                    color: isAdultTab 
                      ? (isActive ? '#f43f5e' : '#ef4444') 
                      : (isActive ? '#ffffff' : 'var(--text-muted)'),
                    background: isActive 
                      ? (isAdultTab ? 'rgba(239, 68, 68, 0.22)' : 'var(--accent-subtle)') 
                      : (isAdultTab ? 'rgba(239, 68, 68, 0.08)' : 'transparent'),
                    border: isActive 
                      ? (isAdultTab ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-accent)') 
                      : (isAdultTab ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent'),
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease'
                  }}
                  title={isAdultTab && !isAdultUnlocked ? 'Conteúdo protegido por senha (Padrão: 0000)' : tab.label}
                >
                  <Icon size={13} color={isAdultTab ? '#ef4444' : (isActive ? 'var(--accent-primary)' : 'var(--text-muted)')} />
                  <span>{tab.label}</span>
                  {isAdultTab && (
                    <span style={{
                      fontSize: '9px',
                      fontWeight: '800',
                      color: '#ef4444',
                      background: 'rgba(239, 68, 68, 0.2)',
                      padding: '1px 4px',
                      borderRadius: '4px',
                      marginLeft: '1px'
                    }}>
                      +18
                    </span>
                  )}
                  {tab.isCustom && (
                    <span style={{
                      fontSize: '8px',
                      fontWeight: '800',
                      color: 'var(--accent-primary)',
                      background: 'var(--accent-subtle)',
                      padding: '1px 3px',
                      borderRadius: '3px',
                      marginLeft: '1px'
                    }}>
                      ★
                    </span>
                  )}
                </button>
              );
            })}

            {/* Atalho para Organizar Posições e Criar Novas Categorias */}
            {onOpenCategoryManager && (
              <button
                onClick={onOpenCategoryManager}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                title="Organizar Posição das Categorias & Criar Novas"
              >
                <SlidersHorizontal size={13} />
              </button>
            )}
          </div>

      {/* 4. Lista de Categorias na Sidebar (Tanto para TV quanto para Filmes e Séries) */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '10px 12px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        {/* Título de seção */}
        <div style={{
          padding: '4px 6px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          fontWeight: '700',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          flexShrink: 0
        }}>
          <span style={{ fontWeight: '800', color: '#f8fafc', letterSpacing: '0.4px', fontSize: '11px' }}>
            {activeTab === 'adult' 
              ? 'Categorias Adulto (+18)' 
              : activeTab === 'history'
                ? 'Histórico Recente'
                : isVodTab 
                  ? (activeTab === 'movies' ? 'Gêneros de Filmes' : 'Gêneros de Séries') 
                  : 'Categorias de Canais'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Seletor de Modo Grid / Lista (exclusivo para Filmes e Séries) */}
            {isVodTab && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '2px',
                gap: '2px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <button
                  type="button"
                  onClick={() => handleSetVodViewMode('grid')}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '6px',
                    background: vodViewMode === 'grid' ? 'var(--accent-primary)' : 'transparent',
                    color: vodViewMode === 'grid' ? 'var(--text-on-accent)' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  title="Exibir em Grid (3 Colunas)"
                >
                  <LayoutGrid size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSetVodViewMode('list')}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '6px',
                    background: vodViewMode === 'list' ? 'var(--accent-primary)' : 'transparent',
                    color: vodViewMode === 'list' ? 'var(--text-on-accent)' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  title="Exibir em Lista"
                >
                  <List size={12} />
                </button>
              </div>
            )}

            {activeTab === 'adult' && onLockAdult && (
              <button
                onClick={onLockAdult}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  color: '#ef4444',
                  fontSize: '10px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                title="Bloquear categoria adulto e voltar aos canais normais"
              >
                <Lock size={11} />
                <span>Bloquear</span>
              </button>
            )}
            {activeTab === 'history' && onClearHistory && (history || []).length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Tem certeza que deseja limpar todo o seu histórico de reprodução?')) {
                    onClearHistory();
                  }
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  color: '#ef4444',
                  fontSize: '10px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="Limpar histórico de reprodução"
              >
                <Trash2 size={11} />
                <span>Limpar</span>
              </button>
            )}
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8' }}>{categories.length}</span>
          </div>
        </div>

        {categories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b', flexShrink: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>Nenhuma categoria</p>
            <p style={{ fontSize: '11px', marginTop: '4px' }}>Conecte uma lista no botão acima para carregar.</p>
          </div>
        ) : isVodTab && vodViewMode === 'grid' ? (
          /* ========================================================
             🎬 GRID VISUAL DE CATEGORIAS (FILMES & SÉRIES - 3 COLUNAS)
             ======================================================== */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            padding: '4px 0 24px 0',
            width: '100%'
          }}>
            {categories.map((cat, idx) => {
              const catName = typeof cat === 'string' ? cat : (cat.name || 'Geral');
              const catId = typeof cat === 'object' && cat.id ? cat.id : catName;
              const cleanName = cleanGenreName(catName);

              // Valida se esta categoria é a selecionada no momento
              const selectedCatName = typeof selectedCategory === 'object' 
                ? (selectedCategory?.name || 'Geral')
                : (selectedCategory || '');
              const selectedCatId = typeof selectedCategory === 'object' && selectedCategory?.id 
                ? selectedCategory.id 
                : null;

              const isCurrentSelected = selectedCatId && catId 
                ? selectedCatId.toString() === catId.toString() 
                : selectedCatName.trim().toLowerCase() === catName.trim().toLowerCase();

              const bgImage = getCategoryCover(cat);
              const previewList = (cat && Array.isArray(cat.previewImages) && cat.previewImages.length > 0)
                ? cat.previewImages
                : [];

              return (
                <div
                  key={idx}
                  onClick={() => handleCategoryClick(cat)}
                  className={`genre-card ${isCurrentSelected ? 'is-active' : ''}`}
                  style={{
                    position: 'relative',
                    aspectRatio: '3 / 4',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: isCurrentSelected ? '1.5px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: isCurrentSelected 
                      ? '0 0 16px var(--accent-subtle), 0 4px 14px rgba(0, 0, 0, 0.7)' 
                      : '0 4px 12px rgba(0, 0, 0, 0.4)',
                    transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: '#121620'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                    const img = e.currentTarget.querySelector('img');
                    if (img) img.style.transform = 'scale(1.08)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                    const img = e.currentTarget.querySelector('img');
                    if (img) img.style.transform = 'scale(1)';
                  }}
                >
                  {/* Capa Real da Categoria com Rotação das 3 Imagens em Dias Ímpares */}
                  <img
                    src={bgImage}
                    alt={cleanName}
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      if (previewList.length > 1) {
                        const currentSrc = e.currentTarget.src;
                        const altImg = previewList.find(img => img && img !== currentSrc);
                        if (altImg) {
                          e.currentTarget.src = altImg;
                          return;
                        }
                      }
                      e.currentTarget.src = getGenreImage(catName);
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                  />

                  {/* Gradiente Forte para Contraste e Legibilidade do Texto */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.4) 45%, rgba(0, 0, 0, 0.95) 100%)',
                      pointerEvents: 'none'
                    }}
                  />

                  {/* Badge "ATIVO" no topo esquerdo do card quando selecionado */}
                  {isCurrentSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        background: 'var(--accent-primary)',
                        color: 'var(--text-on-accent)',
                        fontSize: '8.5px',
                        fontWeight: '900',
                        letterSpacing: '0.6px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
                        zIndex: 2
                      }}
                    >
                      ATIVO
                    </div>
                  )}

                  {/* Conteúdo na base do card */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      right: '8px',
                      zIndex: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      pointerEvents: 'none'
                    }}
                  >
                    {/* Subtítulo "■ GÊNERO" */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '1.5px',
                          background: 'var(--accent-primary)',
                          display: 'inline-block',
                          flexShrink: 0
                        }}
                      />
                      <span
                        style={{
                          fontSize: '8px',
                          fontWeight: '800',
                          color: 'var(--accent-bright)',
                          letterSpacing: '0.8px',
                          textTransform: 'uppercase'
                        }}
                      >
                        GÊNERO
                      </span>
                    </div>

                    {/* Nome do Gênero */}
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#ffffff',
                        letterSpacing: '-0.2px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)'
                      }}
                      title={cleanName}
                    >
                      {cleanName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Modo Lista (ou Canais Ao Vivo) */
          categories.map((cat, idx) => {
            const catName = typeof cat === 'string' ? cat : (cat.name || 'Geral');
            const catId = typeof cat === 'object' && cat.id ? cat.id : catName;
            const catCount = typeof cat === 'object' && cat.count ? cat.count : null;
            
            // Para VOD, checa se é a categoria selecionada por nome ou ID
            const selectedCatName = typeof selectedCategory === 'object' 
              ? (selectedCategory?.name || 'Geral')
              : (selectedCategory || '');
            const selectedCatId = typeof selectedCategory === 'object' && selectedCategory?.id 
              ? selectedCategory.id 
              : null;

            const isCurrentSelected = selectedCatId && catId 
              ? selectedCatId.toString() === catId.toString() 
              : selectedCatName.trim().toLowerCase() === catName.trim().toLowerCase();
            
            const isExpanded = !isVodTab && (expandedCategory === catName || categories.length === 1);

            // Validação estrita: os canais em memória pertencem de fato a esta categoria específica?
            const isChannelsForThisCategory = 
              Boolean(loadedCategory) && 
              (loadedCategory.trim().toLowerCase() === catName.trim().toLowerCase() ||
               loadedCategory.toString() === catId.toString());

            // Se o acordeão está expandido mas os canais em memória não pertencem a ele ou ainda estão carregando:
            const isWaitingThisCategory = isExpanded && (!isChannelsForThisCategory || isLoadingChannels);

            // MODO VOD EM LISTA: Item de seleção direta na Sidebar
            if (isVodTab) {
              return (
                <div
                  key={idx}
                  onClick={() => handleCategoryClick(cat)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    flexShrink: 0,
                    minHeight: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isCurrentSelected 
                      ? 'var(--accent-subtle)' 
                      : 'rgba(255, 255, 255, 0.02)',
                    border: isCurrentSelected 
                      ? '1px solid var(--border-accent)' 
                      : '1px solid transparent',
                    boxShadow: 'none',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <FolderOpen size={15} color={isCurrentSelected ? 'var(--accent-primary)' : '#64748b'} />
                    <span style={{
                      fontSize: '12px',
                      fontWeight: isCurrentSelected ? '700' : '500',
                      color: isCurrentSelected ? '#ffffff' : '#cbd5e1',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }}>
                      {catName}
                    </span>
                  </div>

                  {catCount !== null && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      background: isCurrentSelected ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.05)',
                      color: isCurrentSelected ? 'var(--accent-primary)' : '#64748b'
                    }}>
                      {catCount}
                    </span>
                  )}
                </div>
              );
            }

            // MODO CANAIS AO VIVO: Acordeão expansível com canais dentro
            return (
              <div key={idx} style={{
                borderRadius: '10px',
                overflow: 'hidden',
                flexShrink: 0,
                background: isExpanded ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.02)',
                border: isExpanded ? '1px solid var(--border-accent)' : '1px solid rgba(255, 255, 255, 0.04)',
                transition: 'all 0.2s ease'
              }}>
                {/* Header do Acordeão */}
                <div
                  onClick={() => handleCategoryClick(cat)}
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isCurrentSelected ? 'var(--accent-subtle)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {isExpanded ? (
                      <ChevronDown size={15} color="var(--accent-primary)" />
                    ) : (
                      <ChevronRight size={15} color="#64748b" />
                    )}
                    <span style={{
                      fontSize: '12px',
                      fontWeight: isExpanded ? '700' : '600',
                      color: isExpanded ? 'var(--accent-primary)' : '#f1f5f9',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }}>
                      {catName}
                    </span>
                  </div>

                  {catCount !== null && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      background: isExpanded ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.05)',
                      color: isExpanded ? 'var(--accent-primary)' : '#64748b'
                    }}>
                      {catCount}
                    </span>
                  )}
                </div>

                {/* Canais dentro da Categoria */}
                {isExpanded && (
                  <div style={{
                    padding: '4px 8px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)'
                  }}>
                    {isWaitingThisCategory ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', gap: '8px', color: '#94a3b8' }}>
                        <Loader2 size={16} color="var(--accent-primary)" className="animate-spin" />
                        <span style={{ fontSize: '11px' }}>Carregando canais...</span>
                      </div>
                    ) : filteredChannels.length === 0 ? (
                      <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                        Nenhum canal nesta categoria.
                      </div>
                    ) : (
                      filteredChannels.map((channel, cIdx) => {
                        const isChannelPlaying = selectedChannel?.id === channel.id || selectedChannel?.url === channel.url;
                        const fav = isFav(channel);
                        const qualityBadge = channel.currentQuality || getQualityBadge(channel.name || channel.title);
                        const hasMultipleQualities = channel.sources && channel.sources.length > 1;
                        const itemLogo = channel.logo || channel.image || channel.cover || channel.stream_icon;
                        const itemType = channel.type || (activeTab === 'movies' ? 'movie' : activeTab === 'series' ? 'series' : 'live');
                        const isVodItem = itemType === 'movie' || itemType === 'series';
                        const isMovieItem = itemType === 'movie';
                        const isSeriesItem = itemType === 'series';
                        const displayName = channel.name || channel.title || 'Mídia';

                        return (
                          <div
                            key={channel.id || cIdx}
                            onClick={() => {
                              if (channel.type === 'series' && onPlaySeries) {
                                onPlaySeries(channel);
                              } else {
                                onSelectChannel(channel);
                              }
                            }}
                            className={`sidebar-channel-item ${isChannelPlaying ? 'is-active' : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              background: isChannelPlaying
                                ? 'var(--accent-subtle)'
                                : 'rgba(15, 23, 42, 0.5)',
                              border: isChannelPlaying
                                ? '1px solid var(--border-accent)'
                                : '1px solid transparent',
                              boxShadow: 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                              <div style={{
                                width: isVodItem ? '28px' : '32px',
                                height: isVodItem ? '38px' : '32px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                position: 'relative',
                                background: 'rgba(0, 0, 0, 0.5)',
                                flexShrink: 0
                              }}>
                                {itemLogo ? (
                                  <img
                                    src={itemLogo}
                                    alt={displayName}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: isVodItem ? 'cover' : 'contain',
                                      padding: isVodItem ? '0' : '2px',
                                      display: 'block'
                                    }}
                                  />
                                ) : (
                                  <div style={{
                                    width: '100%',
                                    height: '100%',
                                    background: isChannelPlaying ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: '800',
                                    color: isChannelPlaying ? 'var(--text-on-accent)' : '#ffffff'
                                  }}>
                                    {displayName.charAt(0)}
                                  </div>
                                )}

                                {/* Barrinha Vermelha Estilo Netflix (se for VOD e >= 30s) */}
                                {isVodItem && <NetflixProgressBar progress={getProgress(channel)} height={3} />}
                              </div>

                              <div style={{ overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{
                                    fontSize: '12px',
                                    fontWeight: isChannelPlaying ? '700' : '600',
                                    color: isChannelPlaying ? 'var(--accent-primary)' : '#f8fafc',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden'
                                  }}>
                                    {displayName}
                                  </span>

                                  {isMovieItem ? (
                                    <span style={{
                                      fontSize: '9px',
                                      fontWeight: '800',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: 'rgba(168, 85, 247, 0.2)',
                                      color: '#c084fc',
                                      border: '1px solid rgba(168, 85, 247, 0.4)',
                                      flexShrink: 0
                                    }}>
                                      FILME
                                    </span>
                                  ) : isSeriesItem ? (
                                    <span style={{
                                      fontSize: '9px',
                                      fontWeight: '800',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: 'rgba(99, 102, 241, 0.2)',
                                      color: '#a5b4fc',
                                      border: '1px solid rgba(99, 102, 241, 0.4)',
                                      flexShrink: 0
                                    }}>
                                      SÉRIE
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '9px',
                                      fontWeight: '800',
                                      padding: '1px 4px',
                                      borderRadius: '4px',
                                      background: qualityBadge === '4K' ? 'rgba(245, 158, 11, 0.2)' : 'var(--accent-subtle)',
                                      color: qualityBadge === '4K' ? '#fbbf24' : 'var(--accent-primary)',
                                      border: qualityBadge === '4K' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-accent)',
                                      flexShrink: 0
                                    }}>
                                      {qualityBadge}
                                    </span>
                                  )}

                                  {hasMultipleQualities && (
                                    <span style={{
                                      fontSize: '8px',
                                      fontWeight: '700',
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      background: 'rgba(99, 102, 241, 0.2)',
                                      color: '#a5b4fc',
                                      border: '1px solid rgba(99, 102, 241, 0.4)',
                                      flexShrink: 0
                                    }} title={`${channel.sources.length} qualidades disponíveis (4K, FHD, HD, SD)`}>
                                      {channel.sources.length}Q
                                    </span>
                                  )}
                                </div>

                                <div style={{
                                  fontSize: '10px',
                                  color: '#64748b',
                                  whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  marginTop: '1px'
                                }}>
                                  {channel.watchedAt ? formatWatchedAt(channel.watchedAt) : (channel.category || (isMovieItem ? 'Filme' : isSeriesItem ? 'Série' : 'Programação Ao Vivo'))}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              {activeTab === 'history' && onRemoveFromHistory && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveFromHistory(channel);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#64748b',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'color 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                                  title="Remover este item do histórico"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFavorite(channel);
                                }}
                                className={`channel-fav-btn ${fav ? 'active' : ''}`}
                                style={{
                                  background: 'transparent',
                                  color: fav ? '#f59e0b' : '#64748b',
                                  padding: '4px'
                                }}
                                title={fav ? 'Remover dos favoritos' : 'Favoritar'}
                              >
                                <Star size={14} fill={fav ? '#f59e0b' : 'none'} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
        </>
      )}
    </aside>
  );
}
