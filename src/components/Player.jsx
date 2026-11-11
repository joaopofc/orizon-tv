import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Tv, 
  Heart, 
  RotateCcw, 
  Scaling, 
  PictureInPicture,
  Loader2,
  AlertCircle
} from 'lucide-react';

export function Player({ 
  currentStream, 
  isFavorite, 
  onToggleFavorite, 
  onChannelChange,
  enableProxy = true
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('contain'); // contain, cover, fill

  // Calcula URL com proxy ou direta
  const streamUrl = currentStream?.url ? (
    enableProxy 
      ? `/api/stream?url=${encodeURIComponent(currentStream.url)}`
      : currentStream.url
  ) : null;

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    // Destrói instância HLS anterior se houver
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    const isHls = streamUrl.includes('.m3u8') || currentStream?.type === 'live';

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play().catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('[HLS Fatal Error]', data);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('[HLS] Tentando recuperar de erro de rede...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[HLS] Tentando recuperar de erro de mídia...');
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setHasError(true);
              setErrorMessage('Falha ao conectar com o canal ou sinal indisponível.');
              setIsLoading(false);
              break;
          }
        }
      });

      hlsRef.current = hls;

    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      // Suporte nativo do navegador / streams mp4 diretos
      video.src = streamUrl;
      video.play().catch(() => setIsPlaying(false));
      setIsLoading(false);
    } else {
      setHasError(true);
      setErrorMessage('Formato de stream não suportado neste navegador.');
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [streamUrl]);

  // Efeito para ocultar controles automaticamente com inatividade do mouse
  const handleMouseMove = () => {
    setShowControls(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  // Controles
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const cycleAspectRatio = () => {
    if (aspectRatio === 'contain') setAspectRatio('cover');
    else if (aspectRatio === 'cover') setAspectRatio('fill');
    else setAspectRatio('contain');
  };

  const togglePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    }
  };

  const retryStream = () => {
    setHasError(false);
    setIsLoading(true);
    if (videoRef.current && streamUrl) {
      const current = streamUrl;
      videoRef.current.src = '';
      setTimeout(() => {
        if (hlsRef.current) {
          hlsRef.current.loadSource(current);
          hlsRef.current.attachMedia(videoRef.current);
        }
      }, 300);
    }
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
        background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)',
        color: '#64748b',
        gap: '16px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Tv size={36} color="#38bdf8" style={{ opacity: 0.6 }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>
            Nenhum Canal Selecionado
          </h3>
          <p style={{ fontSize: '14px', maxWidth: '340px', lineHeight: '1.5' }}>
            Escolha um canal da lista lateral ou faça uma busca para começar a assistir com áudio e vídeo de alta fidelidade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        background: '#000000',
        overflow: 'hidden'
      }}
    >
      <video
        ref={videoRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: aspectRatio,
          display: 'block'
        }}
        playsInline
      />

      {/* Loading Overlay */}
      {isLoading && !hasError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: '#ffffff',
          backdropFilter: 'blur(4px)',
          zIndex: 20
        }}>
          <Loader2 size={36} color="#38bdf8" className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '15px', fontWeight: '600', letterSpacing: '0.5px' }}>Carregando sinal...</span>
        </div>
      )}

      {/* Error Overlay */}
      {hasError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 14, 23, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: '#ffffff',
          padding: '24px',
          zIndex: 25
        }}>
          <AlertCircle size={48} color="#f43f5e" />
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
              Não foi possível reproduzir este canal
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '420px', lineHeight: '1.5' }}>
              {errorMessage || 'O link do stream pode estar offline temporariamente ou requer autenticação.'}
            </p>
          </div>
          <button
            onClick={retryStream}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <RotateCcw size={16} />
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Player Top Banner (Channel Info) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '24px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: showControls ? 1 : 0,
        transform: showControls ? 'translateY(0)' : 'translateY(-20px)',
        transition: 'all 0.3s ease',
        zIndex: 30,
        pointerEvents: showControls ? 'auto' : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {currentStream.logo ? (
            <img 
              src={currentStream.logo} 
              alt={currentStream.name}
              onError={(e) => { e.target.style.display = 'none'; }}
              style={{
                width: '46px',
                height: '46px',
                objectFit: 'contain',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '4px'
              }}
            />
          ) : (
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '8px',
              background: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: '800',
              fontSize: '18px'
            }}>
              {currentStream.name.charAt(0)}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: '800' }}>
                {currentStream.name}
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                AO VIVO
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '2px' }}>
              {currentStream.category || 'Geral'}
            </p>
          </div>
        </div>

        {/* Favorite toggle */}
        <button
          onClick={() => onToggleFavorite(currentStream)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: isFavorite ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            border: isFavorite ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFavorite ? '#ef4444' : '#ffffff'
          }}
        >
          <Heart size={20} fill={isFavorite ? '#ef4444' : 'none'} />
        </button>
      </div>

      {/* Player Bottom Control Bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '20px 24px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: showControls ? 1 : 0,
        transform: showControls ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.3s ease',
        zIndex: 30,
        pointerEvents: showControls ? 'auto' : 'none'
      }}>
        {/* Left: Play/Pause, Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={togglePlay}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(2, 132, 199, 0.5)'
            }}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '2px' }} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleMute}
              style={{ background: 'transparent', color: '#ffffff', padding: '4px' }}
            >
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              style={{
                width: '80px',
                accentColor: '#38bdf8',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

        {/* Right: Aspect Ratio, PiP, Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={cycleAspectRatio}
            title={`Proporção: ${aspectRatio}`}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Scaling size={16} />
            {aspectRatio.toUpperCase()}
          </button>

          <button
            onClick={togglePiP}
            title="Picture in Picture (PiP)"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <PictureInPicture size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
