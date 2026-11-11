import React, { useState } from 'react';
import { Tv, Heart, Radio, Search, Filter, Loader2 } from 'lucide-react';

export function ChannelList({ 
  channels = [], 
  categories = [], 
  selectedCategory = 'Todos',
  onSelectCategory,
  selectedChannel, 
  onSelectChannel,
  favorites = [],
  onToggleFavorite,
  searchQuery = '',
  totalChannels = 0,
  isLoading = false,
  onLoadMore,
  hasMore = false
}) {
  const [filterSearch, setFilterSearch] = useState('');

  const isFav = (channel) => {
    return favorites.some(f => f.id === channel.id || f.url === channel.url);
  };

  return (
    <div style={{
      width: '380px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(10, 14, 23, 0.95)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      zIndex: 20
    }}>
      {/* Categories Horizontal Carousel */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tv size={16} color="#38bdf8" />
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Canais {totalChannels > 0 ? `(${totalChannels})` : ''}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
            {categories.length} Categorias
          </span>
        </div>

        {/* Categories Pills */}
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none'
        }}>
          {categories.map((cat, idx) => {
            const name = typeof cat === 'string' ? cat : (cat.name || 'Geral');
            const count = typeof cat === 'object' && cat.count ? cat.count : null;
            const isSelected = selectedCategory === name;
            return (
              <button
                key={idx}
                onClick={() => onSelectCategory && onSelectCategory(name)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: isSelected ? '700' : '500',
                  whiteSpace: 'nowrap',
                  background: isSelected ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                  color: isSelected ? '#ffffff' : '#94a3b8',
                  border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
                  boxShadow: isSelected ? '0 0 12px rgba(2, 132, 199, 0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{name}</span>
                {count !== null && (
                  <span style={{
                    fontSize: '10px',
                    opacity: isSelected ? 0.9 : 0.6,
                    padding: '1px 5px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.25)'
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Channels Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px', color: '#94a3b8' }}>
            <Loader2 size={24} color="#38bdf8" className="animate-spin" />
            <span style={{ fontSize: '13px' }}>Carregando canais...</span>
          </div>
        ) : channels.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8' }}>Nenhum canal encontrado</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Selecione uma categoria acima ou digite uma busca.</p>
          </div>
        ) : (
          <>
            {channels.map((channel, index) => {
              const isSelected = selectedChannel?.id === channel.id || selectedChannel?.url === channel.url;
              const fav = isFav(channel);

              return (
                <div
                  key={channel.id || index}
                  onClick={() => onSelectChannel(channel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected 
                      ? 'linear-gradient(90deg, rgba(2, 132, 199, 0.25) 0%, rgba(14, 165, 233, 0.1) 100%)' 
                      : 'rgba(255, 255, 255, 0.02)',
                    border: isSelected 
                      ? '1px solid rgba(56, 189, 248, 0.4)' 
                      : '1px solid transparent',
                    boxShadow: isSelected ? '0 0 15px rgba(2, 132, 199, 0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                    {/* Channel Logo */}
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.name}
                        onError={(e) => { e.target.style.display = 'none'; }}
                        style={{
                          width: '36px',
                          height: '36px',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '2px',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        background: isSelected ? '#0284c7' : 'rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: '700',
                        color: '#ffffff',
                        flexShrink: 0
                      }}>
                        {channel.name.charAt(0)}
                      </div>
                    )}

                    {/* Channel Names */}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? '#38bdf8' : '#f8fafc',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                      }}>
                        {channel.name}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                      }}>
                        {channel.category}
                      </div>
                    </div>
                  </div>

                  {/* Right Action: Favorite */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(channel);
                    }}
                    style={{
                      background: 'transparent',
                      color: fav ? '#ef4444' : '#475569',
                      padding: '6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={fav ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
                  >
                    <Heart size={16} fill={fav ? '#ef4444' : 'none'} />
                  </button>
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={onLoadMore}
                style={{
                  margin: '12px 0',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                Carregar mais canais...
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
