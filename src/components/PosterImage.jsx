import React, { useState, useEffect, useRef } from 'react';
import { Film } from 'lucide-react';

export function PosterImage({ 
  src, 
  alt = '', 
  style = {}, 
  className = '' 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgContainerRef = useRef(null);

  // 1. IntersectionObserver: só requisita a imagem quando estiver prestes a aparecer na tela
  useEffect(() => {
    if (!src) return;

    const el = imgContainerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' } // Começa a carregar 300px antes de entrar no campo de visão
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [src]);

  // Se não houver URL de imagem, mostra placeholder direto
  if (!src) {
    return (
      <div 
        ref={imgContainerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d18',
          color: '#475569',
          gap: '6px',
          ...style
        }}
      >
        <Film size={26} color="#334155" />
        <span style={{ fontSize: '11px', fontWeight: '600' }}>Sem Capa</span>
      </div>
    );
  }

  // URL através do nosso cache local de SSD (Node.js)
  const cachedUrl = `/api/image-cache?url=${encodeURIComponent(src)}`;

  return (
    <div 
      ref={imgContainerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#090d18',
        overflow: 'hidden',
        ...style
      }}
    >
      {/* Skeleton de fundo enquanto carrega */}
      {!isLoaded && !hasError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #090d18 0%, #161f36 50%, #090d18 100%)',
          backgroundSize: '200% 100%',
          animation: 'pulse 1.8s infinite linear'
        }} />
      )}

      {hasError ? (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475569',
          gap: '6px',
          background: '#090d18'
        }}>
          <Film size={26} color="#334155" />
          <span style={{ fontSize: '11px', fontWeight: '600' }}>Imagem Indisponível</span>
        </div>
      ) : isVisible ? (
        <img
          src={cachedUrl}
          alt={alt}
          draggable={false}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      ) : null}
    </div>
  );
}
