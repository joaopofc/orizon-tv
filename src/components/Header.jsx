import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, 
  Film, 
  Clapperboard, 
  Heart, 
  History, 
  Search, 
  Settings, 
  PlusCircle, 
  Maximize, 
  Minimize,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Clock,
  Trash2,
  X
} from 'lucide-react';

export function Header({ 
  activeTab, 
  setActiveTab, 
  searchQuery, 
  setSearchQuery, 
  playlists, 
  selectedPlaylist, 
  setSelectedPlaylist,
  onOpenPlaylistModal,
  onOpenSettingsModal,
  isFullscreen,
  onToggleFullscreen
}) {
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('orizon_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Fecha o modal ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsRecentOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atalho global '/' para focar na busca
  useEffect(() => {
    const handleGlobalSlash = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
        if (recentSearches.length > 0) setIsRecentOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalSlash);
    return () => window.removeEventListener('keydown', handleGlobalSlash);
  }, [recentSearches.length]);

  const saveRecentSearch = (term) => {
    if (!term || !term.trim()) return;
    const clean = term.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('orizon_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeRecentSearch = (e, termToRemove) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(item => item !== termToRemove);
      try {
        localStorage.setItem('orizon_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearAllRecentSearches = (e) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem('orizon_recent_searches');
    } catch {}
  };

  const handleSelectRecent = (term) => {
    setSearchQuery(term);
    saveRecentSearch(term);
    setIsRecentOpen(false);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery && searchQuery.trim()) {
      saveRecentSearch(searchQuery);
      setIsRecentOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setIsRecentOpen(false);
      inputRef.current?.blur();
    }
  };
  return (
    <header style={{
      height: '68px',
      background: 'rgba(10, 14, 23, 0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 40,
      position: 'relative'
    }}>
      {/* Brand & Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '11px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            boxShadow: '0 4px 15px rgba(2, 132, 199, 0.25)',
            flexShrink: 0
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                ORIZON<span style={{ color: '#38bdf8' }}>TV</span>
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                PRO
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[
            { id: 'live', label: 'Ao Vivo', icon: Tv },
            { id: 'movies', label: 'Filmes', icon: Film },
            { id: 'series', label: 'Séries', icon: Clapperboard },
            { id: 'favorites', label: 'Favoritos', icon: Heart },
            { id: 'history', label: 'Histórico', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '500',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 15px rgba(56, 189, 248, 0.15)' : 'none'
                }}
              >
                <Icon size={16} color={isActive ? '#38bdf8' : '#94a3b8'} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Search Bar com Modal de Pesquisas Recentes */}
      <div 
        ref={searchContainerRef}
        style={{ flex: '1', maxWidth: '380px', margin: '0 24px', position: 'relative' }}
      >
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: isRecentOpen ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.6)',
          border: isRecentOpen ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isRecentOpen ? '0 0 16px rgba(56, 189, 248, 0.15)' : 'none',
          borderRadius: '10px',
          padding: '0 12px',
          transition: 'all 0.2s ease'
        }}>
          <Search size={16} color={isRecentOpen ? '#38bdf8' : '#64748b'} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onFocus={() => {
              if (recentSearches.length > 0) setIsRecentOpen(true);
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isRecentOpen && recentSearches.length > 0) setIsRecentOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar canais, filmes ou séries... (Pressione /)"
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              style={{ 
                background: 'transparent', 
                border: 'none',
                color: '#94a3b8', 
                fontSize: '11px', 
                padding: '2px 6px',
                cursor: 'pointer'
              }}
              title="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        {/* Modal Flutuante de Pesquisas Recentes */}
        {isRecentOpen && recentSearches.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            background: '#0b0f19',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(56, 189, 248, 0.15)',
            padding: '8px',
            zIndex: 9999,
            backdropFilter: 'blur(20px)',
            maxHeight: '340px',
            overflowY: 'auto'
          }}>
            {/* Cabeçalho do Modal Recentes */}
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
                onClick={clearAllRecentSearches}
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
                  opacity: 0.85,
                  transition: 'opacity 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.85'}
                title="Limpar todo o histórico de pesquisas"
              >
                <Trash2 size={11} />
                <span>Limpar</span>
              </button>
            </div>

            {/* Lista de Termos Recentes */}
            {recentSearches
              .filter(term => !searchQuery.trim() || term.toLowerCase().includes(searchQuery.toLowerCase().trim()))
              .map((term, idx) => (
                <div
                  key={`${term}-${idx}`}
                  onClick={() => handleSelectRecent(term)}
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
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#e2e8f0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <History size={14} color="#64748b" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {term}
                    </span>
                  </div>

                  <button
                    onClick={(e) => removeRecentSearch(e, term)}
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
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title="Remover termo"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Right Controls: Playlists Selector & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Playlist Selector */}
        {playlists.length > 0 ? (
          <div style={{ position: 'relative' }}>
            <select
              value={selectedPlaylist?.id || ''}
              onChange={(e) => {
                const found = playlists.find(p => p.id === e.target.value);
                if (found) setSelectedPlaylist(found);
              }}
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {playlists.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Add Playlist Button */}
        <button
          onClick={onOpenPlaylistModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
          }}
        >
          <PlusCircle size={16} />
          {playlists.length === 0 ? 'Conectar Lista' : 'Nova Lista'}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettingsModal}
          title="Configurações do Player"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8'
          }}
        >
          <Settings size={18} />
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={onToggleFullscreen}
          title="Tela Cheia (F11)"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8'
          }}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>
    </header>
  );
}
