import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'orizon_vod_progress';

// Obtém uma chave única padronizada para qualquer item VOD (filme, série ou episódio)
export const getVodMediaKey = (item) => {
  if (!item) return '';
  const rawKey = item.id || item.stream_id || item.url || item.streamUrl || item.name || item.title || '';
  return String(rawKey).trim();
};

// Lê todos os progressos salvos no localStorage
export const getAllVodProgress = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Erro ao ler progresso VOD:', e);
    return {};
  }
};

// Salva onde parou com a regra dos 30 segundos
export const saveVodProgress = (item, currentTime, duration) => {
  const key = getVodMediaKey(item);
  if (!key) return;

  const cTime = Math.max(0, Number(currentTime) || 0);
  const dur = Math.max(0, Number(duration) || 0);

  const allProgress = getAllVodProgress();

  // REGRA: Se assistiu menos de 30s, não precisa mostrar o progresso
  if (cTime < 30) {
    if (allProgress[key]) {
      delete allProgress[key];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
        window.dispatchEvent(new CustomEvent('vod_progress_updated', { detail: { key, removed: true } }));
      } catch {}
    }
    return;
  }

  // Se já assistiu mais de 95% do filme/episódio, considera finalizado
  const percentage = dur > 0 ? Math.min(100, Math.round((cTime / dur) * 100)) : 0;
  
  allProgress[key] = {
    currentTime: Math.round(cTime),
    duration: Math.round(dur),
    percentage: percentage >= 95 ? 100 : percentage,
    updatedAt: Date.now()
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
    window.dispatchEvent(new CustomEvent('vod_progress_updated', { detail: { key, progress: allProgress[key] } }));
  } catch (e) {
    console.error('Erro ao salvar progresso VOD:', e);
  }
};

// Obtém o progresso de um item específico (retorna null se assistiu < 30s)
export const getVodProgress = (item) => {
  const key = getVodMediaKey(item);
  if (!key) return null;
  const allProgress = getAllVodProgress();
  const prog = allProgress[key];
  if (!prog || prog.currentTime < 30) return null;
  return prog;
};

// Hook React para manter componentes reativos ao progresso em tempo real
export function useVodProgress() {
  const [progressMap, setProgressMap] = useState(getAllVodProgress);

  useEffect(() => {
    const handleUpdate = () => {
      setProgressMap(getAllVodProgress());
    };

    window.addEventListener('vod_progress_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('vod_progress_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const getProgress = (item) => {
    const key = getVodMediaKey(item);
    if (!key) return 0;
    const itemProg = progressMap[key];
    if (!itemProg || itemProg.currentTime < 30) return 0;
    return itemProg.percentage || 0;
  };

  const getItemProgressData = (item) => {
    const key = getVodMediaKey(item);
    if (!key) return null;
    const itemProg = progressMap[key];
    if (!itemProg || itemProg.currentTime < 30) return null;
    return itemProg;
  };

  return { progressMap, getProgress, getItemProgressData };
}

// Componente Visual da Barrinha Vermelha Estilo Netflix
export function NetflixProgressBar({ progress, height = 4, style = {} }) {
  if (!progress || progress < 1) return null;
  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: `${height}px`,
      background: 'rgba(255, 255, 255, 0.28)',
      backdropFilter: 'blur(4px)',
      overflow: 'hidden',
      zIndex: 10,
      ...style
    }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: '#e50914', // Vermelho Netflix
        boxShadow: '0 0 6px rgba(229, 9, 20, 0.7)',
        borderRadius: pct >= 98 ? '0' : '0 2px 2px 0',
        transition: 'width 0.3s ease'
      }} />
    </div>
  );
}
