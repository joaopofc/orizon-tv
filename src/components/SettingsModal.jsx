import React, { useState, useEffect } from 'react';
import { APP_VERSION, APP_BUILD_DATE } from '../version.js';
import { 
  X, 
  Settings, 
  Palette, 
  Tv, 
  Layers, 
  Lock, 
  Unlock, 
  Database, 
  Info, 
  Check, 
  RotateCcw, 
  Trash2, 
  Download, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  HardDrive,
  Keyboard
} from 'lucide-react';

const APP_THEME_OPTIONS = [
  {
    id: 'slate',
    name: 'Cinza Ônix & Azul Ártico',
    subtitle: 'Estilo Apple TV • Sóbrio, Moderno e Minimalista (Recomendado)',
    accent: '#38bdf8',
    bg: '#0c0f17',
    border: '#242c3d'
  },
  {
    id: 'cinema',
    name: 'Preto Puro OLED & Vermelho Cinema',
    subtitle: 'Estilo Netflix • Máximo Contraste para Salas Escuras',
    accent: '#e50914',
    bg: '#070709',
    border: '#27272f'
  },
  {
    id: 'amber',
    name: 'Grafite Nobre & Âmbar Ouro',
    subtitle: 'Estilo HBO / Prime • Tons Quentes Acolhedores de Cinema',
    accent: '#f59e0b',
    bg: '#0e0d11',
    border: '#2d2938'
  },
  {
    id: 'blackout',
    name: 'Blackout AMOLED 100% & Titânio Gelo',
    subtitle: 'Preto Profundo Absoluto (Zero Luz) • Máxima Economia & Fundo Mais Escuro',
    accent: '#ffffff',
    bg: '#000000',
    border: '#222222'
  },
  {
    id: 'amethyst',
    name: 'Ametista Noturna & Violeta Cósmico',
    subtitle: 'Cyberpunk & Sci-Fi • Púrpura Místico com Personalidade Criativa Única',
    accent: '#a855f7',
    bg: '#090714',
    border: '#291f48'
  },
  {
    id: 'emerald',
    name: 'Verde Jade & Esmeralda Nórdica',
    subtitle: 'Esportes Premium & Documentários • Elegância Botânica e Visual Revigorante',
    accent: '#10b981',
    bg: '#050e09',
    border: '#1c3829'
  }
];

// Componente de Switch Toggle estilizado (Estilo iOS / Material)
function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '100px',
        background: checked ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.16)',
        border: 'none',
        padding: '2px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.25s ease',
        position: 'relative',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: checked ? 'var(--text-on-accent)' : '#ffffff',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.4)',
          transform: checked ? 'translateX(20px)' : 'translateX(0px)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      />
    </button>
  );
}

// Linha de Configuração Padrão com divisor
function SettingRow({ title, description, children, isLast = false }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
      gap: '24px'
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{
          fontSize: '14px',
          fontWeight: '700',
          color: 'var(--text-main)',
          margin: '0 0 4px 0'
        }}>
          {title}
        </h4>
        {description && (
          <p style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: '1.5',
            margin: 0
          }}>
            {description}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  );
}

export function SettingsModal({ 
  isOpen, 
  onClose, 
  onResetApp,
  appTheme = 'slate',
  onChangeAppTheme,
  onOpenCategoryManager,
  isAdultUnlocked = false,
  onRequestUnlockAdult,
  onLockAdult
}) {
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'player' | 'appearance' | 'categories' | 'parental' | 'data' | 'about'

  const [settings, setSettings] = useState({
    userAgent: 'VLC/3.0.18 LibVLC/3.0.18',
    bufferLength: 30,
    enableProxy: true,
    enableVolumeBoost: false,
    autoReconnectOnFreeze: true,
    autoReconnectTimeout: 7,
    autoResumeLastChannel: true,
    preferredQuality: 'auto',
    hideControlsTimeout: 5,
    hardwareAcceleration: true,
    parentalPin: '0000'
  });

  const [saveStatus, setSaveStatus] = useState('');
  const [cacheClearStatus, setCacheClearStatus] = useState('');
  const [historyClearStatus, setHistoryClearStatus] = useState('');

  // Carrega configurações salvas do backend ao abrir
  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
          if (data) {
            setSettings(prev => ({ ...prev, ...data }));
          }
        })
        .catch(err => console.error('Erro ao buscar configurações:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Atualização e salvamento automático de configurações
  const updateSetting = async (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    if (key === 'enableVolumeBoost') {
      try {
        localStorage.setItem('orizon_volume_boost', String(value));
        window.dispatchEvent(new CustomEvent('orizon:setting-changed', { detail: { key, value } }));
      } catch {}
    } else if (key === 'autoReconnectOnFreeze') {
      try {
        localStorage.setItem('orizon_auto_reconnect', String(value));
        window.dispatchEvent(new CustomEvent('orizon:setting-changed', { detail: { key, value } }));
      } catch {}
    } else if (key === 'autoReconnectTimeout') {
      try {
        localStorage.setItem('orizon_auto_reconnect_timeout', String(value));
        window.dispatchEvent(new CustomEvent('orizon:setting-changed', { detail: { key, value } }));
      } catch {}
    }

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setSaveStatus('Salvo!');
      setTimeout(() => setSaveStatus(''), 1200);
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
    }
  };

  // Limpeza de cache de imagens do SSD
  const handleClearCache = async () => {
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' });
      const data = await res.json();
      setCacheClearStatus(`${data.count || 0} arquivos limpos`);
      setTimeout(() => setCacheClearStatus(''), 2000);
    } catch (err) {
      console.error('Erro ao limpar cache:', err);
    }
  };

  // Limpar todo o histórico de reprodução
  const handleClearHistory = async () => {
    if (window.confirm('Tem certeza que deseja apagar todo o histórico de canais e filmes assistidos?')) {
      try {
        await fetch('/api/history', { method: 'DELETE' });
        setHistoryClearStatus('Histórico limpo');
        setTimeout(() => setHistoryClearStatus(''), 2000);
      } catch (err) {
        console.error('Erro ao limpar histórico:', err);
      }
    }
  };

  // Exportar dados do aplicativo (backup JSON)
  const handleExportData = () => {
    window.open('/api/export-data', '_blank');
  };

  // Abas da Sidebar Lateral
  const SIDEBAR_NAV = [
    { id: 'general', label: 'Geral', icon: Settings },
    { id: 'player', label: 'Reprodução', icon: Tv },
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'categories', label: 'Categorias', icon: Layers },
    { id: 'parental', label: 'Controle Parental', icon: Lock },
    { id: 'data', label: 'Dados', icon: Database },
    { id: 'about', label: 'Sobre', icon: Info }
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.82)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '840px',
        height: '76vh',
        minHeight: '520px',
        maxHeight: '680px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header do Modal */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              Configurações
            </h3>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--accent-primary)',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--border-accent)',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              v{APP_VERSION}
            </span>
            {saveStatus && (
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                color: 'var(--accent-bright)',
                background: 'var(--accent-subtle)',
                padding: '2px 8px',
                borderRadius: '100px'
              }}>
                ✓ {saveStatus}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Modal: Sidebar Lateral + Painel de Conteúdo */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden'
        }}>
          {/* 📁 Sidebar Esquerda de Abas */}
          <div style={{
            width: '210px',
            background: 'rgba(0, 0, 0, 0.28)',
            borderRight: '1px solid var(--border-subtle)',
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '4px',
            flexShrink: 0,
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {SIDEBAR_NAV.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: isActive ? '700' : '500',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      color: isActive ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Icon size={16} color={isActive ? 'var(--accent-primary)' : '#94a3b8'} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Versão Atual Fixa no Rodapé da Sidebar de Configurações */}
            <div style={{
              padding: '12px 14px',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                Orizon TV Desktop
              </span>
              <span style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: '800' }}>
                v{APP_VERSION}
              </span>
            </div>
          </div>

          {/* 📄 Painel Direito de Conteúdo com Rolagem Suave */}
          <div style={{
            flex: 1,
            padding: '16px 28px',
            overflowY: 'auto'
          }} className="visible-scroll">
            
            {/* 1. ABA GERAL */}
            {activeTab === 'general' && (
              <div>
                <SettingRow
                  title="Proxy Local de Conexão (Node.js)"
                  description="Contorna restrições de CORS, resolve certificados SSL inválidos e reescreve links de transmissão HLS em tempo real."
                >
                  <ToggleSwitch
                    checked={settings.enableProxy}
                    onChange={(val) => updateSetting('enableProxy', val)}
                  />
                </SettingRow>

                <SettingRow
                  title="User-Agent do Player"
                  description="Identificador enviado aos servidores IPTV. Essencial para contornar bloqueios de provedores que exigem players oficiais."
                >
                  <select
                    value={settings.userAgent}
                    onChange={(e) => updateSetting('userAgent', e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="VLC/3.0.18 LibVLC/3.0.18">VLC Player (Recomendado)</option>
                    <option value="IPTVSmartersPlayer">IPTV Smarters Player</option>
                    <option value="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0">Google Chrome</option>
                    <option value="AppleCoreMedia/1.0.0.19G69 (Apple TV)">Apple TV</option>
                  </select>
                </SettingRow>

                <SettingRow
                  title="Retomar Reprodução Automaticamente"
                  description="Volta automaticamente ao último canal ou vídeo assistido ao iniciar o aplicativo."
                >
                  <ToggleSwitch
                    checked={settings.autoResumeLastChannel}
                    onChange={(val) => updateSetting('autoResumeLastChannel', val)}
                  />
                </SettingRow>

                <SettingRow
                  title="Aceleração por Hardware (GPU)"
                  description="Utiliza a placa gráfica do seu computador para rasterização dos vídeos com menor consumo de bateria e CPU."
                  isLast
                >
                  <ToggleSwitch
                    checked={settings.hardwareAcceleration}
                    onChange={(val) => updateSetting('hardwareAcceleration', val)}
                  />
                </SettingRow>
              </div>
            )}

            {/* 2. ABA REPRODUÇÃO */}
            {activeTab === 'player' && (
              <div>
                <SettingRow
                  title="Tamanho do Buffer de Vídeo"
                  description="Buffer de pré-carregamento. Use 15s para baixa latência em futebol/esportes, ou 60s para evitar travamentos em conexões mais lentas."
                >
                  <select
                    value={settings.bufferLength}
                    onChange={(e) => updateSetting('bufferLength', Number(e.target.value))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value={15}>15 segundos (Baixa Latência)</option>
                    <option value={30}>30 segundos (Equilibrado • Recomendado)</option>
                    <option value={60}>60 segundos (Máxima Estabilidade)</option>
                  </select>
                </SettingRow>

                <SettingRow
                  title="Qualidade Inicial Preferida"
                  description="Prioridade de resolução ao sintonizar canais com múltiplas transmissões disponíveis (4K, FHD, HD, SD)."
                >
                  <select
                    value={settings.preferredQuality}
                    onChange={(e) => updateSetting('preferredQuality', e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="auto">Automático (Melhor Disponível)</option>
                    <option value="4k">Preferir 4K Ultra HD</option>
                    <option value="fhd">Preferir 1080p Full HD</option>
                    <option value="hd">Preferir 720p HD</option>
                  </select>
                </SettingRow>

                <SettingRow
                  title="Ocultar Barra de Controles"
                  description="Tempo de inatividade do mouse no player antes de esconder os controles em reprodução."
                >
                  <select
                    value={settings.hideControlsTimeout}
                    onChange={(e) => updateSetting('hideControlsTimeout', Number(e.target.value))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value={3}>3 segundos (Rápido)</option>
                    <option value={5}>5 segundos (Padrão)</option>
                    <option value={8}>8 segundos (Longo)</option>
                  </select>
                </SettingRow>

                <SettingRow
                  title="Amplificador de Super Volume (até 500%)"
                  description="Libera a barra de volume para ultrapassar 100% e chegar até 500% com ganho de áudio em tempo real. Ideal para canais ou transmissões com som baixo."
                >
                  <ToggleSwitch
                    checked={Boolean(settings.enableVolumeBoost)}
                    onChange={(val) => updateSetting('enableVolumeBoost', val)}
                  />
                </SettingRow>

                <SettingRow
                  title="Reconexão Automática contra Travamentos (Anti-Freeze)"
                  description="Detecta quando o sinal congela ou fica travado em buffering e reinicia a conexão automaticamente nos bastidores, preservando onde você parou em filmes e séries."
                >
                  <ToggleSwitch
                    checked={settings.autoReconnectOnFreeze !== false}
                    onChange={(val) => updateSetting('autoReconnectOnFreeze', val)}
                  />
                </SettingRow>

                {settings.autoReconnectOnFreeze !== false && (
                  <SettingRow
                    title="Tempo de Espera antes de Reconectar"
                    description="Intervalo de congelamento antes de acionar a reconexão automática. Dica: você também pode pressionar a tecla 'R' no player para reconectar instantaneamente."
                    isLast
                  >
                    <select
                      value={settings.autoReconnectTimeout || 7}
                      onChange={(e) => updateSetting('autoReconnectTimeout', Number(e.target.value))}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value={5}>5 segundos (Rápido)</option>
                      <option value={7}>7 segundos (Recomendado)</option>
                      <option value={10}>10 segundos (Conexões instáveis)</option>
                      <option value={15}>15 segundos (Longo)</option>
                    </select>
                  </SettingRow>
                )}
              </div>
            )}

            {/* 3. ABA APARÊNCIA */}
            {activeTab === 'appearance' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                    Paleta de Cores do Aplicativo
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                    Escolha a identidade visual do app. Visual limpo, sólido e de alto contraste, sem vidro borrado e sem neon.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {APP_THEME_OPTIONS.map(opt => {
                    const isSelected = appTheme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (onChangeAppTheme) onChangeAppTheme(opt.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-card)',
                          border: isSelected ? `2px solid ${opt.accent}` : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: opt.bg,
                            border: `2px solid ${opt.accent}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: opt.accent
                            }} />
                          </div>

                          <div>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: isSelected ? '800' : '600',
                              color: isSelected ? '#ffffff' : 'var(--text-main)'
                            }}>
                              {opt.name}
                            </div>
                            <div style={{ fontSize: '11px', color: isSelected ? opt.accent : 'var(--text-muted)', marginTop: '2px' }}>
                              {opt.subtitle}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: opt.accent,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            flexShrink: 0
                          }}>
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: '2px solid var(--border-subtle)',
                            flexShrink: 0
                          }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. ABA CATEGORIAS */}
            {activeTab === 'categories' && (
              <div>
                <SettingRow
                  title="Posição e Ordem das Categorias Principais"
                  description="Personalize a ordem das abas (Ao Vivo, Esportes, Filmes, Séries), oculte as abas que você não utiliza ou crie novas categorias personalizadas com seus canais, filmes e séries favoritos."
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenCategoryManager) onOpenCategoryManager();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 18px',
                      borderRadius: '100px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>Gerenciar</span>
                    <ChevronRight size={14} />
                  </button>
                </SettingRow>

                <SettingRow
                  title="Exibir Contagem de Mídias nas Abas"
                  description="Exibe a quantidade numérica de canais ou títulos disponíveis ao lado de cada categoria na barra lateral."
                  isLast
                >
                  <ToggleSwitch
                    checked={true}
                    disabled={true}
                    onChange={() => {}}
                  />
                </SettingRow>
              </div>
            )}

            {/* 5. ABA CONTROLE PARENTAL */}
            {activeTab === 'parental' && (
              <div>
                <SettingRow
                  title="Status do Conteúdo Adulto (+18)"
                  description="O conteúdo para maiores é isolado em uma aba exclusiva e protegido por senha PIN de 4 dígitos."
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '3px 10px',
                      borderRadius: '100px',
                      background: isAdultUnlocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.18)',
                      color: isAdultUnlocked ? '#f87171' : '#4ade80',
                      border: isAdultUnlocked ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)'
                    }}>
                      {isAdultUnlocked ? 'DESBLOQUEADO' : 'PROTEGIDO COM SENHA'}
                    </span>

                    {isAdultUnlocked ? (
                      <button
                        type="button"
                        onClick={onLockAdult}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '100px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Bloquear Agora
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onRequestUnlockAdult}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '100px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Desbloquear
                      </button>
                    )}
                  </div>
                </SettingRow>

                <SettingRow
                  title="Senha Padrão de Fábrica"
                  description="A senha de fábrica definida para proteção parental inicial é 0000. Para desbloquear durante o uso, basta acessar a aba Adulto na barra lateral."
                  isLast
                >
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    color: 'var(--accent-primary)',
                    background: 'var(--accent-subtle)',
                    padding: '4px 10px',
                    borderRadius: '8px'
                  }}>
                    PIN: 0000
                  </span>
                </SettingRow>
              </div>
            )}

            {/* 6. ABA DADOS & ARMAZENAMENTO (Estilo Exato da Imagem de Referência) */}
            {activeTab === 'data' && (
              <div>
                <SettingRow
                  title="Cache Local de Imagens em SSD"
                  description="Logos de canais e capas de filmes e séries são armazenados no SSD local para carregamento instantâneo. Libere espaço caso necessário."
                >
                  <button
                    type="button"
                    onClick={handleClearCache}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '100px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cacheClearStatus ? cacheClearStatus : 'Limpar cache'}
                  </button>
                </SettingRow>

                <SettingRow
                  title="Histórico de Reprodução"
                  description="Registra os canais de TV ao vivo, filmes e episódios de séries assistidos recentemente."
                >
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '100px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {historyClearStatus ? historyClearStatus : 'Limpar histórico'}
                  </button>
                </SettingRow>

                <SettingRow
                  title="Exportar dados"
                  description="Estes dados incluem suas credenciais salvas, listas de reprodução conectadas, favoritos e configurações. O download inicia imediatamente em formato JSON."
                >
                  <button
                    type="button"
                    onClick={handleExportData}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '100px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Download size={14} />
                    <span>Exportar</span>
                  </button>
                </SettingRow>

                <SettingRow
                  title="Excluir todos os dados do aplicativo"
                  description="Apaga todas as listas salvas, favoritos, histórico e zera as credenciais para restaurar o estado original de fábrica."
                  isLast
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('⚠️ Tem certeza que deseja excluir todos os dados? Todas as playlists e favoritos serão apagados permanentemente.')) {
                        if (onResetApp) onResetApp();
                      }
                    }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '100px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.45)',
                      color: '#f87171',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Excluir tudo
                  </button>
                </SettingRow>
              </div>
            )}

            {/* 7. ABA SOBRE */}
            {activeTab === 'about' && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: 'var(--bg-card)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '18px'
                }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    flexShrink: 0
                  }}>
                    <img 
                      src="/logo.png" 
                      alt="Orizon TV" 
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      onError={(e) => e.target.style.display = 'none'} 
                    />
                  </div>

                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', margin: '0 0 2px 0' }}>
                      Orizon TV Engine
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '800' }}>
                        Versão {APP_VERSION} (Build {APP_BUILD_DATE})
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>•</span>
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>
                        ● Servidor Local Online (Porta 3001)
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Keyboard size={16} color="var(--accent-primary)" />
                    <span>Atalhos Rápidos de Teclado</span>
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>Espaço:</strong> Play / Pause
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>F / F11:</strong> Alternar Tela Cheia
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>M:</strong> Mutar / Desmutar Áudio
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>↑ / ↓:</strong> Aumentar / Diminuir Volume
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>← / →:</strong> Canal Anterior / Próximo
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>Ctrl + K:</strong> Focar na Caixa de Busca
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
