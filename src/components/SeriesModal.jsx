import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Play, 
  Star, 
  Calendar, 
  Clock, 
  Layers, 
  AlertCircle
} from 'lucide-react';
import { useVodProgress, NetflixProgressBar } from '../utils/vodProgress';
import { cleanEpisodeTitle } from '../utils/seriesUtils';

export function SeriesModal({
  isOpen,
  onClose,
  series,
  playlist,
  onPlayEpisode,
  currentPlayingEpisode = null,
  initialSeason = '1'
}) {
  const { getProgress } = useVodProgress();
  const [normalizedData, setNormalizedData] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(() => (initialSeason || '1').toString());
  const [expandedPlotEpId, setExpandedPlotEpId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const currentPlayingRef = useRef(null);

  useEffect(() => {
    setExpandedPlotEpId(null);
  }, [selectedSeason, isOpen]);

  useEffect(() => {
    if (isOpen && initialSeason) {
      setSelectedSeason(initialSeason.toString());
    }
  }, [isOpen, initialSeason]);

  // Rola a grade automaticamente até o episódio em reprodução com animação suave
  useEffect(() => {
    if (isOpen && currentPlayingRef.current) {
      const timer = setTimeout(() => {
        if (currentPlayingRef.current) {
          currentPlayingRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedSeason, normalizedData]);

  useEffect(() => {
    if (!isOpen || !series || !playlist) return;

    setIsLoading(true);
    setError('');
    setNormalizedData(null);

    const seriesId = series.seriesId || series.id?.replace(/^xt_series_/, '');

    fetch(`/api/xtream/${playlist.id}/series-info/${seriesId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }

        // Normalização flexível: funciona tanto com backend formatado quanto com resposta nativa do Xtream
        const rawEpisodes = data.episodesBySeason || data.episodes || {};
        let seasonsList = [];

        // 1. Extração de Temporadas
        if (Array.isArray(data.seasons) && data.seasons.length > 0) {
          seasonsList = data.seasons.map(s => ({
            seasonNumber: parseInt(s.seasonNumber || s.season || s, 10),
            name: s.name || `Temporada ${s.seasonNumber || s.season || s}`,
            episodeCount: s.episodeCount || (rawEpisodes[s.seasonNumber || s.season || s] || []).length
          }));
        } else if (typeof rawEpisodes === 'object' && !Array.isArray(rawEpisodes)) {
          const sKeys = Object.keys(rawEpisodes).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
          seasonsList = sKeys.map(k => ({
            seasonNumber: parseInt(k, 10) || 1,
            name: `Temporada ${k}`,
            episodeCount: (rawEpisodes[k] || []).length
          }));
        }

        // Se ainda não encontrou nenhuma temporada mas há episódios soltos em array
        if (seasonsList.length === 0 && Array.isArray(rawEpisodes) && rawEpisodes.length > 0) {
          seasonsList = [{ seasonNumber: 1, name: 'Temporada 1', episodeCount: rawEpisodes.length }];
        }

        // 2. Normalização dos Episódios por Temporada
        const episodesBySeason = {};
        const showTitle = data.name || data.info?.name || series.name || 'Série';

        for (const season of seasonsList) {
          const sKey = season.seasonNumber.toString();
          const epArray = Array.isArray(rawEpisodes) ? rawEpisodes : (rawEpisodes[sKey] || []);

          episodesBySeason[sKey] = epArray.map((ep, idx) => {
            const epInfo = ep.info || {};
            const ext = ep.container_extension || ep.extension || 'mp4';
            const streamId = ep.id || ep.stream_id || `${seriesId}_${sKey}_${idx + 1}`;
            const streamUrl = ep.url || `${playlist.url}/series/${playlist.username}/${playlist.password}/${streamId}.${ext}`;
            const epNum = parseInt(ep.episode_num || ep.episode || (idx + 1).toString(), 10);
            const rawEpTitle = ep.rawTitle || ep.title || '';
            const epTitle = cleanEpisodeTitle(rawEpTitle || ep.title, epNum, showTitle);

            // Imagem do episódio (widescreen 16:9 se disponível)
            let epThumb = ep.image || epInfo.movie_image || epInfo.cover_big || ep.movie_image || ep.cover_big || '';
            if (epThumb && typeof epThumb === 'string' && epThumb.startsWith('http://image.tmdb.org')) {
              epThumb = epThumb.replace('http://image.tmdb.org', 'https://image.tmdb.org');
            }
            if (!epThumb) {
              epThumb = data.backdrop || data.info?.backdrop_path?.[0] || data.cover || series.logo || '';
            }

            return {
              id: ep.id || `xt_ep_${streamId}`,
              streamId: streamId,
              seriesId: seriesId,
              seriesName: showTitle,
              seasonNumber: season.seasonNumber,
              episodeNum: epNum,
              title: epTitle,
              rawTitle: rawEpTitle,
              fullTitle: `${showTitle} • TEMP. ${season.seasonNumber} • EP. ${epNum}`,
              plot: ep.plot || epInfo.plot || '',
              rating: ep.rating || epInfo.rating || '',
              image: epThumb,
              url: streamUrl,
              type: 'series'
            };
          });
        }

        // 3. Metadados Gerais da Série
        const meta = {
          name: showTitle,
          backdrop: data.backdrop || data.info?.backdrop_path?.[0] || data.cover || data.info?.cover || series.logo || '',
          cover: data.cover || data.info?.cover || series.logo || '',
          plot: data.plot || data.info?.plot || series.plot || '',
          rating: data.rating || data.info?.rating || series.rating || '',
          releaseDate: data.releaseDate || data.info?.releaseDate || '',
          genre: data.genre || data.info?.genre || series.category || 'Séries'
        };

        setNormalizedData({
          seasons: seasonsList,
          episodesBySeason,
          meta
        });

        if (seasonsList.length > 0) {
          const targetSeason = (initialSeason || currentPlayingEpisode?.seasonNumber || seasonsList[0].seasonNumber).toString();
          const exists = seasonsList.some(s => s.seasonNumber.toString() === targetSeason);
          setSelectedSeason(exists ? targetSeason : seasonsList[0].seasonNumber.toString());
        }
      })
      .catch(err => {
        console.error('Erro ao buscar dados da série:', err);
        setError(err.message || 'Falha ao carregar temporadas e episódios');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, series, playlist]);

  if (!isOpen || !series) return null;

  const seasons = normalizedData?.seasons || [];
  const currentEpisodes = normalizedData?.episodesBySeason?.[selectedSeason] || [];
  const meta = normalizedData?.meta || {};

  const handlePlayFirstEpisode = () => {
    if (seasons.length > 0) {
      const firstSeasonNum = seasons[0].seasonNumber.toString();
      const firstEp = normalizedData?.episodesBySeason?.[firstSeasonNum]?.[0];
      if (firstEp) {
        onPlayEpisode(firstEp, normalizedData);
        onClose();
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.88)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1080px',
        height: '88vh',
        maxHeight: '88vh',
        minHeight: '520px',
        background: '#0b111d',
        border: '1px solid var(--border-accent)',
        borderRadius: '20px',
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 40px var(--accent-subtle)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Botão Fechar Flutuante */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 20,
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-primary)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
          title="Fechar (Esc)"
        >
          <X size={18} />
        </button>

        {isLoading ? (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            color: '#94a3b8'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              border: '3.5px solid transparent',
              borderTopColor: 'var(--accent-primary)',
              borderRightColor: 'var(--accent-primary)',
              borderBottomColor: 'var(--accent-primary)',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Carregando temporadas e episódios...</span>
          </div>
        ) : error ? (
          <div style={{
            height: '100%',
            padding: '40px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            color: '#f87171',
            textAlign: 'center'
          }}>
            <AlertCircle size={44} />
            <h4 style={{ fontSize: '16px', fontWeight: '700' }}>{error}</h4>
            <button
              onClick={onClose}
              style={{
                marginTop: '10px',
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, flex: 1, overflow: 'hidden' }}>
            {/* 1. HERO HEADER COMPACTO COM BACKDROP */}
            <div style={{
              position: 'relative',
              height: '210px',
              minHeight: '210px',
              maxHeight: '210px',
              width: '100%',
              backgroundImage: `url(${meta.backdrop || meta.cover || series.logo})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 20%',
              flexShrink: 0
            }}>
              {/* Gradiente de escurecimento cinematográfico */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(0deg, #0b111d 5%, rgba(11, 17, 29, 0.85) 60%, rgba(11, 17, 29, 0.4) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '18px 28px'
              }}>
                {/* Selos de Categoria / Resolução */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--accent-primary)',
                    color: 'var(--text-on-accent)',
                    letterSpacing: '0.5px'
                  }}>
                    SÉRIE
                  </span>
                  {meta.genre && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                      {meta.genre}
                    </span>
                  )}
                </div>

                {/* Título da Série */}
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#ffffff',
                  marginBottom: '8px',
                  letterSpacing: '-0.3px',
                  textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {meta.name || series.name}
                </h1>

                {/* Metadados: Nota, Ano, Temporadas */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#cbd5e1',
                  marginBottom: '10px'
                }}>
                  {meta.rating && parseFloat(meta.rating) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                      <Star size={13} fill="#f59e0b" color="#f59e0b" />
                      <span>{parseFloat(meta.rating).toFixed(1)}</span>
                    </div>
                  )}

                  {meta.releaseDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} color="#94a3b8" />
                      <span>{meta.releaseDate.substring(0, 4)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={12} color="var(--accent-bright)" />
                    <span>{seasons.length} {seasons.length === 1 ? 'Temporada' : 'Temporadas'}</span>
                  </div>
                </div>

                {/* Sinopse Curta e Botão Assistir */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                  <p style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    maxWidth: '620px',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    margin: 0
                  }}>
                    {meta.plot || series.plot || 'Sem sinopse disponível.'}
                  </p>

                  <button
                    onClick={handlePlayFirstEpisode}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      background: 'var(--accent-primary)',
                      color: 'var(--text-on-accent)',
                      fontSize: '12px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 0 16px var(--accent-subtle)',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <Play size={14} fill="var(--text-on-accent)" color="var(--text-on-accent)" />
                    Assistir T1:E1
                  </button>
                </div>
              </div>
            </div>

            {/* 2. SELETOR DE TEMPORADAS HORIZONTAL */}
            <div style={{
              padding: '10px 28px',
              background: '#070c14',
              borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              flexShrink: 0,
              scrollbarWidth: 'none'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginRight: '4px', flexShrink: 0 }}>
                Temporadas:
              </span>
              {seasons.length === 0 ? (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Temporada 1</span>
              ) : (
                seasons.map(s => {
                  const isSelected = selectedSeason === s.seasonNumber.toString();
                  return (
                    <button
                      key={s.seasonNumber}
                      onClick={() => setSelectedSeason(s.seasonNumber.toString())}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.03)',
                        color: isSelected ? 'var(--accent-bright)' : '#94a3b8',
                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: isSelected ? '0 0 12px var(--accent-subtle)' : 'none',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexShrink: 0,
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>{s.name}</span>
                      <span style={{
                        fontSize: '10px',
                        opacity: 0.75,
                        background: isSelected ? 'var(--accent-subtle)' : 'rgba(0, 0, 0, 0.35)',
                        padding: '1px 5px',
                        borderRadius: '4px'
                      }}>
                        {s.episodeCount}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* 3. GRADE DE EPISÓDIOS COM SCROLL VISÍVEL E GARANTIDO */}
            <div 
              className="visible-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                height: '100%',
                overflowY: 'scroll',
                padding: '20px 28px 40px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '16px',
                alignContent: 'flex-start'
              }}
            >
              {currentEpisodes.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8' }}>Nenhum episódio encontrado nesta temporada.</p>
                </div>
              ) : (
                currentEpisodes.map((ep, idx) => {
                  const epKey = ep.id || idx;
                  const isPlotOpen = expandedPlotEpId === epKey;
                  const hasPlot = Boolean(ep.plot && ep.plot.trim().length > 0);
                  const isLongPlot = Boolean(hasPlot && ep.plot.trim().length > 60);

                  const isCurrentPlaying = Boolean(
                    currentPlayingEpisode &&
                    (
                      currentPlayingEpisode.id === ep.id ||
                      currentPlayingEpisode.streamId === ep.streamId ||
                      currentPlayingEpisode.url === ep.url ||
                      (
                        parseInt(currentPlayingEpisode.episodeNum, 10) === parseInt(ep.episodeNum, 10) &&
                        String(currentPlayingEpisode.seasonNumber || '1') === String(ep.seasonNumber || selectedSeason)
                      )
                    )
                  );

                  return (
                    <div
                      key={epKey}
                      ref={isCurrentPlaying ? currentPlayingRef : null}
                      onClick={() => {
                        onPlayEpisode(ep, normalizedData);
                        onClose();
                      }}
                      style={{
                        background: isCurrentPlaying 
                          ? 'var(--accent-subtle)' 
                          : 'rgba(15, 23, 42, 0.75)',
                        border: isCurrentPlaying
                          ? '2px solid var(--accent-primary)'
                          : isPlotOpen ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.09)',
                        borderRadius: '12px',
                        overflow: isPlotOpen ? 'visible' : 'hidden',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '215px',
                        position: 'relative',
                        zIndex: isPlotOpen ? 40 : (isCurrentPlaying ? 10 : 1),
                        boxShadow: isCurrentPlaying ? '0 0 25px var(--accent-subtle)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isPlotOpen && !isCurrentPlaying) {
                          e.currentTarget.style.borderColor = 'var(--accent-primary)';
                          e.currentTarget.style.transform = 'translateY(-3px)';
                          e.currentTarget.style.boxShadow = '0 8px 24px var(--accent-subtle)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isPlotOpen && !isCurrentPlaying) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                    {/* Thumbnail Widescreen 16:9 com Fallback Sólido */}
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '16/9',
                      minHeight: '120px',
                      background: '#07090e',
                      overflow: 'hidden'
                    }}>
                      {/* Fallback de fundo caso a imagem não exista ou esteja carregando */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        color: '#64748b'
                      }}>
                        <Play size={28} color="var(--accent-primary)" />
                      </div>

                      {ep.image ? (
                        <img
                          src={ep.image}
                          alt={ep.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            zIndex: 1,
                            transition: 'opacity 0.2s ease'
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

                      {/* Botão Play Flutuante Central */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 2,
                        background: 'rgba(0, 0, 0, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 15px var(--accent-subtle)'
                        }}>
                          <Play size={16} fill="var(--text-on-accent)" color="var(--text-on-accent)" style={{ marginLeft: '2px' }} />
                        </div>
                      </div>

                      {/* Badge de Número do Episódio */}
                      <div style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        zIndex: 3,
                        background: 'var(--accent-primary)',
                        color: 'var(--text-on-accent)',
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        EP {ep.episodeNum}
                      </div>

                      {/* Badge ASSISTINDO AGORA (no canto superior direito) */}
                      {isCurrentPlaying && (
                        <div style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          zIndex: 4,
                          background: 'var(--accent-dark)',
                          color: '#ffffff',
                          fontSize: '9.5px',
                          fontWeight: '900',
                          padding: '2px 8px',
                          borderRadius: '5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 0 10px var(--accent-subtle)',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: 'var(--accent-bright)',
                            boxShadow: '0 0 5px var(--accent-bright)'
                          }} />
                          Assistindo
                        </div>
                      )}

                      {/* Barrinha Vermelha Estilo Netflix */}
                      <NetflixProgressBar progress={getProgress(ep)} height={4} />
                    </div>

                    {/* Detalhes do Episódio */}
                    <div style={{ padding: '10px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', minWidth: 0 }}>
                      {/* Título do Episódio: EPISÓDIO X */}
                      <h4 style={{
                        fontSize: '13.5px',
                        fontWeight: '800',
                        color: isCurrentPlaying ? 'var(--accent-bright)' : '#ffffff',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: '1.3'
                      }}>
                        {ep.title} {isCurrentPlaying && <span style={{ fontSize: '11px', color: 'var(--accent-bright)', fontWeight: '600' }}>(Assistindo)</span>}
                      </h4>

                      {/* Sinopse limitada a estritamente 2 linhas */}
                      <p style={{
                        fontSize: '11.5px',
                        color: '#cbd5e1',
                        lineHeight: '1.45',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        margin: 0
                      }}>
                        {ep.plot || `Temporada ${selectedSeason} • Episódio ${ep.episodeNum}`}
                      </p>

                      {/* Botão "ver mais..." (apenas se a sinopse for longa) */}
                      {isLongPlot && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedPlotEpId(isPlotOpen ? null : epKey);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-bright)',
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '3px 0 0',
                            cursor: 'pointer',
                            alignSelf: 'flex-start',
                            textDecoration: 'none'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                        >
                          {isPlotOpen ? 'ver menos' : 'ver mais...'}
                        </button>
                      )}
                    </div>

                    {/* Popover Flutuante com Sinopse Completa (Abre POR CIMA do card de baixo sem alterar a grade) */}
                    {isPlotOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          left: '-2px',
                          right: '-2px',
                          top: 'calc(100% + 4px)',
                          zIndex: 60,
                          background: 'rgba(11, 16, 26, 0.98)',
                          backdropFilter: 'blur(16px)',
                          border: '1px solid var(--border-accent)',
                          borderRadius: '12px',
                          padding: '14px 16px',
                          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.85), 0 0 25px var(--accent-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-bright)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Sinopse • {ep.title}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedPlotEpId(null);
                            }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: 'none',
                              color: '#cbd5e1',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
                          >
                            Fechar ✕
                          </button>
                        </div>

                        <div style={{
                          fontSize: '12px',
                          color: '#f1f5f9',
                          lineHeight: '1.6',
                          maxHeight: '170px',
                          overflowY: 'auto',
                          paddingRight: '6px'
                        }}>
                          {ep.plot}
                        </div>

                        <button
                          onClick={() => {
                            onPlayEpisode(ep, normalizedData);
                            onClose();
                          }}
                          style={{
                            marginTop: '12px',
                            width: '100%',
                            padding: '8px 0',
                            background: 'var(--accent-primary)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'var(--text-on-accent)',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 14px var(--accent-subtle)'
                          }}
                        >
                          <Play size={13} fill="var(--text-on-accent)" color="var(--text-on-accent)" /> Reproduzir Este Episódio
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SeriesModal;
