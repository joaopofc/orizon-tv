import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Trash2, 
  Pencil, 
  Search, 
  Tv, 
  Trophy, 
  Film, 
  Clapperboard, 
  Star, 
  History, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  Flame, 
  Heart, 
  Sparkles, 
  Popcorn, 
  Compass, 
  Bookmark, 
  Sliders, 
  Loader2,
  GripVertical
} from 'lucide-react';

// Mapeamento de Ícones Disponíveis para Categorias
export const CATEGORY_ICONS = {
  live: Tv,
  sports: Trophy,
  movies: Film,
  series: Clapperboard,
  favorites: Star,
  history: History,
  adult: Lock,
  tv: Tv,
  trophy: Trophy,
  film: Film,
  clapperboard: Clapperboard,
  star: Star,
  flame: Flame,
  heart: Heart,
  sparkles: Sparkles,
  popcorn: Popcorn,
  compass: Compass,
  bookmark: Bookmark
};

export const DEFAULT_TABS_DEF = [
  { id: 'live', defaultLabel: 'Ao Vivo', iconName: 'live' },
  { id: 'sports', defaultLabel: 'Esportes', iconName: 'sports' },
  { id: 'movies', defaultLabel: 'Filmes', iconName: 'movies' },
  { id: 'series', defaultLabel: 'Séries', iconName: 'series' },
  { id: 'favorites', defaultLabel: 'Favoritos', iconName: 'favorites' },
  { id: 'history', defaultLabel: 'Histórico', iconName: 'history' },
  { id: 'adult', defaultLabel: 'Adulto', iconName: 'adult', isAdult: true }
];

export function CategoryManagerModal({
  isOpen,
  onClose,
  playlist,
  customCategories = [],
  categoriesConfig = { order: [], hidden: [] },
  onSaveOrder,
  onSaveCustomCategory,
  onDeleteCustomCategory
}) {
  const [activeTab, setActiveTab] = useState('order'); // 'order' | 'edit'
  const [editingCategory, setEditingCategory] = useState(null);

  // Estados do formulário de criação/edição
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('star');
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Busca de mídias para adicionar à categoria
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTypeFilter, setSearchTypeFilter] = useState('all'); // 'all' | 'live' | 'movie' | 'series'
  const [searchResults, setSearchResults] = useState({ channels: [], movies: [], series: [] });
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Lista local ordenada de categorias
  const [localOrder, setLocalOrder] = useState([]);
  const [localHidden, setLocalHidden] = useState([]);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Estados de Arrastar e Soltar (Drag & Drop)
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Inicializa lista ordenada ao abrir
  useEffect(() => {
    if (isOpen) {
      const defaultIds = DEFAULT_TABS_DEF.map(t => t.id);
      const customIds = customCategories.map(c => c.id);
      const combinedAll = [...defaultIds, ...customIds];

      let initialOrder = categoriesConfig.order && categoriesConfig.order.length > 0
        ? [...categoriesConfig.order]
        : [...defaultIds, ...customIds];

      // Garante que novos customIds estejam na lista
      combinedAll.forEach(id => {
        if (!initialOrder.includes(id)) {
          initialOrder.push(id);
        }
      });

      // Remove IDs que não existem mais
      initialOrder = initialOrder.filter(id => combinedAll.includes(id));

      setLocalOrder(initialOrder);
      setLocalHidden(categoriesConfig.hidden || []);
    }
  }, [isOpen, categoriesConfig, customCategories]);

  // Busca em tempo real com debounce
  useEffect(() => {
    if (!playlist?.id || !searchQuery.trim()) {
      setSearchResults({ channels: [], movies: [], series: [] });
      setIsSearching(false);
      return;
    }

    clearTimeout(searchTimeoutRef.current);
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/playlists/${playlist.id}/search-all?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        setSearchResults({
          channels: data.channels || [],
          movies: data.movies || [],
          series: data.series || []
        });
      } catch (err) {
        console.error('Erro na busca unificada de mídias:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, playlist?.id]);

  if (!isOpen) return null;

  // Objeto unificado de itens para reordenação
  const allCategoryItems = localOrder.map(id => {
    const isDefault = DEFAULT_TABS_DEF.find(t => t.id === id);
    if (isDefault) {
      return {
        id: isDefault.id,
        label: isDefault.defaultLabel,
        iconName: isDefault.iconName,
        isDefault: true,
        isAdult: isDefault.isAdult
      };
    }
    const custom = customCategories.find(c => c.id === id);
    if (custom) {
      return {
        id: custom.id,
        label: custom.name,
        iconName: custom.icon || 'star',
        isDefault: false,
        itemsCount: custom.items?.length || 0,
        customData: custom
      };
    }
    return null;
  }).filter(Boolean);

  // Mover item para cima
  const handleMoveUp = (index) => {
    if (index <= 0) return;
    const newOrder = [...localOrder];
    const temp = newOrder[index - 1];
    newOrder[index - 1] = newOrder[index];
    newOrder[index] = temp;
    setLocalOrder(newOrder);
  };

  // Mover item para baixo
  const handleMoveDown = (index) => {
    if (index >= localOrder.length - 1) return;
    const newOrder = [...localOrder];
    const temp = newOrder[index + 1];
    newOrder[index + 1] = newOrder[index];
    newOrder[index] = temp;
    setLocalOrder(newOrder);
  };

  // Reordenar por Arrastar e Soltar (Drag & Drop)
  const handleReorder = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const newOrder = [...localOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    setLocalOrder(newOrder);
  };

  // Alternar visibilidade
  const handleToggleHide = (id) => {
    setLocalHidden(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Salvar Ordem e Visibilidade
  const handleSaveOrderConfig = async () => {
    const newConfig = {
      order: localOrder,
      hidden: localHidden
    };
    if (onSaveOrder) {
      await onSaveOrder(newConfig);
    }
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
    }, 1500);
  };

  // Abrir tela de criação
  const handleStartCreate = () => {
    setEditingCategory(null);
    setCatName('');
    setCatIcon('star');
    setSelectedItems([]);
    setSearchQuery('');
    setActiveTab('edit');
  };

  // Abrir tela de edição de categoria personalizada
  const handleStartEdit = (customCat) => {
    setEditingCategory(customCat);
    setCatName(customCat.name || '');
    setCatIcon(customCat.icon || 'star');
    setSelectedItems(customCat.items || []);
    setSearchQuery('');
    setActiveTab('edit');
  };

  // Adicionar item à seleção da categoria
  const handleAddItem = (item, type) => {
    const unifiedId = item.id || (type === 'series' ? `series_${item.seriesId}` : `${type}_${item.streamId || item.url}`);
    if (selectedItems.some(i => i.id === unifiedId || (i.seriesId && item.seriesId && i.seriesId === item.seriesId))) {
      return;
    }
    setSelectedItems(prev => [
      ...prev,
      {
        ...item,
        id: unifiedId,
        type: type, // 'live' | 'movie' | 'series'
        addedAt: Date.now()
      }
    ]);
  };

  // Remover item da seleção
  const handleRemoveItem = (itemId) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  };

  // Salvar Categoria Personalizada
  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      alert('Por favor, informe um nome para a categoria.');
      return;
    }

    const payload = {
      id: editingCategory?.id,
      name: catName.trim(),
      icon: catIcon,
      items: selectedItems
    };

    if (onSaveCustomCategory) {
      await onSaveCustomCategory(payload);
    }

    setActiveTab('order');
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1500);
  };

  // Excluir Categoria Personalizada
  const handleDeleteCategory = async (id, name) => {
    if (window.confirm(`Tem certeza que deseja excluir a categoria "${name}"?`)) {
      if (onDeleteCustomCategory) {
        await onDeleteCustomCategory(id);
      }
      setLocalOrder(prev => prev.filter(x => x !== id));
    }
  };

  // Filtragem dos resultados da busca
  const displayResults = [
    ...(searchTypeFilter === 'all' || searchTypeFilter === 'live' ? searchResults.channels : []),
    ...(searchTypeFilter === 'all' || searchTypeFilter === 'movie' ? searchResults.movies : []),
    ...(searchTypeFilter === 'all' || searchTypeFilter === 'series' ? searchResults.series : [])
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '820px',
        height: '88vh',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header do Modal */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--accent-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <Sliders size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Gerenciar Categorias Principais
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Controle a ordem de exibição, crie coleções customizadas e selecione seus canais, filmes e séries
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas Internas de Navegação */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('order')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                background: activeTab === 'order' ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === 'order' ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: activeTab === 'order' ? '1px solid var(--border-accent)' : '1px solid transparent'
              }}
            >
              <span>Posição & Ordem das Abas</span>
            </button>

            <button
              onClick={handleStartCreate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                background: activeTab === 'edit' ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === 'edit' ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: activeTab === 'edit' ? '1px solid var(--border-accent)' : '1px solid transparent'
              }}
            >
              <Plus size={15} />
              <span>{editingCategory ? `Editar "${catName}"` : 'Nova Categoria Personalizada'}</span>
            </button>
          </div>

          {activeTab === 'order' && (
            <button
              onClick={handleSaveOrderConfig}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '8px',
                background: savedFeedback ? '#10b981' : 'var(--accent-primary)',
                color: savedFeedback ? '#ffffff' : 'var(--text-on-accent)',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {savedFeedback ? <Check size={16} /> : null}
              <span>{savedFeedback ? 'Ordem Salva!' : 'Salvar Posições'}</span>
            </button>
          )}
        </div>

        {/* Conteúdo Principal do Modal */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }} className="visible-scroll">
          {activeTab === 'order' ? (
            /* ============================================================== */
            /* 1. ABA DE POSIÇÃO E ORDEM DAS CATEGORIAS                       */
            /* ============================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: 'var(--bg-card)',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                    Ordem de Exibição na Barra de Navegação
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Arraste e solte com o mouse para reposicionar as abas na barra de navegação, ou use as setas ao lado. Você também pode ocultar abas que não utiliza.
                  </p>
                </div>

                <button
                  onClick={handleStartCreate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'var(--accent-primary)',
                    color: 'var(--text-on-accent)',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={15} />
                  <span>Criar Nova Categoria</span>
                </button>
              </div>

              {/* Lista Reordenável com Drag & Drop e Setas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allCategoryItems.map((cat, idx) => {
                  const Icon = CATEGORY_ICONS[cat.iconName] || Star;
                  const isHidden = localHidden.includes(cat.id);
                  const isBeingDragged = draggedIdx === idx;
                  const isDragTarget = dragOverIdx === idx && draggedIdx !== idx;

                  return (
                    <div
                      key={cat.id}
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedIdx(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverIdx !== idx) {
                          setDragOverIdx(idx);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverIdx === idx) {
                          setDragOverIdx(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedIdx !== null && draggedIdx !== idx) {
                          handleReorder(draggedIdx, idx);
                        }
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: isBeingDragged 
                          ? 'rgba(56, 189, 248, 0.08)' 
                          : isDragTarget 
                            ? 'rgba(56, 189, 248, 0.16)' 
                            : (isHidden ? 'rgba(0, 0, 0, 0.2)' : 'var(--bg-card)'),
                        border: isBeingDragged 
                          ? '1px dashed var(--accent-primary)' 
                          : isDragTarget 
                            ? '2px solid var(--accent-primary)' 
                            : '1px solid var(--border-subtle)',
                        opacity: isBeingDragged ? 0.4 : (isHidden ? 0.6 : 1),
                        cursor: 'grab',
                        transform: isDragTarget ? 'scale(1.01)' : 'scale(1)',
                        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Alça de Arraste (Grip) */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: '#64748b',
                            cursor: 'grab',
                            padding: '2px'
                          }}
                          title="Clique e arraste para reposicionar esta categoria"
                        >
                          <GripVertical size={16} />
                        </div>

                        {/* Posição Numérica */}
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '800',
                          color: '#64748b',
                          width: '24px',
                          textAlign: 'center'
                        }}>
                          #{idx + 1}
                        </span>

                        {/* Ícone da Categoria */}
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isHidden ? 'rgba(255, 255, 255, 0.05)' : 'var(--accent-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isHidden ? '#64748b' : 'var(--accent-primary)',
                          border: isHidden ? '1px solid transparent' : '1px solid var(--border-accent)'
                        }}>
                          <Icon size={16} />
                        </div>

                        {/* Título e Tags */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                              {cat.label}
                            </span>
                            {!cat.isDefault ? (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: 'var(--accent-primary)',
                                border: '1px solid var(--border-accent)'
                              }}>
                                PERSONALIZADA • {cat.itemsCount} itens
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: '#94a3b8'
                              }}>
                                PADRÃO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ações: Mover, Ocultar, Editar, Excluir */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: idx === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid var(--border-subtle)',
                            color: idx === 0 ? '#475569' : '#cbd5e1',
                            cursor: idx === 0 ? 'not-allowed' : 'pointer'
                          }}
                          title="Mover para cima"
                        >
                          <ArrowUp size={14} />
                        </button>

                        <button
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === allCategoryItems.length - 1}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: idx === allCategoryItems.length - 1 ? 'transparent' : 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid var(--border-subtle)',
                            color: idx === allCategoryItems.length - 1 ? '#475569' : '#cbd5e1',
                            cursor: idx === allCategoryItems.length - 1 ? 'not-allowed' : 'pointer'
                          }}
                          title="Mover para baixo"
                        >
                          <ArrowDown size={14} />
                        </button>

                        <button
                          onClick={() => handleToggleHide(cat.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: isHidden ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid var(--border-subtle)',
                            color: isHidden ? '#f87171' : '#cbd5e1',
                            cursor: 'pointer'
                          }}
                          title={isHidden ? 'Mostrar na barra' : 'Ocultar da barra'}
                        >
                          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>

                        {!cat.isDefault && (
                          <>
                            <button
                              onClick={() => handleStartEdit(cat.customData)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer'
                              }}
                              title="Editar itens da categoria"
                            >
                              <Pencil size={14} />
                            </button>

                            <button
                              onClick={() => handleDeleteCategory(cat.id, cat.label)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                cursor: 'pointer'
                              }}
                              title="Excluir categoria"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* 2. ABA DE CRIAÇÃO / EDIÇÃO DE CATEGORIA PERSONALIZADA          */
            /* ============================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Form de Nome e Ícone */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'flex-start' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '6px' }}>
                      Nome da Categoria
                    </label>
                    <input
                      type="text"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="Ex: Futebol e Lutas, Filmes de Terror, Séries Favoritas, Crianças..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: '#ffffff',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '6px' }}>
                      Ícone da Aba
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '240px' }}>
                      {['star', 'trophy', 'film', 'clapperboard', 'tv', 'flame', 'heart', 'sparkles', 'popcorn', 'compass', 'bookmark'].map(ic => {
                        const IconComponent = CATEGORY_ICONS[ic] || Star;
                        const isSelected = catIcon === ic;
                        return (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setCatIcon(ic)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                              border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                              color: isSelected ? 'var(--accent-primary)' : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <IconComponent size={16} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Resumo de itens selecionados e botão salvar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Itens salvos nesta categoria: <strong style={{ color: 'var(--accent-primary)' }}>{selectedItems.length}</strong>
                    {' '}({selectedItems.filter(i => i.type === 'live').length} canais, {selectedItems.filter(i => i.type === 'movie').length} filmes, {selectedItems.filter(i => i.type === 'series').length} séries)
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('order')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid var(--border-subtle)',
                        color: '#cbd5e1',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveCategory}
                      style={{
                        padding: '8px 20px',
                        borderRadius: '8px',
                        background: 'var(--accent-primary)',
                        color: 'var(--text-on-accent)',
                        fontSize: '13px',
                        fontWeight: '800',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)'
                      }}
                    >
                      Salvar Categoria
                    </button>
                  </div>
                </div>
              </div>

              {/* Caixa de Pesquisa de Mídias (Canais, Filmes, Séries) */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                    Buscar e Selecionar Mídias para Esta Categoria
                  </h4>

                  {/* Filtro por tipo de mídia */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'live', label: '📺 Ao Vivo' },
                      { id: 'movie', label: '🎬 Filmes' },
                      { id: 'series', label: '📽️ Séries' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSearchTypeFilter(f.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: searchTypeFilter === f.id ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                          color: searchTypeFilter === f.id ? 'var(--accent-primary)' : '#94a3b8',
                          border: searchTypeFilter === f.id ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input de Busca */}
                <div style={{ position: 'relative' }}>
                  <Search size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Digite o nome de canais, filmes ou séries para adicionar..."
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 40px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '13px'
                    }}
                  />
                  {isSearching && (
                    <Loader2 size={16} color="var(--accent-primary)" className="animate-spin" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  )}
                </div>

                {/* Grid de Resultados da Busca */}
                {displayResults.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '10px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }} className="visible-scroll">
                    {displayResults.map((item, idx) => {
                      const isAlreadySelected = selectedItems.some(i => 
                        i.id === item.id || 
                        (i.seriesId && item.seriesId && i.seriesId === item.seriesId) ||
                        (i.url && item.url && i.url === item.url)
                      );
                      const itemLogo = item.logo || item.image || item.cover || item.stream_icon;
                      const isVod = item.type === 'movie' || item.type === 'series';

                      return (
                        <div
                          key={item.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: isAlreadySelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-surface)',
                            border: isAlreadySelected ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <div style={{
                              width: isVod ? '28px' : '32px',
                              height: isVod ? '38px' : '32px',
                              borderRadius: '4px',
                              background: '#000000',
                              overflow: 'hidden',
                              flexShrink: 0
                            }}>
                              {itemLogo ? (
                                <img
                                  src={itemLogo}
                                  alt={item.name}
                                  style={{ width: '100%', height: '100%', objectFit: isVod ? 'cover' : 'contain' }}
                                  onError={(e) => e.target.style.display = 'none'}
                                />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '10px' }}>
                                  {item.type === 'series' ? 'S' : item.type === 'movie' ? 'F' : 'TV'}
                                </div>
                              )}
                            </div>

                            <div style={{ overflow: 'hidden' }}>
                              <div style={{
                                fontSize: '12px',
                                fontWeight: '700',
                                color: '#ffffff',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden'
                              }}>
                                {item.name || item.title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <span style={{
                                  fontSize: '9px',
                                  fontWeight: '800',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  background: item.type === 'series' ? 'rgba(99, 102, 241, 0.2)' : item.type === 'movie' ? 'rgba(168, 85, 247, 0.2)' : 'var(--accent-subtle)',
                                  color: item.type === 'series' ? '#a5b4fc' : item.type === 'movie' ? '#c084fc' : 'var(--accent-primary)'
                                }}>
                                  {item.type === 'series' ? 'SÉRIE' : item.type === 'movie' ? 'FILME' : 'AO VIVO'}
                                </span>
                                <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.category || ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddItem(item, item.type)}
                            disabled={isAlreadySelected}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: isAlreadySelected ? 'rgba(34, 197, 94, 0.15)' : 'var(--accent-primary)',
                              border: isAlreadySelected ? '1px solid rgba(34, 197, 94, 0.4)' : 'none',
                              color: isAlreadySelected ? '#4ade80' : 'var(--text-on-accent)',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: isAlreadySelected ? 'default' : 'pointer',
                              flexShrink: 0
                            }}
                          >
                            {isAlreadySelected ? <Check size={12} /> : '+ Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : searchQuery.trim() && !isSearching ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                    Nenhum canal, filme ou série encontrado com o termo "{searchQuery}".
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                    Digite acima para pesquisar canais ao vivo, filmes e séries para adicionar a esta categoria.
                  </div>
                )}
              </div>

              {/* Lista dos Itens Já Adicionados à Categoria */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                    Conteúdos Salvos nesta Categoria ({selectedItems.length})
                  </h4>
                  {selectedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedItems([])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Remover Todos
                    </button>
                  )}
                </div>

                {selectedItems.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                    Esta categoria ainda não possui conteúdos. Faça uma busca acima e clique em <strong>+ Add</strong> para salvar canais, filmes ou séries completas aqui.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }} className="visible-scroll">
                    {selectedItems.map((item) => {
                      const itemLogo = item.logo || item.image || item.cover || item.stream_icon;
                      const isVod = item.type === 'movie' || item.type === 'series';

                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <div style={{
                              width: isVod ? '24px' : '28px',
                              height: isVod ? '34px' : '28px',
                              borderRadius: '4px',
                              background: '#000000',
                              overflow: 'hidden',
                              flexShrink: 0
                            }}>
                              {itemLogo ? (
                                <img src={itemLogo} alt={item.name} style={{ width: '100%', height: '100%', objectFit: isVod ? 'cover' : 'contain' }} onError={(e) => e.target.style.display = 'none'} />
                              ) : null}
                            </div>

                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {item.name || item.title}
                              </div>
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '800',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: item.type === 'series' ? 'rgba(99, 102, 241, 0.2)' : item.type === 'movie' ? 'rgba(168, 85, 247, 0.2)' : 'var(--accent-subtle)',
                                color: item.type === 'series' ? '#a5b4fc' : item.type === 'movie' ? '#c084fc' : 'var(--accent-primary)'
                              }}>
                                {item.type === 'series' ? 'SÉRIE' : item.type === 'movie' ? 'FILME' : 'AO VIVO'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                            title="Remover desta categoria"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoryManagerModal;

