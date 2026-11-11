import React, { useState, useEffect, useRef } from 'react';
import { 
  Film, 
  Clapperboard, 
  Star, 
  Play, 
  Search, 
  Loader2, 
  X, 
  FolderOpen, 
  Layers, 
  ChevronDown, 
  ChevronUp,
  Clock,
  Trash2,
  History
} from 'lucide-react';
import { PosterImage } from './PosterImage';
import { useVodProgress, NetflixProgressBar } from '../utils/vodProgress';
import { 
  getRecentSearches, 
  saveRecentSearch, 
  removeRecentSearch, 
  clearRecentSearches, 
  RECENT_SEARCHES_EVENT 
} from '../utils/recentSearches';
import { isAdultContent } from '../utils/adultFilter';

export function VodView({ 
  type = 'movies', 
  playlist, 
  onPlayItem, 
  searchQuery = '',
  selectedCategory,
  isAdultUnlocked = false
}) {
  const { getProgress } = useVodProgress();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [recentSearches, setRecentSearches] = useState(getRecentSearches);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const onRecentUpdated = (e) => {
      if (e.detail) setRecentSearches(e.detail);
    };
    window.addEventListener(RECENT_SEARCHES_EVENT, onRecentUpdated);

    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsRecentOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener(RECENT_SEARCHES_EVENT, onRecentUpdated);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Títulos encontrados em outros grupos ao pesquisar no grupo
  const [otherGroupItems, setOtherGroupItems] = useState([]);
  const [totalOthers, setTotalOthers] = useState(0);
  const [isLoadingOthers, setIsLoadingOthers] = useState(false);
  const [isOthersExpanded, setIsOthersExpanded] = useState(true);

  const scrollContainerRef = useRef(null);
  const activeOtherSearchRef = useRef(0);
  const activeRequestRef = useRef(0);
  const vodCacheRef = useRef({});
  const prevSearchRef = useRef('');

  // Obtém o ID e o Nome da categoria selecionada
  const categoryName = typeof selectedCategory === 'object' 
    ? (selectedCategory?.name || selectedCategory?.category_name || '')
    : (selectedCategory || '');

  const catId = typeof selectedCategory === 'object' 
    ? (selectedCategory?.id || selectedCategory?.category_id || selectedCategory?.name || '')
    : (selectedCategory || '');

  // 1. Carrega itens sempre que a categoria selecionada na Sidebar mudar (com cache e descarte de concorrência)
  useEffect(() => {
    const effectiveId = catId || categoryName;
    if (!playlist || !effectiveId) {
      setIsLoading(true);
      return;
    }

    setOtherGroupItems([]);
    setTotalOthers(0);
    setGroupSearch('');
    prevSearchRef.current = '';

    const cacheKey = `${playlist.id}_${type}_${effectiveId}`;
    if (vodCacheRef.current[cacheKey]) {
      const cached = vodCacheRef.current[cacheKey];
      setItems(cached.items);
      setTotal(cached.total);
      setPage(1);
      setTotalPages(cached.totalPages || 1);
      setIsLoading(false);
      return;
    }

    setItems([]);
    loadCategoryItems(effectiveId, 1, false, '', categoryName);
  }, [type, playlist?.id, catId, categoryName]);

  // 2. Filtro de pesquisa específico do grupo em tempo real com debounce
  // Dispara a busca no grupo atual e expande buscando em outros grupos SOMENTE quando o usuário digita
  useEffect(() => {
    if (groupSearch === prevSearchRef.current) return;
    prevSearchRef.current = groupSearch;

    const timer = setTimeout(() => {
      const term = groupSearch.trim();
      const effectiveId = catId || categoryName;
      if (effectiveId) {
        loadCategoryItems(effectiveId, 1, false, term, categoryName);
      }
      if (term) {
        loadOtherGroupItems(term, effectiveId, categoryName);
      } else {
        setOtherGroupItems([]);
        setTotalOthers(0);
        setIsLoadingOthers(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [groupSearch]);

  // 3. Carrega itens do grupo atual com paginação segura (40 por vez) e proteção contra corrida assíncrona
  const loadCategoryItems = async (targetCatId, pageNum = 1, append = false, searchTxt = '', catName = '') => {
    if (!playlist || !targetCatId) return;

    const requestId = ++activeRequestRef.current;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const endpoint = type === 'movies' ? `/api/xtream/${playlist.id}/vod` : `/api/xtream/${playlist.id}/series`;
      const effectiveSearch = (searchTxt || searchQuery || '').trim();
      const currentCatName = catName || categoryName;

      const params = new URLSearchParams({
        category_id: targetCatId.toString(),
        category: currentCatName,
        page: pageNum.toString(),
        limit: '40',
        include_adult: isAdultUnlocked ? 'true' : 'false'
      });
      if (effectiveSearch) {
        params.append('search', effectiveSearch);
      }

      const res = await fetch(`${endpoint}?${params.toString()}`);
      const data = await res.json();

      // Se outra requisição mais nova foi disparada enquanto essa estava em trânsito, descarta a resposta antiga
      if (activeRequestRef.current !== requestId) return;

      let newItems = type === 'movies' ? (data.movies || []) : (data.series || []);
      if (!isAdultUnlocked) {
        newItems = newItems.filter(i => !isAdultContent(i.name, i.category || currentCatName));
      }

      const totalCount = data.total || 0;
      const pagesCount = data.totalPages || 1;

      if (append) {
        setItems(prev => [...prev, ...newItems]);
      } else {
        setItems(newItems);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }

        // Armazena no cache da sessão para acesso instantâneo
        if (!effectiveSearch && pageNum === 1) {
          const cacheKey = `${playlist.id}_${type}_${targetCatId}`;
          vodCacheRef.current[cacheKey] = {
            items: newItems,
            total: totalCount,
            totalPages: pagesCount
          };
        }
      }

      setTotal(totalCount);
      setPage(pageNum);
      setTotalPages(pagesCount);
    } catch (err) {
      if (activeRequestRef.current === requestId) {
        console.error('Erro ao carregar itens VOD:', err);
      }
    } finally {
      if (activeRequestRef.current === requestId) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  // 4. Carrega títulos encontrados em outros grupos para expandir abaixo do grupo atual
  const loadOtherGroupItems = async (searchTxt, currentCatId, currentCatName) => {
    if (!playlist || !searchTxt.trim()) {
      setOtherGroupItems([]);
      setTotalOthers(0);
      setIsLoadingOthers(false);
      return;
    }

    const requestId = ++activeOtherSearchRef.current;
    setIsLoadingOthers(true);

    try {
      const endpoint = type === 'movies' 
        ? `/api/xtream/${playlist.id}/vod/search-others` 
        : `/api/xtream/${playlist.id}/series/search-others`;

      const params = new URLSearchParams({
        search: searchTxt.trim(),
        exclude_category_id: (currentCatId || '').toString(),
        exclude_category: currentCatName || '',
        limit: '80',
        include_adult: isAdultUnlocked ? 'true' : 'false'
      });

      const res = await fetch(`${endpoint}?${params.toString()}`);
      const data = await res.json();

      if (activeOtherSearchRef.current !== requestId) return;

      let fetchedItems = data.items || [];
      if (!isAdultUnlocked) {
        fetchedItems = fetchedItems.filter(i => !isAdultContent(i.name, i.category));
      }

      setOtherGroupItems(fetchedItems);
      setTotalOthers(fetchedItems.length);
    } catch (err) {
      if (activeOtherSearchRef.current === requestId) {
        console.error('Erro ao buscar títulos em outros grupos:', err);
        setOtherGroupItems([]);
        setTotalOthers(0);
      }
    } finally {
      if (activeOtherSearchRef.current === requestId) {
        setIsLoadingOthers(false);
      }
    }
  };

  // 5. Scroll Infinito Automático (para o grupo atual)
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 350) {
      if (page < totalPages && !isLoadingMore && !isLoading && catId) {
        loadCategoryItems(catId, page + 1, true, groupSearch, categoryName);
      }
    }
  };

  const isSearching = Boolean(groupSearch.trim());

  // Componente de Card de Título (Filme ou Série)
  const renderCard = (item, isOtherGroup = false) => {
    // Bloqueio Parental Rigoroso: nunca renderiza itens adultos quando bloqueado
    if (!isAdultUnlocked && isAdultContent(item.name, item.category)) {
      return null;
    }

    const isSeries = type === 'series' || item.type === 'series';
    const groupBadge = item.category || (isOtherGroup ? 'Outro Grupo' : categoryName);

    // Validação estrita da nota: oculta quando for 0, 0.0 ou vazia
    const rawRating = item.rating;
    const parsedRating = typeof rawRating === 'number'
      ? rawRating
      : parseFloat(String(rawRating || '').replace(',', '.'));
    const hasValidRating = !isNaN(parsedRating) && parsedRating > 0;

    return (
      <div
        key={`${isOtherGroup ? 'other_' : 'curr_'}${item.id || item.streamId || item.seriesId}`}
        onClick={() => {
          const currentQuery = groupSearch.trim();
          if (currentQuery) {
            saveRecentSearch(currentQuery);
          }
          setIsRecentOpen(false);
          onPlayItem(item, currentQuery);
        }}
        style={{
          borderRadius: '14px',
          overflow: 'hidden',
          background: '#090d18',
          border: isOtherGroup ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          aspectRatio: '2 / 3',
          minHeight: '260px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-6px)';
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
          e.currentTarget.style.boxShadow = '0 16px 36px rgba(0, 0, 0, 0.8), 0 0 20px var(--accent-subtle)';
          const playOverlay = e.currentTarget.querySelector('.card-play-overlay');
          if (playOverlay) playOverlay.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = isOtherGroup ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.55)';
          const playOverlay = e.currentTarget.querySelector('.card-play-overlay');
          if (playOverlay) playOverlay.style.opacity = '0';
        }}
      >
        {/* Pôster 100% da área do card */}
        <div style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}>
          <PosterImage
            src={item.logo || item.cover || item.stream_icon}
            alt={item.name}
          />
        </div>

        {/* Sombra Desvanecente Cinematográfica (Degradê suave na base para leitura do texto) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(5, 8, 15, 0.95) 0%, rgba(5, 8, 15, 0.82) 18%, rgba(5, 8, 15, 0.25) 32%, transparent 44%)',
          pointerEvents: 'none',
          zIndex: 2
        }} />

        {/* Badge do Nome do Grupo (para títulos de outros grupos na busca global) */}
        {isOtherGroup && (
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: 'rgba(11, 17, 29, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            padding: '3px 8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            fontWeight: '700',
            color: 'var(--accent-bright)',
            backdropFilter: 'blur(8px)',
            zIndex: 5,
            maxWidth: '120px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)'
          }} title={`Grupo: ${groupBadge}`}>
            <FolderOpen size={10} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{groupBadge}</span>
          </div>
        )}

        {/* Badge de Nota Elegante (Apenas quando a nota for válida e maior que 0) */}
        {hasValidRating && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(11, 16, 26, 0.82)',
            backdropFilter: 'blur(10px)',
            padding: '3px 7px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10.5px',
            fontWeight: '800',
            color: '#f8fafc',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
            zIndex: 5
          }}>
            <Star size={11} fill="#eab308" color="#eab308" />
            <span>{parsedRating.toFixed(1)}</span>
          </div>
        )}

        {/* Botão Play Flutuante no Hover */}
        <div 
          className="card-play-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.35)',
            opacity: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.2s ease',
            zIndex: 6,
            pointerEvents: 'none'
          }}
        >
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8), 0 0 15px var(--accent-subtle)'
          }}>
            <Play size={22} fill="var(--text-on-accent)" color="var(--text-on-accent)" style={{ marginLeft: '2px' }} />
          </div>
        </div>

        {/* Informações na Base sobre a Sombra Desvanecente */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '14px 12px 10px',
          zIndex: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {/* Barrinha Vermelha Estilo Netflix */}
          <div style={{ marginBottom: '2px' }}>
            <NetflixProgressBar progress={getProgress(item)} height={3.5} />
          </div>

          {/* Título do Filme / Série */}
          <div style={{
            fontSize: '12.5px',
            fontWeight: '800',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            letterSpacing: '-0.2px',
            lineHeight: '1.3',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.95)'
          }} title={item.name}>
            {item.name}
          </div>

          {/* Subtítulo: Indicador de Tipo (Filme / Série) e Grupo */}
          <div style={{
            fontSize: '10.5px',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                boxShadow: '0 0 6px var(--accent-primary)',
                display: 'inline-block'
              }} />
              <span style={{ fontWeight: '600', color: '#cbd5e1' }}>
                {isSeries ? 'Série' : 'Filme'}
              </span>
            </div>

            {isOtherGroup && (
              <span style={{
                color: 'var(--accent-bright)',
                fontSize: '9.5px',
                fontWeight: '700',
                background: 'rgba(56, 189, 248, 0.15)',
                padding: '1px 6px',
                borderRadius: '4px',
                maxWidth: '85px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {groupBadge}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!playlist || (playlist.type !== 'xtream' && playlist.type !== 'm3u')) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748b',
        gap: '14px',
        padding: '30px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '70px',
          height: '70px',
          borderRadius: '18px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {type === 'movies' ? <Film size={34} color="#10b981" /> : <Clapperboard size={34} color="#10b981" />}
        </div>
        <h3 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: '800' }}>
          {type === 'movies' ? 'Catálogo de Filmes (VOD)' : 'Catálogo de Séries'}
        </h3>
        <p style={{ maxWidth: '420px', fontSize: '13px', lineHeight: '1.5', color: '#94a3b8' }}>
          Conecte sua conta Xtream Codes ou carregue uma lista M3U com filmes para navegar no catálogo.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      overflow: 'hidden'
    }}>
      {/* Topbar Flutuante e Fixa (Ilha suspensa com bordas arredondadas) */}
      <div 
        className="app-drag-region"
        style={{
          padding: '10px 145px 10px 20px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(19, 23, 34, 0.88)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1)',
          flexShrink: 0,
          gap: '16px',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Lado Esquerdo: Indicador e Nome do Grupo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            boxShadow: '0 0 10px var(--accent-primary)',
            flexShrink: 0
          }} />
          <h2 style={{
            fontSize: '16px',
            fontWeight: '800',
            color: '#f8fafc',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {categoryName || (type === 'movies' ? 'Filmes' : 'Séries')}
          </h2>
        </div>

        {/* Lado Direito: Barra de Pesquisa do Grupo e Contador de Títulos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          <div 
            ref={searchContainerRef}
            style={{ position: 'relative', width: '320px', zIndex: 20 }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: isRecentOpen ? 'rgba(15, 23, 42, 0.98)' : 'rgba(15, 23, 42, 0.85)',
              border: isRecentOpen ? '1px solid var(--accent-primary)' : (isSearching ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.14)'),
              borderRadius: '10px',
              padding: '6px 12px',
              width: '100%',
              boxShadow: isRecentOpen || isSearching ? '0 0 12px var(--accent-subtle)' : '0 2px 10px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease'
            }}>
              <Search size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                value={groupSearch}
                onFocus={() => {
                  const fresh = getRecentSearches();
                  setRecentSearches(fresh);
                  setIsRecentOpen(true);
                }}
                onClick={() => {
                  const fresh = getRecentSearches();
                  setRecentSearches(fresh);
                  setIsRecentOpen(true);
                }}
                onChange={(e) => {
                  setGroupSearch(e.target.value);
                  setIsRecentOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && groupSearch.trim()) {
                    saveRecentSearch(groupSearch.trim());
                    setIsRecentOpen(false);
                    searchInputRef.current?.blur();
                  } else if (e.key === 'Escape') {
                    setIsRecentOpen(false);
                    searchInputRef.current?.blur();
                  }
                }}
                placeholder={`Pesquisar em ${categoryName || (type === 'movies' ? 'Filmes' : 'Séries')}...`}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              />
              {groupSearch && (
                <button
                  onClick={() => {
                    setGroupSearch('');
                    searchInputRef.current?.focus();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Limpar pesquisa"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Modal Dropdown de Pesquisas Recentes de Filmes e Séries */}
            {isRecentOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: '#0d131f',
                border: '1px solid var(--border-accent)',
                borderRadius: '12px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.95), 0 0 16px var(--accent-subtle)',
                padding: '8px',
                zIndex: 50,
                maxHeight: '320px',
                overflowY: 'auto'
              }}>
                {recentSearches.length > 0 ? (
                  <>
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
                        <Clock size={13} color="var(--accent-primary)" />
                        <span>Pesquisas Recentes ({recentSearches.length})</span>
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

                    {(() => {
                      const filterTerm = groupSearch.trim().toLowerCase();
                      const filtered = filterTerm
                        ? recentSearches.filter(t => t.toLowerCase().includes(filterTerm))
                        : recentSearches;

                      if (filtered.length === 0) {
                        return (
                          <div style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                              Nenhuma pesquisa recente corresponde a <strong style={{ color: '#ffffff' }}>"{groupSearch}"</strong>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: '600' }}>
                              Pressione Enter para pesquisar no catálogo
                            </div>
                          </div>
                        );
                      }

                      return filtered.map((term, idx) => (
                        <div
                          key={`${term}-${idx}`}
                          onClick={() => {
                            setGroupSearch(term);
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
                            <History size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
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
                      ));
                    })()}
                  </>
                ) : (
                  <div style={{ padding: '16px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                      <Clock size={20} color="var(--accent-primary)" style={{ opacity: 0.7 }} />
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
                      Nenhuma pesquisa recente ainda
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                      Ao pesquisar títulos ou clicar em filmes e séries, suas buscas ficarão salvas aqui para acesso rápido.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            <span>{total > 0 ? `${total} ${type === 'series' ? 'séries' : 'filmes'}` : ''}</span>
            {isSearching && totalOthers > 0 && (
              <span style={{ color: 'var(--accent-primary)', background: 'var(--accent-subtle)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                +{totalOthers} em outros
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Pôsteres Vertical com Scroll Infinito e PosterImage em SSD */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          marginTop: '10px',
          padding: '16px 8px 30px 4px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '20px',
          alignContent: 'start',
          borderRadius: '16px'
        }}
      >
        {/* Caso 1: Carregando inicial da categoria */}
        {(isLoading || (!categoryName && items.length === 0)) && !isSearching ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '90px 20px', gap: '14px' }}>
            <Loader2 size={38} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: '700' }}>
              Carregando títulos de <span style={{ color: 'var(--accent-primary)' }}>{categoryName || (type === 'movies' ? 'Filmes' : 'Séries')}</span>...
            </span>
          </div>
        ) : !isSearching ? (
          /* Caso 2: Navegação Normal no Grupo (Sem Pesquisa Ativa) */
          items.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#64748b' }}>
              Nenhum título encontrado nesta categoria.
            </div>
          ) : (
            <>
              {items.map(item => renderCard(item, false))}

              {/* Indicador de Carregamento ao rolar o Scroll Infinito */}
              {isLoadingMore && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '10px', color: 'var(--accent-primary)' }}>
                  <Loader2 size={22} className="animate-spin" />
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Carregando mais títulos...</span>
                </div>
              )}
            </>
          )
        ) : (
          /* Caso 3: PESQUISA ATIVA NO GRUPO -> Exibe títulos do próprio grupo e expande com títulos de outros grupos embaixo */
          <>
            {/* --- SEÇÃO 1: TÍTULOS DO PRÓPRIO GRUPO --- */}
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              marginBottom: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderOpen size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#f8fafc' }}>
                  Títulos em "{categoryName}"
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-accent)'
                }}>
                  {items.length} {items.length === 1 ? 'resultado' : 'resultados'}
                </span>
              </div>
            </div>

            {isLoading ? (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px', color: '#94a3b8' }}>
                <Loader2 size={22} color="var(--accent-primary)" className="animate-spin" />
                <span style={{ fontSize: '13px' }}>Buscando em {categoryName}...</span>
              </div>
            ) : items.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '24px 16px',
                textAlign: 'center',
                background: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '10px',
                border: '1px dashed rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontSize: '13px'
              }}>
                Nenhum título encontrado em <strong>{categoryName}</strong> para "{groupSearch}".
              </div>
            ) : (
              items.map(item => renderCard(item, false))
            )}

            {/* --- SEÇÃO 2: TÍTULOS ENCONTRADOS EM OUTROS GRUPOS (EM BAIXO DO PRÓPRIO GRUPO) --- */}
            <div 
              onClick={() => setIsOthersExpanded(prev => !prev)}
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
                border: '1px solid var(--border-accent)',
                borderRadius: '10px',
                marginTop: '20px',
                marginBottom: '4px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-bright)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-accent)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={17} color="var(--accent-primary)" />
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff' }}>
                  Títulos encontrados em outros grupos
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  background: 'var(--accent-primary)',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {totalOthers}
                </span>

                {isLoadingOthers && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px' }}>
                    <Loader2 size={13} className="animate-spin" color="var(--accent-primary)" />
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Buscando no catálogo...</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600', color: '#cbd5e1' }}>
                <span>{isOthersExpanded ? 'Recolher outros grupos' : 'Expandir outros grupos'}</span>
                {isOthersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {/* Conteúdo Expansível dos Outros Grupos */}
            {isOthersExpanded && (
              isLoadingOthers && otherGroupItems.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 20px', gap: '12px' }}>
                  <Loader2 size={26} color="var(--accent-primary)" className="animate-spin" />
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                    Procurando "{groupSearch}" em todos os outros grupos do catálogo...
                  </span>
                </div>
              ) : otherGroupItems.length === 0 && !isLoadingOthers ? (
                <div style={{
                  gridColumn: '1 / -1',
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.3)',
                  borderRadius: '10px',
                  border: '1px dashed rgba(255, 255, 255, 0.05)',
                  color: '#64748b',
                  fontSize: '12px'
                }}>
                  Nenhum título correspondente em outros grupos.
                </div>
              ) : (
                otherGroupItems.map(item => renderCard(item, true))
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
