import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { saveVodProgress, getVodProgress } from '../utils/vodProgress';
import { isTemporaryChannel } from '../utils/streamUtils';
import { 
  Play, 
  Volume2, 
  VolumeX, 
  Settings, 
  Tv, 
  AlertCircle, 
  RotateCcw,
  ArrowLeft,
  Check,
  Sliders,
  X,
  Trash2,
  Radio
} from 'lucide-react';

// Estilo Sóbrio, Minimalista e Moderno do Player (Zero cores berrantes)
export const PLAYER_THEME = {
  accent: '#38bdf8',
  accentBg: 'rgba(56, 189, 248, 0.14)',
  accentBorder: 'rgba(56, 189, 248, 0.4)',
  panelBg: '#10141d',
  panelBorder: '#232936',
  timeBadgeBg: 'rgba(0, 0, 0, 0.55)',
  timeBadgeBorder: 'rgba(255, 255, 255, 0.12)',
  timeBadgeText: '#cbd5e1',
  progressBg: 'rgba(255, 255, 255, 0.2)',
  progressBar: '#38bdf8',
  controlsBg: 'linear-gradient(0deg, rgba(8, 11, 18, 0.96) 0%, rgba(8, 11, 18, 0.75) 55%, transparent 100%)',
  buttonHoverBg: 'rgba(255, 255, 255, 0.12)'
};

export function PlayerView({
  currentStream,
  onPreviousChannel,
  onNextChannel,
  enableProxy = true,
  isFullscreen,
  onToggleFullscreen,
  onOpenSettingsModal,
  onOpenEpisodes,
  onBackToCatalog,
  activeSeriesData = null,
  onPlayNextEpisode = null,
  onRemoveFromHistory = null,
  onBackToLive = null,
  isInHistory = false
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);
  const progressBarRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const hasRestoredProgressRef = useRef(false);
  const lastSavedProgressRef = useRef(0);
  const networkErrorCountRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);
  const hasStartedPlayingRef = useRef(false);
  const watchdogTimeoutRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isTemporaryEnded, setIsTemporaryEnded] = useState(false);
  const [hasRemovedHistory, setHasRemovedHistory] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFloatingDismissed, setIsFloatingDismissed] = useState(false);

  // 🔊 Web Audio API Booster Refs (Amplificador até 500%)
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const isAudioConnectedRef = useRef(false);

  // Estado da configuração de Super Volume (habilitado/desabilitado)
  const [isVolumeBoostEnabled, setIsVolumeBoostEnabled] = useState(() => {
    try {
      return localStorage.getItem('orizon_volume_boost') === 'true';
    } catch {
      return false;
    }
  });

  // 🔄 Sistema de Reconexão Automática contra Travamentos (Anti-Freeze Watchdog)
  const [reconnectKey, setReconnectKey] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showReconnectPrompt, setShowReconnectPrompt] = useState(false);
  const [stallSeconds, setStallSeconds] = useState(0);
  const stallSecondsRef = useRef(0);
  const lastPlaybackTimeRef = useRef(0);
  const reconnectResumeTimeRef = useRef(null);

  // Configurações de Auto-Reconexão
  const [isAutoReconnectEnabled, setIsAutoReconnectEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('orizon_auto_reconnect');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const [autoReconnectTimeout, setAutoReconnectTimeout] = useState(() => {
    try {
      const saved = localStorage.getItem('orizon_auto_reconnect_timeout');
      return saved ? parseInt(saved, 10) : 7;
    } catch {
      return 7;
    }
  });

  // Reseta dispensa do botão flutuante quando o stream mudar
  useEffect(() => {
    setIsFloatingDismissed(false);
  }, [currentStream?.id, currentStream?.url]);

  // Identifica o próximo episódio da série (mesma temporada ou próxima)
  const nextEpisodeInfo = useMemo(() => {
    if (!activeSeriesData || !activeSeriesData.episodesBySeason) return null;
    const curSeasonStr = (currentStream?.seasonNumber || activeSeriesData.selectedSeason || '1').toString();
    const epsBySeason = activeSeriesData.episodesBySeason;
    const curSeasonEps = epsBySeason[curSeasonStr] || [];

    const curIdx = curSeasonEps.findIndex(
      e => e.id === currentStream?.id || e.url === currentStream?.url || (e.episodeNum && currentStream?.episodeNum && e.episodeNum === currentStream.episodeNum)
    );

    // 1. Próximo episódio na mesma temporada
    if (curIdx !== -1 && curIdx < curSeasonEps.length - 1) {
      const nextEp = curSeasonEps[curIdx + 1];
      const epNum = nextEp.episodeNum || (curIdx + 2);
      return {
        episode: nextEp,
        seasonNumber: curSeasonStr,
        title: nextEp.title || `Episódio ${epNum}`,
        label: `T${curSeasonStr}:E${epNum}`,
        thumb: nextEp.image || activeSeriesData.series?.logo || ''
      };
    }

    // 2. Último da temporada atual -> primeiro da próxima temporada
    const seasonKeys = Object.keys(epsBySeason).map(s => parseInt(s, 10)).sort((a, b) => a - b);
    const currentSeasonNum = parseInt(curSeasonStr, 10);
    const nextSeasonNum = seasonKeys.find(n => n > currentSeasonNum);

    if (nextSeasonNum && epsBySeason[nextSeasonNum.toString()]?.length > 0) {
      const nextEp = epsBySeason[nextSeasonNum.toString()][0];
      const epNum = nextEp.episodeNum || 1;
      return {
        episode: nextEp,
        seasonNumber: nextSeasonNum.toString(),
        title: nextEp.title || `Episódio ${epNum}`,
        label: `T${nextSeasonNum}:E${epNum}`,
        thumb: nextEp.image || activeSeriesData.series?.logo || ''
      };
    }

    return null;
  }, [activeSeriesData, currentStream]);

  const handleNextEpisodeClick = () => {
    if (!nextEpisodeInfo) return;
    showToast(`Iniciando ${nextEpisodeInfo.label}...`);
    if (onPlayNextEpisode) {
      onPlayNextEpisode(nextEpisodeInfo.episode, nextEpisodeInfo.seasonNumber);
    } else if (onNextChannel) {
      onNextChannel();
    }
  };

  const currentPalette = PLAYER_THEME;

  // Toast discreto na tela de ações
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2200);
  };

  // Tempo real de reprodução do vídeo
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Exibe o card flutuante nos momentos finais do episódio (sem pulo automático - apenas aguarda o clique do usuário)
  const isNearEnd = Boolean(duration > 0 && currentTime >= Math.max(30, duration - 90));
  const showFloatingNext = Boolean(nextEpisodeInfo && isNearEnd && !isFloatingDismissed);

  // 🎛️ Configurações Exclusivas do Player (Qualidade, Proporção, Velocidade)
  const [isPlayerSettingsOpen, setIsPlayerSettingsOpen] = useState(false);
  const playerSettingsRef = useRef(null);

  // Fecha o popover de configurações do player ao clicar fora dele ou pressionar Escape
  useEffect(() => {
    if (!isPlayerSettingsOpen) return;

    const handleClickOutside = (e) => {
      if (playerSettingsRef.current && !playerSettingsRef.current.contains(e.target)) {
        setIsPlayerSettingsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPlayerSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlayerSettingsOpen]);

  const [aspectRatio, setAspectRatio] = useState('contain'); // 'contain' | 'cover' | 'fill'
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Qualidade selecionada dentro do player
  const [selectedQuality, setSelectedQuality] = useState(() => {
    return currentStream?.currentQuality || currentStream?.sources?.[0]?.quality || 'HD';
  });

  // Atualiza a qualidade ativa quando o canal selecionado mudar
  useEffect(() => {
    if (currentStream) {
      setSelectedQuality(currentStream.currentQuality || currentStream.sources?.[0]?.quality || 'HD');
      setIsPlayerSettingsOpen(false);
    }
  }, [currentStream?.id, currentStream?.baseName]);

  // Aplica a velocidade de reprodução no vídeo
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Encontra a fonte da qualidade ativa selecionada
  const activeSource = currentStream?.sources?.find(s => s.quality === selectedQuality) || currentStream?.sources?.[0];
  const activeUrl = activeSource?.url || currentStream?.url;

  const streamUrl = useMemo(() => {
    if (!activeUrl) return null;
    const cacheBuster = reconnectKey > 0 ? `_r=${reconnectKey}` : '';
    if (enableProxy) {
      const glue = activeUrl.includes('?') ? '&' : '?';
      const target = cacheBuster ? `${activeUrl}${glue}${cacheBuster}` : activeUrl;
      return `/api/stream?url=${encodeURIComponent(target)}`;
    }
    if (cacheBuster) {
      const glue = activeUrl.includes('?') ? '&' : '?';
      return `${activeUrl}${glue}${cacheBuster}`;
    }
    return activeUrl;
  }, [activeUrl, enableProxy, reconnectKey]);

  // Formata segundos em MM:SS ou HH:MM:SS
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds === Infinity || seconds <= 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Formatação estilizada do título igual ao print do navegador (ex: CHANNEL ZERO • TEMP. 1 • EP. 1)
  const formatMediaTitle = (stream) => {
    if (!stream || !stream.name) return 'ORIZON TV';
    let name = stream.name.trim();

    // Padrão de Séries: "Nome S01 E01" ou "Nome S1 E1" ou "Nome T01 E01"
    const seriesMatch = name.match(/^(.*?)\s*[-_•]?\s*[SsTt](\d{1,2})\s*[-_•]?\s*[Ee](\d{1,2})(.*)$/i);
    if (seriesMatch) {
      const showTitle = seriesMatch[1].trim();
      const seasonNum = parseInt(seriesMatch[2], 10);
      const epNum = parseInt(seriesMatch[3], 10);
      const extra = seriesMatch[4]?.replace(/^[\s\-:]+/, '').trim();
      return `${showTitle} • TEMP. ${seasonNum} • EP. ${epNum}${extra ? ` • ${extra}` : ''}`.toUpperCase();
    }

    // Padrão: "Nome Temp 1 Ep 1" ou "Nome Temporada 1 Episodio 1"
    const tempMatch = name.match(/^(.*?)\s*[-_•]?\s*Temp(?:orada)?\.?\s*(\d+)\s*[-_•]?\s*Ep(?:is[oó]dio)?\.?\s*(\d+)(.*)$/i);
    if (tempMatch) {
      const showTitle = tempMatch[1].trim();
      const seasonNum = parseInt(tempMatch[2], 10);
      const epNum = parseInt(tempMatch[3], 10);
      const extra = tempMatch[4]?.replace(/^[\s\-:]+/, '').trim();
      return `${showTitle} • TEMP. ${seasonNum} • EP. ${epNum}${extra ? ` • ${extra}` : ''}`.toUpperCase();
    }

    // Substitui separadores comuns por bullet estilizado
    return name.replace(/\s*[-–—|]\s*/g, ' • ').toUpperCase();
  };

  // Identifica se a transmissão é TV Ao Vivo (Live Stream) ou VOD (Filme / Série)
  const isLive = Boolean(
    currentStream?.type === 'live' ||
    currentStream?.isLive ||
    (!currentStream?.isEpisode && currentStream?.type !== 'series' && currentStream?.type !== 'movie' && !currentStream?.isVod && (
      currentStream?.url?.includes('/live/') ||
      currentStream?.url?.includes('.m3u8') ||
      duration === Infinity ||
      (!duration && currentStream?.category && !/filme|movie|vod|serie|série/i.test(currentStream.category))
    ))
  );

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    clearTimeout(watchdogTimeoutRef.current);
    networkErrorCountRef.current = 0;
    consecutiveErrorsRef.current = 0;
    hasStartedPlayingRef.current = false;
    setIsTemporaryEnded(false);
    setHasRemovedHistory(false);
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    // Se NÃO for uma reconexão preservando posição, zera os tempos
    if (reconnectResumeTimeRef.current === null) {
      setCurrentTime(0);
      setDuration(0);
      hasRestoredProgressRef.current = false;
      lastSavedProgressRef.current = 0;
    }

    const isTempStream = isTemporaryChannel(currentStream);

    // Watchdog ONLY for temporary streams (jogos ao vivo finalizados que o servidor trava na conexão inicial)
    if (isTempStream) {
      watchdogTimeoutRef.current = setTimeout(() => {
        if (!hasStartedPlayingRef.current && (!videoRef.current || videoRef.current.currentTime === 0)) {
          setIsTemporaryEnded(true);
          setHasError(true);
          setErrorMessage('Canal temporário ou evento já finalizado pelo servidor.');
          setIsLoading(false);
        }
      }, 15000);
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    const isHls = streamUrl.includes('.m3u8') || currentStream?.type === 'live';

    if (isHls && Hls.isSupported()) {
      // Parâmetros de alta estabilidade e buffer robusto para IPTV ao vivo
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 8,
        manifestLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 8,
        levelLoadingRetryDelay: 1000
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        clearTimeout(watchdogTimeoutRef.current);
        setIsLoading(false);
        setIsReconnecting(false);
        stallSecondsRef.current = 0;
        setStallSeconds(0);
        setShowReconnectPrompt(false);

        // Se acabou de reconectar e tínhamos ponto salvo de VOD, restaura!
        if (reconnectResumeTimeRef.current !== null && !isLive) {
          const resumePoint = reconnectResumeTimeRef.current;
          reconnectResumeTimeRef.current = null;
          try {
            video.currentTime = resumePoint;
            setCurrentTime(resumePoint);
            showToast(`Sinal reconectado! Continuando em ${formatTime(resumePoint)} ✅`);
          } catch {}
        } else if (reconnectKey > 0) {
          showToast(isLive ? 'Sinal reconectado ao vivo! 🟢' : 'Sinal reconectado com sucesso! ✅');
        }

        video.play().catch(() => setIsPlaying(false));
      });

      // Fragmento carregado com sucesso reseta qualquer erro prévio
      hls.on(Hls.Events.FRAG_LOADED, () => {
        consecutiveErrorsRef.current = 0;
        networkErrorCountRef.current = 0;
        setIsLoading(false);
        setIsReconnecting(false);
        setShowReconnectPrompt(false);
        stallSecondsRef.current = 0;
        setStallSeconds(0);
        setHasError(false);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        // Alerta quando o buffer do HLS entra em stall
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          setIsLoading(true);
          setShowReconnectPrompt(true);
        }

        // REGRA DE OURO: Se a transmissão JÁ ESTÁ EM ANDAMENTO (o usuário está assistindo),
        // NUNCA destrua o player! Faça auto-recuperação silenciosa com buffering!
        if (hasStartedPlayingRef.current || (video && video.currentTime > 0)) {
          setIsLoading(true);
          setHasError(false);

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setTimeout(() => {
                  if (hlsRef.current && videoRef.current) {
                    hlsRef.current.loadSource(streamUrl);
                    hlsRef.current.attachMedia(videoRef.current);
                  }
                }, 1500);
                break;
            }
          }
          return;
        }

        // Se AINDA NÃO COMEÇOU A TOCAR (fase de carregamento inicial):
        const isInitialManifest = data.details === 'manifestLoadError' || data.details === 'manifestParsingError';
        const httpCode = data.response?.code;
        const is404Or410 = httpCode === 404 || httpCode === 410 || httpCode === 403;

        // Se for canal temporário de jogo e o manifesto deu 404 logo de início:
        if (isTempStream && is404Or410 && isInitialManifest) {
          clearTimeout(watchdogTimeoutRef.current);
          setIsTemporaryEnded(true);
          hls.destroy();
          setHasError(true);
          setErrorMessage('Canal temporário encerrado pelo servidor.');
          setIsLoading(false);
          return;
        }

        if (data.fatal) {
          consecutiveErrorsRef.current++;
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Tenta até 6 vezes antes de desistir no carregamento inicial
              if (consecutiveErrorsRef.current < 6) {
                setTimeout(() => {
                  if (hlsRef.current) hlsRef.current.startLoad();
                }, 1000);
              } else {
                clearTimeout(watchdogTimeoutRef.current);
                if (isTempStream) setIsTemporaryEnded(true);
                hls.destroy();
                setHasError(true);
                setErrorMessage('Falha ao conectar com o sinal.');
                setIsLoading(false);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              if (consecutiveErrorsRef.current < 3) {
                setTimeout(() => {
                  if (hlsRef.current && videoRef.current) {
                    hlsRef.current.loadSource(streamUrl);
                    hlsRef.current.attachMedia(videoRef.current);
                  }
                }, 1500);
              } else {
                clearTimeout(watchdogTimeoutRef.current);
                if (isTempStream) setIsTemporaryEnded(true);
                hls.destroy();
                setHasError(true);
                setErrorMessage('Falha ao conectar com o sinal.');
                setIsLoading(false);
              }
              break;
          }
        }
      });

      hlsRef.current = hls;

    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      video.src = streamUrl;

      // Se reconectando com ponto de retomada em stream nativo MP4/MKV
      if (reconnectResumeTimeRef.current !== null && !isLive) {
        const resumePoint = reconnectResumeTimeRef.current;
        const handleOnceMeta = () => {
          try {
            video.currentTime = resumePoint;
            setCurrentTime(resumePoint);
            showToast(`Sinal reconectado! Continuando em ${formatTime(resumePoint)} ✅`);
          } catch {}
          reconnectResumeTimeRef.current = null;
        };
        video.addEventListener('loadedmetadata', handleOnceMeta, { once: true });
      }

      video.play().catch(() => setIsPlaying(false));
      setIsLoading(false);
      setIsReconnecting(false);
      setShowReconnectPrompt(false);
      stallSecondsRef.current = 0;
      setStallSeconds(0);
    } else {
      if (isTempStream) setIsTemporaryEnded(true);
      setHasError(true);
      setErrorMessage('Formato não suportado.');
      setIsLoading(false);
    }

    return () => {
      clearTimeout(watchdogTimeoutRef.current);
      if (video && !isLive && video.duration > 0 && video.currentTime >= 30) {
        saveVodProgress(currentStream, video.currentTime, video.duration);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [streamUrl, reconnectKey]);

  // Atualização em tempo real do progresso do vídeo
  const handleTimeUpdate = () => {
    if (!videoRef.current || isDragging) return;
    const cTime = videoRef.current.currentTime || 0;
    if (cTime > 0 && !hasStartedPlayingRef.current) {
      hasStartedPlayingRef.current = true;
      clearTimeout(watchdogTimeoutRef.current);
      consecutiveErrorsRef.current = 0;
      setHasError(false);
    }
    setCurrentTime(cTime);

    // Salva o progresso a cada 4 segundos se for Filme ou Série e tiver assistido >= 30s
    if (!isLive && duration > 0 && Math.abs(cTime - lastSavedProgressRef.current) >= 4) {
      lastSavedProgressRef.current = cTime;
      saveVodProgress(currentStream, cTime, duration);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const d = videoRef.current.duration;
    if (d && !isNaN(d) && d !== Infinity) {
      setDuration(d);

      // Restaura automaticamente onde parou se for Filme ou Série e tiver progresso salvo >= 30s
      if (!hasRestoredProgressRef.current && !isLive) {
        const saved = getVodProgress(currentStream);
        if (saved && saved.currentTime >= 30 && saved.currentTime < (d - 15)) {
          hasRestoredProgressRef.current = true;
          videoRef.current.currentTime = saved.currentTime;
          setCurrentTime(saved.currentTime);
          showToast(`Continuando de onde parou (${formatTime(saved.currentTime)})`);
        }
      }
    } else {
      setDuration(0);
    }
  };

  // Ocultar controles automaticamente com inatividade do mouse (otimizado sem re-renders contínuos)
  const handleMouseMove = useCallback(() => {
    setShowControls(prev => (prev ? prev : true));
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 4000);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    handleMouseMove();
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        showToast('Reproduzindo ▶');
      }).catch(() => {
        setIsPlaying(false);
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      showToast('Pausado ⏸');
    }
  };

  // Clique simples: em TV Ao Vivo alterna Mudo/Desmudo (para não parar a transmissão); em VOD pausa/reproduz. Clique duplo: tela cheia
  const handleVideoClick = (e) => {
    // Ignora cliques que sejam em controles, botões ou inputs
    if (e.target.closest('.player-controls-container') || e.target.closest('button') || e.target.closest('input')) {
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      if (onToggleFullscreen) onToggleFullscreen();
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        if (isLive) {
          toggleMute();
        } else {
          togglePlay();
        }
      }, 240);
    }
  };

  // Troca de qualidade/resolução (4K, FHD, HD, SD)
  const handleQualityChange = (newQual) => {
    if (newQual === selectedQuality) {
      setIsPlayerSettingsOpen(false);
      return;
    }
    const prevTime = videoRef.current ? videoRef.current.currentTime : 0;
    setSelectedQuality(newQual);
    setIsPlayerSettingsOpen(false);

    // Se for VOD / Filme / Série, restaura o tempo após carregar
    if (prevTime > 0 && !isLive) {
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = prevTime;
        }
      }, 400);
    }
  };

  // Sincroniza configurações de Super Volume e Auto-Reconexão com o backend e eventos
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (typeof data.enableVolumeBoost !== 'undefined') {
            const enabled = Boolean(data.enableVolumeBoost);
            setIsVolumeBoostEnabled(enabled);
            try {
              localStorage.setItem('orizon_volume_boost', String(enabled));
            } catch {}
          }
          if (typeof data.autoReconnectOnFreeze !== 'undefined') {
            const autoRec = Boolean(data.autoReconnectOnFreeze);
            setIsAutoReconnectEnabled(autoRec);
            try {
              localStorage.setItem('orizon_auto_reconnect', String(autoRec));
            } catch {}
          }
          if (typeof data.autoReconnectTimeout !== 'undefined') {
            const timeoutVal = parseInt(data.autoReconnectTimeout, 10) || 7;
            setAutoReconnectTimeout(timeoutVal);
            try {
              localStorage.setItem('orizon_auto_reconnect_timeout', String(timeoutVal));
            } catch {}
          }
        }
      })
      .catch(() => {});

    const handleSettingChange = (e) => {
      if (!e.detail) return;
      if (e.detail.key === 'enableVolumeBoost') {
        const enabled = Boolean(e.detail.value);
        setIsVolumeBoostEnabled(enabled);
        if (!enabled && volume > 1.0) {
          applyVolume(1.0, isMuted);
          setVolume(1.0);
          showToast('Super Volume desativado (Volume ajustado para 100%)');
        }
      } else if (e.detail.key === 'autoReconnectOnFreeze') {
        const enabled = Boolean(e.detail.value);
        setIsAutoReconnectEnabled(enabled);
        try {
          localStorage.setItem('orizon_auto_reconnect', String(enabled));
        } catch {}
        showToast(enabled ? 'Auto-Reconexão contra Travamentos: Ativada' : 'Auto-Reconexão contra Travamentos: Desativada');
      } else if (e.detail.key === 'autoReconnectTimeout') {
        const val = parseInt(e.detail.value, 10) || 7;
        setAutoReconnectTimeout(val);
        try {
          localStorage.setItem('orizon_auto_reconnect_timeout', String(val));
        } catch {}
      }
    };

    window.addEventListener('orizon:setting-changed', handleSettingChange);
    return () => window.removeEventListener('orizon:setting-changed', handleSettingChange);
  }, [volume, isMuted]);

  // Inicializa o grafo Web Audio API para amplificar o som além de 100%
  const ensureAudioGraph = () => {
    if (!videoRef.current || isAudioConnectedRef.current) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtxClass();
      }
      const ctx = audioCtxRef.current;

      if (!sourceNodeRef.current) {
        sourceNodeRef.current = ctx.createMediaElementSource(videoRef.current);
      }
      if (!gainNodeRef.current) {
        gainNodeRef.current = ctx.createGain();
      }

      sourceNodeRef.current.disconnect();
      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);

      isAudioConnectedRef.current = true;
    } catch (err) {
      console.warn('[AudioBooster] Web Audio não pôde ser inicializado:', err);
    }
  };

  // Aplica o ganho e o volume no elemento de vídeo e no nó de ganho Web Audio
  const applyVolume = (val, muted = isMuted) => {
    const v = videoRef.current;
    if (!v) return;

    if (muted || val === 0) {
      v.muted = true;
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = 0;
      }
      return;
    }

    v.muted = false;

    if (val > 1.0) {
      ensureAudioGraph();
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      v.volume = 1.0;
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = val;
      }
    } else {
      v.volume = val;
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = 1.0;
      }
    }
  };

  // Alterna o recurso de Super Volume (até 500%)
  const toggleVolumeBoost = (enabled) => {
    setIsVolumeBoostEnabled(enabled);
    try {
      localStorage.setItem('orizon_volume_boost', String(enabled));
      window.dispatchEvent(new CustomEvent('orizon:setting-changed', { detail: { key: 'enableVolumeBoost', value: enabled } }));
    } catch {}

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enableVolumeBoost: enabled })
    }).catch(() => {});

    if (!enabled && volume > 1.0) {
      applyVolume(1.0, isMuted);
      setVolume(1.0);
      showToast('Super Volume desativado (Volume ajustado para 100%) 🔉');
    } else if (enabled) {
      showToast('Super Volume ativado! Barra liberada até 500% ⚡');
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    handleMouseMove();
    if (isMuted || volume === 0) {
      const targetVol = volume > 0 ? volume : 1.0;
      setIsMuted(false);
      setVolume(targetVol);
      applyVolume(targetVol, false);
      const percent = Math.round(targetVol * 100);
      showToast(`Som ativado (${percent}%) 🔊`);
    } else {
      setIsMuted(true);
      applyVolume(volume, true);
      showToast('Mudo 🔇');
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    applyVolume(val, val === 0);
    setIsMuted(val === 0);
  };

  // Ajuste fino de volume pelo teclado (Seta Cima / Seta Baixo)
  const changeVolume = (delta) => {
    if (!videoRef.current) return;
    handleMouseMove();
    const maxVol = isVolumeBoostEnabled ? 5.0 : 1.0;
    const currentBase = isMuted ? 0 : volume;
    let newVol = Math.round((currentBase + delta) * 10) / 10;
    newVol = Math.max(0, Math.min(maxVol, newVol));

    setVolume(newVol);
    applyVolume(newVol, newVol === 0);

    if (newVol === 0) {
      setIsMuted(true);
      showToast('Mudo 🔇');
    } else {
      setIsMuted(false);
      const percent = Math.round(newVol * 100);
      let toastIcon = '🔉';
      let toastLabel = `Volume: ${percent}%`;
      if (percent >= 401) {
        toastIcon = '🔥 🚨';
        toastLabel = `Super Volume Máximo: ${percent}%`;
      } else if (percent >= 250) {
        toastIcon = '⚡ ⚠️';
        toastLabel = `Super Volume Alto: ${percent}%`;
      } else if (percent > 100) {
        toastIcon = '⚡';
        toastLabel = `Super Volume: ${percent}%`;
      } else if (percent > 50) {
        toastIcon = '🔊';
      }
      showToast(`${toastLabel} ${toastIcon}`);
    }
  };

  // Seek / Scrubbing na barra de progresso
  const handleSeekFromEvent = (e) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (duration > 0) {
      const targetTime = pos * duration;
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleProgressBarMouseDown = (e) => {
    setIsDragging(true);
    handleSeekFromEvent(e);

    const onMouseMove = (moveEvent) => {
      handleSeekFromEvent(moveEvent);
    };

    const onMouseUp = (upEvent) => {
      setIsDragging(false);
      handleSeekFromEvent(upEvent);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const skipSeconds = (seconds) => {
    if (!videoRef.current) return;
    handleMouseMove();
    const v = videoRef.current;
    const d = duration || v.duration || 0;
    if (d > 0 && !isNaN(d) && d !== Infinity) {
      const targetTime = Math.max(0, Math.min(d, v.currentTime + seconds));
      v.currentTime = targetTime;
      setCurrentTime(targetTime);
      showToast(seconds > 0 ? `+${seconds}s ⏩` : `${seconds}s ⏪`);
    } else {
      // Para transmissões ao vivo onde não há seek temporal fixo
      if (seconds < 0 && onPreviousChannel) {
        onPreviousChannel();
      } else if (seconds > 0 && onNextChannel) {
        onNextChannel();
      }
    }
  };

  // 🔄 Dispara a Reconexão Completa do Sinal (com preservação de tempo para VOD)
  const triggerFullReconnect = useCallback((isManual = false) => {
    const video = videoRef.current;
    const curTime = video ? video.currentTime : 0;

    // Se for Filme ou Série (VOD), preserva o ponto exato onde travou
    if (!isLive && curTime > 0) {
      reconnectResumeTimeRef.current = curTime;
    } else {
      reconnectResumeTimeRef.current = null;
    }

    setIsReconnecting(true);
    setIsLoading(true);
    setHasError(false);
    stallSecondsRef.current = 0;
    setStallSeconds(0);

    showToast(isManual ? 'Reconectando sinal manualmente... 🔄' : 'Sinal instável. Reconectando transmissão... 🔄');

    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
      } catch {}
    }

    // Força reinicialização limpa incrementando a chave
    setReconnectKey(prev => prev + 1);
  }, [isLive]);

  // 🔄 Monitor Ativo de Congelamento (Smart Freeze Watchdog)
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !streamUrl || hasError || isDragging) {
        stallSecondsRef.current = 0;
        setStallSeconds(0);
        setShowReconnectPrompt(false);
        return;
      }

      // Se o usuário pausou o vídeo intencionalmente, não é travamento!
      if (video.paused) {
        stallSecondsRef.current = 0;
        setStallSeconds(0);
        setShowReconnectPrompt(false);
        lastPlaybackTimeRef.current = video.currentTime;
        return;
      }

      // Verifica se o vídeo está congelado:
      // 1. isLoading é true (em buffering contínuo)
      // OU 2. o currentTime não mudou desde o último segundo (diferença < 0.08s) mesmo sem estar pausado
      const curTime = video.currentTime || 0;
      const timeDiff = Math.abs(curTime - lastPlaybackTimeRef.current);
      const isTimeFrozen = timeDiff < 0.08;
      const isStalled = isLoading || isTimeFrozen;

      if (isStalled) {
        stallSecondsRef.current += 1;
        const currentStall = stallSecondsRef.current;
        setStallSeconds(currentStall);

        // Aos 3 segundos de travamento contínuo: exibe botão flutuante e atalho (R)
        if (currentStall >= 3) {
          setShowReconnectPrompt(true);
        }

        // Se auto-reconexão estiver habilitada:
        if (isAutoReconnectEnabled) {
          // Nível 1: Aos 4 segundos -> Tenta Nudge suave / Recuperação do HLS
          if (currentStall === 4) {
            if (hlsRef.current) {
              try {
                hlsRef.current.recoverMediaError();
              } catch {}
            }
            if (video && video.currentTime > 0) {
              try {
                video.currentTime += 0.25;
              } catch {}
            }
          }

          // Nível 2 / 3: Ao atingir o tempo configurado (ex: 7 segundos) -> Reconexão completa
          if (currentStall >= autoReconnectTimeout && !isReconnecting) {
            triggerFullReconnect(false);
          }
        }
      } else {
        // Vídeo está tocando perfeitamente: zera contadores
        if (stallSecondsRef.current > 0) {
          stallSecondsRef.current = 0;
          setStallSeconds(0);
          setShowReconnectPrompt(false);
          setIsReconnecting(false);
        }
        lastPlaybackTimeRef.current = curTime;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [streamUrl, hasError, isDragging, isLoading, isAutoReconnectEnabled, autoReconnectTimeout, isReconnecting, triggerFullReconnect]);

  // ⌨️ CONTROLES GLOBAIS DE TECLADO NO PLAYER (M, Espaço, Setas Direita/Esquerda 10s, Cima/Baixo Volume, F, R)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignora APENAS se o foco estiver em campos de digitação de texto (evita travar atalhos ao clicar em botões ou slider)
      const targetTag = e.target?.tagName || '';
      const isInput = targetTag === 'INPUT';
      const isTextInput = isInput && ['text', 'search', 'password', 'email', 'number', 'tel', 'url'].includes(e.target.type);
      const isSelect = targetTag === 'SELECT';
      if (targetTag === 'TEXTAREA' || isTextInput || isSelect || e.target?.isContentEditable) {
        return;
      }

      // Tecla M / m: Mutar / Desmutar
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        e.stopPropagation();
        toggleMute();
        return;
      }

      // Seta Direita ou Tecla L: Avançar 10 segundos (+10s)
      if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        e.stopPropagation();
        skipSeconds(10);
        return;
      }

      // Seta Esquerda ou Tecla J: Retroceder 10 segundos (-10s)
      if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        e.stopPropagation();
        skipSeconds(-10);
        return;
      }

      // Seta para Cima: Aumentar volume (+10%)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        changeVolume(0.1);
        return;
      }

      // Seta para Baixo: Diminuir volume (-10%)
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        changeVolume(-0.1);
        return;
      }

      // Barra de Espaço ou Tecla K: em TV Ao Vivo alterna Mudo/Desmudo (para não pausar o fluxo); em VOD pausa/reproduz
      if (e.key === ' ' || e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        e.stopPropagation();
        if (isLive) {
          toggleMute();
        } else {
          togglePlay();
        }
        return;
      }

      // Tecla F: Tela Cheia
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        e.stopPropagation();
        if (onToggleFullscreen) onToggleFullscreen();
        return;
      }

      // Tecla R / r: Reconectar Sinal Imediatamente (útil quando travar ou congelar)
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        e.stopPropagation();
        triggerFullReconnect(true);
        return;
      }

      // Tecla N ou Shift + Seta Direita: Próximo Episódio (se for série)
      if ((e.key === 'n' || e.key === 'N' || (e.shiftKey && e.key === 'ArrowRight')) && nextEpisodeInfo) {
        e.preventDefault();
        e.stopPropagation();
        handleNextEpisodeClick();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [volume, isMuted, isVolumeBoostEnabled, duration, isLive, onPreviousChannel, onNextChannel, onToggleFullscreen, nextEpisodeInfo, triggerFullReconnect]);

  const togglePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    }
  };

  const reloadStream = () => {
    triggerFullReconnect(true);
  };

  if (!currentStream) {
    return (
      <div style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#07090e',
        color: '#64748b',
        gap: '16px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Tv size={38} color="#10b981" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: '800', marginBottom: '6px' }}>
            Nenhum Conteúdo Selecionado
          </h3>
          <p style={{ fontSize: '13px', maxWidth: '340px', color: '#94a3b8' }}>
            Selecione um canal, filme ou série na barra lateral para começar a assistir.
          </p>
        </div>
      </div>
    );
  }

  // Estilo padronizado rígido para todos os botões de controle (evita qualquer layout shift ao pausar/clicar)
  const controlBtnStyle = {
    width: '36px',
    height: '36px',
    minWidth: '36px',
    minHeight: '36px',
    maxWidth: '36px',
    maxHeight: '36px',
    flexShrink: 0,
    padding: 0,
    margin: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxSizing: 'border-box',
    borderRadius: '6px'
  };

  // Cálculo da porcentagem do progresso (0% quando não há duração definida)
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div 
      id="orizon-player-container"
      ref={containerRef}
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onClick={handleVideoClick}
      onMouseDown={(e) => {
        // Assegura foco no player ao clicar na área do vídeo ou controles
        if (containerRef.current && e.target.tagName !== 'INPUT') {
          containerRef.current.focus({ preventScroll: true });
        }
      }}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        background: '#000000',
        overflow: 'hidden',
        userSelect: 'none',
        outline: 'none',
        cursor: showControls ? 'default' : 'none',
        borderRadius: isFullscreen ? 0 : '18px',
        border: isFullscreen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isFullscreen ? 'none' : '0 12px 36px rgba(0, 0, 0, 0.55)'
      }}
    >
      {/* Elemento de Vídeo */}
      <video
        ref={videoRef}
        onPlay={() => {
          clearTimeout(watchdogTimeoutRef.current);
          hasStartedPlayingRef.current = true;
          consecutiveErrorsRef.current = 0;
          setIsPlaying(true);
          setHasError(false);
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().catch(() => {});
          }
          if (volume > 1.0 && gainNodeRef.current) {
            gainNodeRef.current.gain.value = volume;
          }
        }}
        onPause={() => {
          setIsPlaying(false);
          if (!isLive && videoRef.current && duration > 0 && videoRef.current.currentTime >= 30) {
            saveVodProgress(currentStream, videoRef.current.currentTime, duration);
          }
        }}
        onWaiting={() => {
          setIsLoading(true);
        }}
        onPlaying={() => {
          clearTimeout(watchdogTimeoutRef.current);
          hasStartedPlayingRef.current = true;
          consecutiveErrorsRef.current = 0;
          setIsLoading(false);
          setIsReconnecting(false);
          setShowReconnectPrompt(false);
          stallSecondsRef.current = 0;
          setStallSeconds(0);
          setHasError(false);
        }}
        onError={() => {
          // Se o HLS estiver ativo ou a transmissão já começou, o HLS trata a recuperação em background. Não derrube a tela!
          if (!hlsRef.current && !hasStartedPlayingRef.current) {
            clearTimeout(watchdogTimeoutRef.current);
            if (isTemporaryChannel(currentStream)) {
              setIsTemporaryEnded(true);
            }
            setHasError(true);
            setIsLoading(false);
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        style={{
          width: '100%',
          height: '100%',
          objectFit: aspectRatio || 'contain',
          display: 'block'
        }}
        playsInline
      />

      {/* Toast de Confirmação da Paleta */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: currentPalette.panelBg,
          border: `1px solid ${currentPalette.panelBorder}`,
          color: '#ffffff',
          padding: '8px 18px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)',
          zIndex: 50,
          pointerEvents: 'none'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: currentPalette.accent, flexShrink: 0 }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Spinner Circular Central e Botão de Reconexão Rápida */}
      {isLoading && !hasError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: 'transparent',
          zIndex: 20,
          pointerEvents: 'none'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.12)',
            borderTopColor: currentPalette.accent,
            animation: 'spin 0.8s linear infinite'
          }} />

          {/* Botão de Reconexão Rápida quando travar por >3s ou estiver reconectando */}
          {(showReconnectPrompt || isReconnecting) && (
            <div style={{
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFullReconnect(true);
                }}
                disabled={isReconnecting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 16px',
                  borderRadius: '100px',
                  background: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: `1px solid ${currentPalette.accent}80`,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: isReconnecting ? 'wait' : 'pointer',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 16px rgba(56, 189, 248, 0.2)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isReconnecting) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.borderColor = currentPalette.accent;
                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.98)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = `${currentPalette.accent}80`;
                  e.currentTarget.style.background = 'rgba(15, 23, 42, 0.88)';
                }}
                title="Forçar reconexão do canal ou stream (Atalho: Tecla R)"
              >
                <RotateCcw 
                  size={14} 
                  color={currentPalette.accent}
                  style={{
                    animation: isReconnecting ? 'spin 1s linear infinite' : 'none'
                  }} 
                />
                <span>{isReconnecting ? 'Reconectando...' : 'Reconectar Sinal'}</span>
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.14)',
                  color: '#cbd5e1',
                  fontFamily: 'monospace',
                  fontWeight: '800',
                  marginLeft: '2px'
                }}>
                  R
                </span>
              </button>

              {isAutoReconnectEnabled && !isReconnecting && (
                <span style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  fontWeight: '500',
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)'
                }}>
                  Auto-reconexão ativa ({Math.max(0, autoReconnectTimeout - stallSeconds)}s)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Overlay Inteligente de Erro e Canais Temporários/Retirados */}
      {hasError && (() => {
        const isTemp = isTemporaryEnded || isTemporaryChannel(currentStream);
        const streamName = currentStream?.name || currentStream?.title || 'Transmissão';

        return (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.95) 0%, #07090e 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            gap: '18px',
            color: '#ffffff',
            zIndex: 25,
            textAlign: 'center'
          }}>
            {/* Ícone Informativo */}
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '20px',
              background: isTemp ? 'rgba(245, 158, 11, 0.12)' : 'rgba(244, 63, 94, 0.12)',
              border: isTemp ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(244, 63, 94, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isTemp ? '0 0 30px rgba(245, 158, 11, 0.15)' : '0 0 30px rgba(244, 63, 94, 0.15)'
            }}>
              {isTemp ? <Radio size={34} color="#fbbf24" /> : <AlertCircle size={34} color="#f43f5e" />}
            </div>

            {/* Badge de Status */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 12px',
              borderRadius: '100px',
              background: isTemp ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              border: isTemp ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(244, 63, 94, 0.35)',
              color: isTemp ? '#fbbf24' : '#fda4af',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isTemp ? '#fbbf24' : '#f43f5e' }} />
              {isTemp ? 'Transmissão Temporária Encerrada' : 'Canal Fora do Ar ou Retirado'}
            </div>

            {/* Título */}
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: '2px 0 0 0' }}>
              {isTemp ? 'Evento ou Jogo Finalizado' : 'Não foi possível reproduzir este sinal'}
            </h3>

            {/* Texto Descritivo */}
            <p style={{
              fontSize: '13px',
              color: '#94a3b8',
              maxWidth: '480px',
              lineHeight: '1.6',
              margin: 0
            }}>
              {isTemp ? (
                <>
                  O canal <strong style={{ color: '#f1f5f9' }}>"{streamName}"</strong> era uma transmissão temporária (jogo ao vivo ou evento especial) que já foi concluída e retirada do servidor da lista.
                </>
              ) : (
                <>
                  O sinal de <strong style={{ color: '#f1f5f9' }}>"{streamName}"</strong> está temporariamente sem resposta ou pode ter sido retirado da grade pelo provedor de IPTV.
                </>
              )}
            </p>

            {/* Botoeira de Ações */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '10px',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {/* Botão de Remover do Histórico */}
              {onRemoveFromHistory && (
                <button
                  onClick={() => {
                    onRemoveFromHistory(currentStream);
                    setHasRemovedHistory(true);
                    if (onBackToLive) {
                      setTimeout(() => onBackToLive(), 500);
                    }
                  }}
                  disabled={hasRemovedHistory}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    background: hasRemovedHistory ? 'rgba(34, 197, 94, 0.16)' : 'rgba(239, 68, 68, 0.18)',
                    border: hasRemovedHistory ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.45)',
                    color: hasRemovedHistory ? '#4ade80' : '#fca5a5',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: hasRemovedHistory ? 'default' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="Remove este canal do seu histórico recente"
                >
                  {hasRemovedHistory ? <Check size={16} /> : <Trash2 size={16} />}
                  <span>{hasRemovedHistory ? 'Removido do Histórico' : 'Remover do Histórico'}</span>
                </button>
              )}

              {/* Botão de Voltar para TV Ao Vivo */}
              {onBackToLive && (
                <button
                  onClick={onBackToLive}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    background: currentPalette.accent,
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  <Tv size={16} />
                  <span>Voltar para TV Ao Vivo</span>
                </button>
              )}

              {/* Botão de Tentar Novamente */}
              <button
                onClick={reloadStream}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <RotateCcw size={15} />
                <span>Tentar Novamente</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Faixa Superior de Arrasto da Janela no Modo Janela (Electron) */}
      {!isFullscreen && (
        <div 
          className="app-drag-region"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: '150px',
            height: '38px',
            zIndex: 32,
            pointerEvents: 'auto'
          }}
        />
      )}

      {/* Botão Superior para Voltar ao Catálogo (Filmes / Séries) */}
      {!isLive && onBackToCatalog && (
        <button
          onClick={() => {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
              if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
              else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
            onBackToCatalog();
          }}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 35,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '8px',
            background: currentPalette.panelBg,
            border: `1px solid ${currentPalette.panelBorder}`,
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.6)',
            opacity: showControls ? 1 : 0,
            transform: showControls ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'all 0.25s ease',
            pointerEvents: showControls ? 'auto' : 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = currentPalette.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = currentPalette.panelBorder;
          }}
          title="Voltar ao Catálogo"
        >
          <ArrowLeft size={16} />
          <span>Voltar ao Catálogo</span>
        </button>
      )}

      {/* Barra de Controles Inferior (Idêntica ao print da versão de navegador) */}
      <div 
        className="player-controls-container"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 28px 18px',
          background: currentPalette.controlsBg,
          display: 'flex',
          flexDirection: 'column',
        gap: '6px',
        opacity: showControls ? 1 : 0,
        transform: showControls ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.25s ease',
        zIndex: 30,
        pointerEvents: showControls ? 'auto' : 'none'
      }}>
        {/* 1. LINHA DA BARRA DE PROGRESSO COM BADGES DE TEMPO (Apenas Filmes/Séries - Oculto em Canais Ao Vivo) */}
        {!isLive && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              width: '100%'
            }}>
              {/* Lado Esquerdo: Badge Tempo Atual */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                width: '58px',
                minWidth: '58px',
                flexShrink: 0
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: currentPalette.timeBadgeText,
                  background: currentPalette.timeBadgeBg,
                  border: `1px solid ${currentPalette.timeBadgeBorder}`,
                  padding: '2px 0',
                  borderRadius: '6px',
                  textAlign: 'center',
                  width: '100%',
                  letterSpacing: '0.5px'
                }}>
                  {formatTime(currentTime)}
                </div>
              </div>

              {/* Barra de Progresso Sólida Fosca (Zero neon) */}
              <div
                ref={progressBarRef}
                onMouseDown={handleProgressBarMouseDown}
                style={{
                  flex: 1,
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {/* Trilho de Fundo */}
                <div style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '9999px',
                  background: currentPalette.progressBg,
                  position: 'relative',
                  overflow: 'visible'
                }}>
                  {/* Barra Preenchida com Cor da Paleta Sólida (Zero neon glow) */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${progressPercent}%`,
                    borderRadius: '9999px',
                    background: currentPalette.progressBar
                  }} />

                  {/* Scrubber Handle Redondo Branco */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: `${progressPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.7)',
                    cursor: 'pointer',
                    transition: isDragging ? 'none' : 'transform 0.1s ease',
                    zIndex: 2
                  }} />
                </div>
              </div>

              {/* Lado Direito: Badge Tempo Total */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                width: '58px',
                minWidth: '58px',
                flexShrink: 0
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: currentPalette.timeBadgeText,
                  background: currentPalette.timeBadgeBg,
                  border: `1px solid ${currentPalette.timeBadgeBorder}`,
                  padding: '2px 0',
                  borderRadius: '6px',
                  textAlign: 'center',
                  width: '100%',
                  letterSpacing: '0.5px'
                }}>
                  {duration > 0 ? formatTime(duration) : '00:00'}
                </div>
              </div>
            </div>
          </>
        )}

        {/* 2. LINHA DE BOTÕES DE CONTROLE E TÍTULO CENTRAL (TOTALMENTE FIXOS SEM LAYOUT SHIFT) */}
        <div 
          onMouseDown={(e) => {
            // Previne perda de foco do teclado ao clicar nos botões de controle
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
              e.preventDefault();
              containerRef.current?.focus({ preventScroll: true });
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            position: 'relative',
            minHeight: '40px'
          }}
        >
          {/* LADO ESQUERDO: Play/Pause, Volume, e opcionalmente SkipBack/Forward se não for live */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            zIndex: 2
          }}>
            {/* Botão Voltar 10s (-10s) com ícone circular moderno e o número 10 gravado */}
            {!isLive && (
              <button
                onClick={() => skipSeconds(-10)}
                style={{
                  ...controlBtnStyle,
                  color: '#cbd5e1',
                  transition: 'all 0.18s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#cbd5e1';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Voltar 10s (Seta Esquerda ou J)"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="currentColor" stroke="none" fontFamily="system-ui, -apple-system, sans-serif">10</text>
                </svg>
              </button>
            )}

            {/* Botão Play / Pause (Maior, circular de 42px, neutro e elegante sem cores chamativas) */}
            <button
              onClick={togglePlay}
              style={{
                width: '42px',
                height: '42px',
                minWidth: '42px',
                minHeight: '42px',
                borderRadius: '50%',
                background: isPlaying ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.22)',
                border: isPlaying ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(255, 255, 255, 0.35)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = isPlaying ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.22)';
              }}
              title={isLive ? (isMuted ? 'Desmutar (Espaço)' : 'Mutar (Espaço)') : (isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)')}
            >
              {isPlaying ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" style={{ display: 'block' }}>
                  <rect x="5.5" y="4" width="4.5" height="16" rx="1.5" />
                  <rect x="14" y="4" width="4.5" height="16" rx="1.5" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" style={{ display: 'block', marginLeft: '2px' }}>
                  <path d="M6.5 4.8a1.2 1.2 0 0 1 1.8-1.04l11.5 7.2a1.2 1.2 0 0 1 0 2.08l-11.5 7.2A1.2 1.2 0 0 1 6.5 19.2V4.8z" />
                </svg>
              )}
            </button>

            {/* Botão Avançar 10s (+10s) com ícone circular moderno e o número 10 gravado */}
            {!isLive && (
              <button
                onClick={() => skipSeconds(10)}
                style={{
                  ...controlBtnStyle,
                  color: '#cbd5e1',
                  transition: 'all 0.18s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#cbd5e1';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Avançar 10s (Seta Direita ou L)"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="currentColor" stroke="none" fontFamily="system-ui, -apple-system, sans-serif">10</text>
                </svg>
              </button>
            )}

            {/* Botão Próximo Episódio (⏭) Fixo na Barra (visível em séries) */}
            {nextEpisodeInfo && (
              <button
                onClick={handleNextEpisodeClick}
                style={{
                  ...controlBtnStyle,
                  color: '#cbd5e1',
                  transition: 'all 0.18s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'scale(1.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#cbd5e1';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={`Próximo Episódio: ${nextEpisodeInfo.label} • ${nextEpisodeInfo.title} (Tecla N)`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                  <path d="M5.5 5.2a1 1 0 0 0-1.5.86v11.88a1 1 0 0 0 1.5.86l8.8-5.94a1 1 0 0 0 0-1.72L5.5 5.2z"/>
                  <rect x="17" y="5" width="2.5" height="14" rx="1.2"/>
                </svg>
              </button>
            )}

            {/* Ícone de Volume */}
            <button
              onClick={toggleMute}
              style={{
                ...controlBtnStyle,
                color: '#ffffff'
              }}
              title="Mutar (M)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={20} color="#ffffff" style={{ display: 'block' }} />
              ) : (
                <Volume2 size={20} color="#ffffff" style={{ display: 'block' }} />
              )}
            </button>

            {/* Slider de Volume com Largura Aumentada e Cores Dinâmicas (Normal, Amarelo 250-400%, Vermelho 500%) */}
            {(() => {
              const maxVol = isVolumeBoostEnabled ? 5.0 : 1.0;
              const currentVol = isMuted ? 0 : volume;
              const volPercent = Math.round(currentVol * 100);
              const fillPercent = Math.min(100, Math.max(0, (currentVol / maxVol) * 100));

              let volumeColor = currentPalette.accent || '#38bdf8';
              let volumeShadow = 'none';
              let boostClass = '';

              if (volPercent >= 250 && volPercent <= 400) {
                volumeColor = '#facc15'; // Amarelo vibrante
                volumeShadow = '0 0 8px rgba(250, 204, 21, 0.75)';
                boostClass = 'boost-high';
              } else if (volPercent > 400) {
                volumeColor = '#ef4444'; // Vermelho intenso
                volumeShadow = '0 0 10px rgba(239, 68, 68, 0.9)';
                boostClass = 'boost-max';
              }

              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: isVolumeBoostEnabled ? '104px' : '88px',
                    minWidth: isVolumeBoostEnabled ? '104px' : '88px',
                    maxWidth: isVolumeBoostEnabled ? '104px' : '88px',
                    transition: 'width 0.2s ease',
                    flexShrink: 0
                  }}>
                    <input
                      type="range"
                      min="0"
                      max={maxVol}
                      step="0.05"
                      value={currentVol}
                      onChange={handleVolumeChange}
                      onMouseUp={() => containerRef.current?.focus({ preventScroll: true })}
                      onPointerUp={() => containerRef.current?.focus({ preventScroll: true })}
                      className={`player-volume-slider ${boostClass}`}
                      style={{
                        width: '100%',
                        cursor: 'pointer',
                        background: `linear-gradient(to right, ${volumeColor} 0%, ${volumeColor} ${fillPercent}%, #2a3346 ${fillPercent}%, #2a3346 100%)`,
                        boxShadow: volumeShadow
                      }}
                      title={`Volume: ${volPercent}%${isVolumeBoostEnabled ? ' (Super Volume até 500% ativo)' : ''}`}
                    />
                  </div>

                  {/* Indicador Numérico da Porcentagem com Cor Dinâmica */}
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: volumeColor,
                      minWidth: isVolumeBoostEnabled ? '36px' : '30px',
                      fontVariantNumeric: 'tabular-nums',
                      textShadow: volPercent >= 250 ? volumeShadow : 'none',
                      userSelect: 'none',
                      display: 'inline-block',
                      transition: 'color 0.2s ease'
                    }}
                    title={volPercent > 100 ? `Super Volume: ${volPercent}%` : `Volume: ${volPercent}%`}
                  >
                    {volPercent}%
                  </span>
                </div>
              );
            })()}
          </div>

          {/* CENTRO: TÍTULO DA MÍDIA EM CAIXA ALTA (ABSOLUTAMENTE CENTRALIZADO - NUNCA SE DESLOCA) */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '13px',
            fontWeight: '700',
            letterSpacing: '0.6px',
            color: '#ffffff',
            textTransform: 'uppercase',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '44%',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            pointerEvents: 'none',
            zIndex: 1
          }}>
            {formatMediaTitle(currentStream)}
          </div>

          {/* LADO DIREITO: Badge AO VIVO, Menu de Episódios, Configurações, PiP, Fullscreen */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            flexShrink: 0,
            zIndex: 2
          }}>
            {/* Badge AO VIVO (Exatamente igual à imagem de referência nos canais ao vivo) */}
            {isLive && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(220, 38, 38, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                color: '#ef4444',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                userSelect: 'none',
                flexShrink: 0,
                marginRight: '2px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 6px #ef4444'
                }} />
                <span>AO VIVO</span>
              </div>
            )}

            {/* Ícone de Menu / Lista de Episódios (apenas para VOD/Séries) */}
            {!isLive && onOpenEpisodes && (
              <button
                onClick={() => {
                  if (document.fullscreenElement || document.webkitFullscreenElement) {
                    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                  }
                  onOpenEpisodes();
                }}
                style={{
                  ...controlBtnStyle,
                  color: '#ffffff',
                  opacity: 0.95
                }}
                title="Lista de Episódios"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <line x1="3" y1="6" x2="15" y2="6"/>
                  <line x1="3" y1="12" x2="15" y2="12"/>
                  <line x1="3" y1="18" x2="15" y2="18"/>
                  <polyline points="18 9 22 12 18 15"/>
                </svg>
              </button>
            )}

            {/* Ícone e Menu Popover de Configurações Exclusivas do Player */}
            <div ref={playerSettingsRef} style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlayerSettingsOpen(prev => !prev);
                }}
                style={{
                  ...controlBtnStyle,
                  color: isPlayerSettingsOpen ? currentPalette.accent : '#ffffff',
                  opacity: 0.95,
                  position: 'relative'
                }}
                title="Configurações do Player (Qualidade, Proporção, Velocidade)"
              >
                <Settings size={20} color={isPlayerSettingsOpen ? currentPalette.accent : '#ffffff'} strokeWidth={1.9} style={{ display: 'block' }} />
                {currentStream?.sources && currentStream.sources.length > 1 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: currentPalette.accent
                  }} />
                )}
              </button>

              {/* Popover Flutuante de Configurações do Player (Sólido, Sem Blur/Glassmorphism) */}
              {isPlayerSettingsOpen && (
                <>
                  {/* Backdrop invisível em tela cheia para fechar imediatamente ao clicar fora */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPlayerSettingsOpen(false);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setIsPlayerSettingsOpen(false);
                    }}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 58,
                      background: 'transparent',
                      cursor: 'default'
                    }}
                  />

                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      bottom: '46px',
                      right: 0,
                      width: '310px',
                      maxHeight: '480px',
                      overflowY: 'auto',
                      background: currentPalette.panelBg,
                      border: `1px solid ${currentPalette.panelBorder}`,
                      borderRadius: '12px',
                      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95)',
                      padding: '16px',
                      zIndex: 60,
                      cursor: 'default',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px'
                    }}
                    className="visible-scroll"
                  >
                  {/* Cabeçalho do Popover */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${currentPalette.panelBorder}`, paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={16} color={currentPalette.accent} />
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff' }}>
                        Configurações do Player
                      </span>
                    </div>
                    <button
                      onClick={() => setIsPlayerSettingsOpen(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Fechar"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* 1. SELEÇÃO DE QUALIDADE / RESOLUÇÃO */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Resolução / Qualidade</span>
                      <span style={{ color: currentPalette.accent, fontWeight: '800' }}>{selectedQuality}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {currentStream?.sources && currentStream.sources.length > 0 ? (
                        currentStream.sources.map(src => {
                          const isSelected = selectedQuality === src.quality;
                          return (
                            <button
                              key={src.quality}
                              onClick={() => handleQualityChange(src.quality)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: isSelected ? currentPalette.accentBg : 'rgba(255, 255, 255, 0.03)',
                                border: isSelected ? `1px solid ${currentPalette.accent}` : `1px solid ${currentPalette.panelBorder}`,
                                color: isSelected ? '#ffffff' : '#cbd5e1',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                width: '100%',
                                textAlign: 'left'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  color: src.quality === '4K' ? '#fbbf24' : currentPalette.accent,
                                  background: src.quality === '4K' ? 'rgba(245, 158, 11, 0.15)' : currentPalette.accentBg,
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>
                                  {src.quality}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: isSelected ? '700' : '500' }}>
                                  {src.quality === '4K' ? 'Ultra HD (2160p)' :
                                   src.quality === 'FHD' ? 'Full HD (1080p)' :
                                   src.quality === 'HD' ? 'Alta Definição (720p)' :
                                   src.quality === 'SD' ? 'Padrão (480p)' : 'H.265 Compactado'}
                                </span>
                              </div>
                              {isSelected && <Check size={16} color={currentPalette.accent} />}
                            </button>
                          );
                        })
                      ) : (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: currentPalette.accentBg,
                          border: `1px solid ${currentPalette.accent}`,
                          color: '#ffffff'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '800',
                              color: currentPalette.accent,
                              background: currentPalette.accentBg,
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {selectedQuality || 'HD'}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: '600' }}>
                              Qualidade Original da Fonte
                            </span>
                          </div>
                          <Check size={16} color={currentPalette.accent} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. PROPORÇÃO DA TELA (ASPECT RATIO) */}
                  <div style={{ borderTop: `1px solid ${currentPalette.panelBorder}`, paddingTop: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Proporção da Tela
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {[
                        { id: 'contain', label: '16:9 Auto' },
                        { id: 'cover', label: 'Zoom' },
                        { id: 'fill', label: 'Esticar' }
                      ].map(asp => {
                        const isAspSelected = aspectRatio === asp.id;
                        return (
                          <button
                            key={asp.id}
                            onClick={() => setAspectRatio(asp.id)}
                            style={{
                              padding: '6px 4px',
                              borderRadius: '8px',
                              background: isAspSelected ? currentPalette.accentBg : 'rgba(255, 255, 255, 0.04)',
                              border: isAspSelected ? `1px solid ${currentPalette.accent}` : `1px solid ${currentPalette.panelBorder}`,
                              color: isAspSelected ? '#ffffff' : '#94a3b8',
                              fontSize: '11px',
                              fontWeight: isAspSelected ? '700' : '500',
                              cursor: 'pointer',
                              textAlign: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {asp.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. VELOCIDADE DE REPRODUÇÃO (PARA VOD / SÉRIES / FILMES) */}
                  {!isLive && (
                    <div style={{ borderTop: `1px solid ${currentPalette.panelBorder}`, paddingTop: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Velocidade de Reprodução
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {[0.75, 1, 1.25, 1.5].map(speed => {
                          const isSpeedSelected = playbackSpeed === speed;
                          return (
                            <button
                              key={speed}
                              onClick={() => setPlaybackSpeed(speed)}
                              style={{
                                padding: '6px 4px',
                                borderRadius: '8px',
                                background: isSpeedSelected ? currentPalette.accentBg : 'rgba(255, 255, 255, 0.04)',
                                border: isSpeedSelected ? `1px solid ${currentPalette.accent}` : `1px solid ${currentPalette.panelBorder}`,
                                color: isSpeedSelected ? '#ffffff' : '#94a3b8',
                                fontSize: '11px',
                                fontWeight: isSpeedSelected ? '700' : '500',
                                cursor: 'pointer',
                                textAlign: 'center'
                              }}
                            >
                              {speed === 1 ? '1.0x' : `${speed}x`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SUPER VOLUME (AMPLIFICADOR ATÉ 500%) */}
                  <div style={{ borderTop: `1px solid ${currentPalette.panelBorder}`, paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Super Volume (Até 500%)
                      </div>
                      <span style={{ 
                        fontSize: '9px', 
                        fontWeight: '800', 
                        padding: '2px 6px', 
                        borderRadius: '6px', 
                        background: isVolumeBoostEnabled ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: isVolumeBoostEnabled ? '#facc15' : '#94a3b8',
                        border: isVolumeBoostEnabled ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid transparent',
                        letterSpacing: '0.4px'
                      }}>
                        {isVolumeBoostEnabled ? 'ATIVO' : 'DESATIVADO'}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', lineHeight: '1.3' }}>
                      Amplifica o som de transmissões ou canais baixos até 5x (500%).
                    </div>
                    <button
                      onClick={() => toggleVolumeBoost(!isVolumeBoostEnabled)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        background: isVolumeBoostEnabled ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: isVolumeBoostEnabled ? '1px solid rgba(234, 179, 8, 0.5)' : `1px solid ${currentPalette.panelBorder}`,
                        color: isVolumeBoostEnabled ? '#facc15' : '#ffffff',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isVolumeBoostEnabled ? '⚡ Desativar Super Volume (Voltar a 100%)' : '🚀 Liberar Super Volume (até 500%)'}
                    </button>
                  </div>

                  {/* AUTO-RECONEXÃO CONTRA TRAVAMENTOS (ANTI-FREEZE) */}
                  <div style={{ borderTop: `1px solid ${currentPalette.panelBorder}`, paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Anti-Travamento (Auto-Reconexão)
                      </div>
                      <span style={{ 
                        fontSize: '9px', 
                        fontWeight: '800', 
                        padding: '2px 6px', 
                        borderRadius: '6px', 
                        background: isAutoReconnectEnabled ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: isAutoReconnectEnabled ? currentPalette.accent : '#94a3b8',
                        border: isAutoReconnectEnabled ? `1px solid ${currentPalette.accent}60` : '1px solid transparent',
                        letterSpacing: '0.4px'
                      }}>
                        {isAutoReconnectEnabled ? `ATIVO (${autoReconnectTimeout}s)` : 'DESATIVADO'}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', lineHeight: '1.3' }}>
                      Reconecta o canal se o vídeo travar, preservando o ponto exato do filme ou série.
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          const next = !isAutoReconnectEnabled;
                          setIsAutoReconnectEnabled(next);
                          try { localStorage.setItem('orizon_auto_reconnect', String(next)); } catch {}
                          fetch('/api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ autoReconnectOnFreeze: next })
                          }).catch(() => {});
                          showToast(next ? 'Auto-Reconexão: Ativada 🛡️' : 'Auto-Reconexão: Desativada');
                        }}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: '8px',
                          background: isAutoReconnectEnabled ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          border: isAutoReconnectEnabled ? `1px solid ${currentPalette.accent}80` : `1px solid ${currentPalette.panelBorder}`,
                          color: isAutoReconnectEnabled ? currentPalette.accent : '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isAutoReconnectEnabled ? '🛡️ Auto-Reconexão Ativa' : 'Desativada (Clique p/ Ativar)'}
                      </button>
                      <button
                        onClick={() => {
                          triggerFullReconnect(true);
                          setIsPlayerSettingsOpen(false);
                        }}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: `1px solid ${currentPalette.panelBorder}`,
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Reconectar sinal agora (Tecla R)"
                      >
                        <RotateCcw size={12} />
                        <span>Reconectar (R)</span>
                      </button>
                    </div>
                  </div>

                  {/* 4. LINK PARA CONFIGURAÇÕES GERAIS DO APP */}
                  <div style={{ borderTop: `1px solid ${currentPalette.panelBorder}`, paddingTop: '10px' }}>
                    <button
                      onClick={() => {
                        setIsPlayerSettingsOpen(false);
                        if (onOpenSettingsModal) onOpenSettingsModal();
                      }}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: `1px dashed ${currentPalette.panelBorder}`,
                        color: '#64748b',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = currentPalette.accent;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#64748b';
                        e.currentTarget.style.borderColor = currentPalette.panelBorder;
                      }}
                    >
                      Abrir Configurações do App (Proxy / Cache)
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>

            {/* Ícone de Picture in Picture */}
            <button
              onClick={togglePiP}
              style={{
                ...controlBtnStyle,
                color: '#ffffff',
                opacity: 0.95
              }}
              title="Picture-in-Picture (PiP)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <rect x="12" y="10" width="8" height="6" rx="1" fill="rgba(255,255,255,0.25)"/>
                <polyline points="8 17 8 21 16 21 16 17"/>
              </svg>
            </button>

            {/* Ícone de Tela Cheia */}
            <button
              onClick={onToggleFullscreen}
              style={{
                ...controlBtnStyle,
                color: isFullscreen ? currentPalette.accent : '#ffffff',
                opacity: 0.95
              }}
              title={isFullscreen ? "Sair da Tela Cheia (F / Esc)" : "Tela Cheia (F)"}
            >
              {isFullscreen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M4 14h6v6"/>
                  <path d="M20 14h-6v6"/>
                  <path d="M4 10h6V4"/>
                  <path d="M20 10h-6V4"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M4 9V4h5"/>
                  <path d="M20 9V4h-5"/>
                  <path d="M4 15v5h5"/>
                  <path d="M20 15v5h-5"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 🎬 CARD FLUTUANTE DE PRÓXIMO EPISÓDIO (SEM PULO AUTOMÁTICO - AGUARDA O CLIQUE DO USUÁRIO) */}
      {showFloatingNext && nextEpisodeInfo && (
        <div style={{
          position: 'absolute',
          bottom: showControls ? '96px' : '32px',
          right: '32px',
          background: currentPalette.panelBg,
          border: `1px solid ${currentPalette.accent}`,
          borderRadius: '14px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85)',
          zIndex: 45,
          backdropFilter: 'blur(12px)',
          maxWidth: '380px',
          transition: 'bottom 0.25s ease'
        }}>
          {nextEpisodeInfo.thumb && (
            <div style={{
              width: '60px',
              height: '36px',
              borderRadius: '6px',
              overflow: 'hidden',
              flexShrink: 0,
              background: '#000000',
              border: `1px solid ${currentPalette.panelBorder}`
            }}>
              <img 
                src={nextEpisodeInfo.thumb} 
                alt={nextEpisodeInfo.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              color: currentPalette.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Próximo Episódio • {nextEpisodeInfo.label}
            </span>
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }} title={nextEpisodeInfo.title}>
              {nextEpisodeInfo.title}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '6px' }}>
            <button
              onClick={handleNextEpisodeClick}
              style={{
                background: currentPalette.accent,
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Assistir</span>
            </button>

            <button
              onClick={() => setIsFloatingDismissed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
              title="Dispensar aviso"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerView;
