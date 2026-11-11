import React, { useState } from 'react';
import { 
  X, 
  Tv, 
  Link, 
  Server, 
  Trash2, 
  Check, 
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Plus,
  LogIn,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Layers
} from 'lucide-react';

// Helper para detectar e extrair credenciais Xtream de uma URL M3U
function extractXtreamFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;
    const parsed = new URL(trimmed);
    const username = parsed.searchParams.get('username') || parsed.searchParams.get('user');
    const password = parsed.searchParams.get('password') || parsed.searchParams.get('pass');
    if (username && password) {
      const port = parsed.port ? `:${parsed.port}` : '';
      const server = `${parsed.protocol}//${parsed.hostname}${port}`;
      return {
        server,
        username,
        password,
        rawUrl: trimmed
      };
    }
  } catch (e) {}
  return null;
}

export function PlaylistModal({ 
  isOpen, 
  onClose, 
  playlists = [], 
  selectedPlaylist, 
  onSelectPlaylist, 
  onPlaylistCreated, 
  onPlaylistDeleted,
  onPlaylistReloaded,
  onResetApp
}) {
  // Se houver playlists salvas, abre na aba 'profiles', se não houver, abre em 'login'
  const [activeView, setActiveView] = useState(playlists.length > 0 ? 'profiles' : 'login');
  const [loginType, setLoginType] = useState('xtream'); // 'xtream' ou 'm3u'
  const [isLoading, setIsLoading] = useState(false);
  const [reloadingId, setReloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [xtreamOffer, setXtreamOffer] = useState(null);

  // Form M3U
  const [m3uName, setM3uName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uEpg, setM3uEpg] = useState('');

  // Form Xtream
  const [xtreamName, setXtreamName] = useState('');
  const [xtreamServer, setXtreamServer] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');

  if (!isOpen) return null;

  // Formata data unix para DD/MM/AAAA
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Ilimitado';
    try {
      const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
      const date = new Date(ts > 10000000000 ? ts : ts * 1000);
      return date.toLocaleDateString('pt-BR');
    } catch (e) {
      return 'Ativo';
    }
  };

  const handleCreateM3U = async (e) => {
    if (e) e.preventDefault();
    if (!m3uName.trim() || !m3uUrl.trim()) {
      setError('Preencha o nome de identificação e a URL da lista M3U.');
      return;
    }

    // Se detecta credenciais de Xtream, oferta a conversão no novo modal
    const detected = extractXtreamFromUrl(m3uUrl);
    if (detected) {
      setXtreamOffer(detected);
      return;
    }

    // Se a lista não for Xtream, já pula direto para M3U normal
    await submitM3u(false);
  };

  const submitM3u = async (forceM3u = false) => {
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: m3uName.trim(),
          type: 'm3u',
          url: m3uUrl.trim(),
          epgUrl: m3uEpg.trim(),
          forceM3u: Boolean(forceM3u)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar a lista M3U');
      }

      onPlaylistCreated(data.playlist);
      setM3uName('');
      setM3uUrl('');
      setM3uEpg('');
      setXtreamOffer(null);
      setSuccessMsg('Lista adicionada com sucesso!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptXtreamOffer = async () => {
    if (!xtreamOffer) return;
    const { server, username, password } = xtreamOffer;
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: m3uName.trim() || 'IPTV Xtream',
          type: 'xtream',
          url: server,
          username,
          password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha na autenticação com o servidor Xtream Codes');
      }

      onPlaylistCreated(data.playlist);
      setM3uName('');
      setM3uUrl('');
      setM3uEpg('');
      setXtreamOffer(null);
      setSuccessMsg('Conectado via Xtream Codes com sucesso!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineXtreamOffer = async () => {
    setXtreamOffer(null);
    await submitM3u(true);
  };

  const handleCreateXtream = async (e) => {
    e.preventDefault();
    if (!xtreamName || !xtreamServer || !xtreamUser || !xtreamPass) {
      setError('Todos os campos do Xtream Codes são obrigatórios.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: xtreamName.trim(),
          type: 'xtream',
          url: xtreamServer.trim(),
          username: xtreamUser.trim(),
          password: xtreamPass.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha na autenticação com o servidor Xtream Codes');
      }

      onPlaylistCreated(data.playlist);
      setXtreamName('');
      setXtreamServer('');
      setXtreamUser('');
      setXtreamPass('');
      setSuccessMsg('Perfil conectado com sucesso!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Recarregar / Sincronizar lista diretamente com a API
  const handleReload = async (id, e) => {
    e?.stopPropagation();
    setReloadingId(id);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/playlists/${id}/reload`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao recarregar a lista');
      }

      setSuccessMsg(data.message || 'Lista recarregada com sucesso!');
      if (onPlaylistReloaded) {
        onPlaylistReloaded(data.playlist);
      }
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setReloadingId(null);
    }
  };

  // Excluir lista de verdade no servidor e no banco de dados
  const handleDelete = async (id, name, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Tem certeza que deseja apagar a lista "${name}"? Os canais salvos desta lista serão removidos.`)) {
      return;
    }

    setDeletingId(id);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao remover a lista');
      }

      onPlaylistDeleted(id);
      setSuccessMsg(`Lista "${name}" foi apagada com sucesso.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '620px',
        maxHeight: '90vh',
        background: '#0b111d',
        border: '1px solid var(--border-accent)',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 30px var(--accent-subtle)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Header do Modal */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px var(--accent-subtle)'
            }}>
              <Tv size={22} color="var(--text-on-accent)" strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.3px' }}>
                Gerenciador de Perfis e Listas
              </h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>
                Alterne entre seus perfis, recarregue os canais ou adicione novas contas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas Superiores: Perfis Salvos vs Adicionar Perfil */}
        <div style={{
          display: 'flex',
          padding: '14px 24px 0',
          gap: '10px',
          background: 'rgba(11, 17, 29, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <button
            onClick={() => setActiveView('profiles')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px 10px 0 0',
              fontSize: '13px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: activeView === 'profiles' ? 'var(--accent-subtle)' : 'transparent',
              color: activeView === 'profiles' ? 'var(--accent-primary)' : '#94a3b8',
              borderBottom: activeView === 'profiles' ? '2.5px solid var(--accent-primary)' : '2.5px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <UserCheck size={16} />
            Meus Perfis Salvos ({playlists.length})
          </button>

          <button
            onClick={() => setActiveView('login')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px 10px 0 0',
              fontSize: '13px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: activeView === 'login' ? 'var(--accent-subtle)' : 'transparent',
              color: activeView === 'login' ? 'var(--accent-primary)' : '#94a3b8',
              borderBottom: activeView === 'login' ? '2.5px solid var(--accent-primary)' : '2.5px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={16} />
            Conectar Nova Conta / Lista
          </button>
        </div>

        {/* Mensagens de Sucesso e Erro */}
        {error && (
          <div style={{
            margin: '16px 24px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            fontSize: '13px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            margin: '16px 24px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-accent)',
            color: 'var(--accent-bright)',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Corpo do Modal */}
        <div style={{
          padding: '20px 24px 24px',
          overflowY: 'auto',
          flex: 1
        }}>
          {/* VISUALIZAÇÃO 1: PERFIS SALVOS */}
          {activeView === 'profiles' ? (
            <div>
              {playlists.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: '14px',
                  border: '1px dashed rgba(255, 255, 255, 0.1)'
                }}>
                  <Tv size={42} color="#64748b" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', marginBottom: '6px' }}>
                    Nenhum perfil cadastrado
                  </h4>
                  <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '360px', margin: '0 auto 20px' }}>
                    Adicione seus dados de login do Xtream Codes ou link M3U para começar a assistir.
                  </p>
                  <button
                    onClick={() => setActiveView('login')}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      background: 'var(--accent-primary)',
                      color: 'var(--text-on-accent)',
                      fontSize: '13px',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 0 15px var(--accent-subtle)'
                    }}
                  >
                    <Plus size={16} color="var(--text-on-accent)" />
                    Fazer Login Agora
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {playlists.map(p => {
                    const isSelected = selectedPlaylist?.id === p.id;
                    const isReloading = reloadingId === p.id;
                    const isDeleting = deletingId === p.id;

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '16px 18px',
                          borderRadius: '14px',
                          background: isSelected ? 'var(--accent-subtle)' : 'rgba(15, 23, 42, 0.6)',
                          border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: isSelected ? '0 0 20px var(--accent-subtle)' : 'none',
                          transition: 'all 0.2s ease',
                          gap: '12px'
                        }}
                      >
                        {/* Linha Superior: Info Principal do Perfil */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '12px',
                              background: p.type === 'xtream' ? 'var(--accent-subtle)' : 'rgba(56, 189, 248, 0.15)',
                              border: p.type === 'xtream' ? '1px solid var(--border-accent)' : '1px solid rgba(56, 189, 248, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: p.type === 'xtream' ? 'var(--accent-primary)' : '#38bdf8'
                            }}>
                              {p.type === 'xtream' ? <Server size={22} /> : <Link size={22} />}
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
                                  {p.name}
                                </span>
                                {isSelected && (
                                  <span style={{
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    background: 'var(--accent-primary)',
                                    color: 'var(--text-on-accent)',
                                    letterSpacing: '0.4px'
                                  }}>
                                    EM USO
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ textTransform: 'uppercase', fontWeight: '700', color: p.type === 'xtream' ? 'var(--accent-bright)' : '#38bdf8' }}>
                                  {p.type === 'xtream' ? 'Xtream Codes' : 'Lista M3U'}
                                </span>
                                {p.username && <span>• Usuário: <strong style={{ color: '#f8fafc' }}>{p.username}</strong></span>}
                              </div>
                            </div>
                          </div>

                          {/* Botão Entrar ou Indicador Ativo */}
                          <div>
                            {!isSelected ? (
                              <button
                                onClick={() => {
                                  onSelectPlaylist(p);
                                  onClose();
                                }}
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: '8px',
                                  background: 'var(--accent-primary)',
                                  color: 'var(--text-on-accent)',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: 'pointer',
                                  boxShadow: '0 0 10px var(--accent-subtle)'
                                }}
                              >
                                <LogIn size={15} color="var(--text-on-accent)" />
                                Entrar neste Perfil
                              </button>
                            ) : (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: 'var(--accent-bright)',
                                fontSize: '12px',
                                fontWeight: '700',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                background: 'var(--accent-subtle)',
                                border: '1px solid var(--border-accent)'
                              }}>
                                <Check size={16} />
                                Perfil Ativo
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Linha Intermediária: Detalhes de Conta (Validade, Servidor) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '8px 12px',
                          background: 'rgba(0, 0, 0, 0.25)',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#94a3b8'
                        }}>
                          {p.url && (
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }} title={p.url}>
                              Servidor: <strong style={{ color: '#cbd5e1' }}>{p.url}</strong>
                            </span>
                          )}
                          {p.userInfo?.exp_date && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={13} color="var(--accent-primary)" />
                              Expira em: <strong style={{ color: '#cbd5e1' }}>{formatDate(p.userInfo.exp_date)}</strong>
                            </span>
                          )}
                          {p.channelsCount > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Layers size={13} color="#38bdf8" />
                              {p.channelsCount} canais
                            </span>
                          )}
                        </div>

                        {/* Linha Inferior: Botões de Ação (Recarregar e Apagar) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: '6px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Botão Recarregar */}
                            <button
                              onClick={(e) => handleReload(p.id, e)}
                              disabled={isReloading}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#f8fafc',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: isReloading ? 'not-allowed' : 'pointer',
                                opacity: isReloading ? 0.6 : 1
                              }}
                              title="Recarregar canais e sincronizar com o servidor"
                            >
                              <RefreshCw size={14} className={isReloading ? "animate-spin" : ""} color="var(--accent-primary)" />
                              {isReloading ? 'Sincronizando...' : 'Recarregar Lista'}
                            </button>
                          </div>

                          {/* Botão Apagar */}
                          <button
                            onClick={(e) => handleDelete(p.id, p.name, e)}
                            disabled={isDeleting}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#f87171',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: isDeleting ? 'not-allowed' : 'pointer'
                            }}
                            title="Remover definitivamente esta lista do aplicativo"
                          >
                            <Trash2 size={14} />
                            {isDeleting ? 'Removendo...' : 'Apagar Lista'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Botão de Limpar Todas as Listas (Reset) */}
              {playlists.length > 0 && (
                <div style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Deseja recomeçar a configuração do zero?
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm('⚠️ Tem certeza que deseja apagar TODOS os perfis e limpar o cache do aplicativo?')) {
                        onResetApp && onResetApp();
                      }
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Limpar Todos os Perfis
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* VISUALIZAÇÃO 2: FORMULÁRIO DE LOGIN / CONEXÃO */
            <div>
              {/* Seletor do Tipo de Login: Xtream vs M3U */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setLoginType('xtream')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: loginType === 'xtream' ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.04)',
                    color: loginType === 'xtream' ? 'var(--accent-primary)' : '#94a3b8',
                    border: loginType === 'xtream' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  <Server size={15} />
                  Login Xtream Codes (Recomendado)
                </button>

                <button
                  type="button"
                  onClick={() => setLoginType('m3u')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: loginType === 'm3u' ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.04)',
                    color: loginType === 'm3u' ? 'var(--accent-primary)' : '#94a3b8',
                    border: loginType === 'm3u' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  <Link size={15} />
                  Link M3U / URL
                </button>
              </div>

              {loginType === 'xtream' ? (
                /* Formulário Xtream Codes */
                <form onSubmit={handleCreateXtream} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                      Nome do Perfil
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: IPTV Premium"
                      value={xtreamName}
                      onChange={(e) => setXtreamName(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#ffffff',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                      Endereço do Servidor (Host / URL)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: http://servidor.com:8080"
                      value={xtreamServer}
                      onChange={(e) => setXtreamServer(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#ffffff',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                        Usuário
                      </label>
                      <input
                        type="text"
                        placeholder="Seu usuário"
                        value={xtreamUser}
                        onChange={(e) => setXtreamUser(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#ffffff',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                        Senha
                      </label>
                      <input
                        type="password"
                        placeholder="Sua senha"
                        value={xtreamPass}
                        onChange={(e) => setXtreamPass(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#ffffff',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                      marginTop: '8px',
                      padding: '13px',
                      borderRadius: '10px',
                      background: 'var(--accent-primary)',
                      color: 'var(--text-on-accent)',
                      fontSize: '14px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 0 20px var(--accent-subtle)',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.7 : 1
                    }}
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" color="var(--text-on-accent)" /> : <ShieldCheck size={18} color="var(--text-on-accent)" />}
                    {isLoading ? 'Autenticando...' : 'Fazer Login e Conectar'}
                  </button>
                </form>
              ) : (
                /* Formulário M3U */
                <form onSubmit={handleCreateM3U} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                      Nome de Identificação
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Lista Principal"
                      value={m3uName}
                      onChange={(e) => setM3uName(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#ffffff',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                      URL ou Caminho do Arquivo M3U / M3U8
                    </label>
                    <input
                      type="text"
                      placeholder="https://servidor.com/lista.m3u ou C:\caminho\lista.m3u"
                      value={m3uUrl}
                      onChange={(e) => setM3uUrl(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#ffffff',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                      Guia EPG XMLTV (Opcional)
                    </label>
                    <input
                      type="url"
                      placeholder="http://servidor.com/epg.xml"
                      value={m3uEpg}
                      onChange={(e) => setM3uEpg(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#ffffff',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                      marginTop: '8px',
                      padding: '13px',
                      borderRadius: '10px',
                      background: 'var(--accent-primary)',
                      color: 'var(--text-on-accent)',
                      fontSize: '14px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 0 20px var(--accent-subtle)',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.7 : 1
                    }}
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" color="var(--text-on-accent)" /> : <Check size={18} color="var(--text-on-accent)" />}
                    {isLoading ? 'Processando Lista...' : 'Adicionar e Carregar Lista'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* MODAL SOBREPOSTO DE OFERTA: CONVERSÃO DE M3U PARA XTREAM CODES */}
        {xtreamOffer && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.94)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 100,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '480px',
              background: 'linear-gradient(155deg, #0d1527 0%, #080c18 100%)',
              border: '1.5px solid var(--accent-primary)',
              borderRadius: '16px',
              padding: '26px 24px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 35px var(--accent-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative'
            }}>
              {/* Botão Fechar X */}
              <button
                onClick={() => setXtreamOffer(null)}
                title="Cancelar e voltar"
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <X size={16} />
              </button>

              {/* Cabeçalho */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'var(--accent-subtle)',
                  border: '1.5px solid var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  flexShrink: 0,
                  boxShadow: '0 0 20px var(--accent-subtle)'
                }}>
                  <Server size={24} />
                </div>
                <div>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    color: 'var(--accent-primary)',
                    letterSpacing: '0.8px',
                    display: 'block',
                    marginBottom: '2px'
                  }}>
                    Servidor Xtream Codes Detectado
                  </span>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#ffffff', margin: 0, letterSpacing: '-0.3px' }}>
                    Deseja conectar via Xtream Codes?
                  </h3>
                </div>
              </div>

              {/* Descrição */}
              <p style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.5', margin: 0 }}>
                Identificamos que este link contém credenciais de acesso direto a um servidor Xtream. A conexão via <strong>Xtream Codes API</strong> oferece navegação instantânea por categorias, sinopses de filmes e séries, e carregamento sob demanda em SSD.
              </p>

              {/* Card de Detalhes Detectados */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Servidor:</span>
                  <span style={{ color: '#f8fafc', fontWeight: '700', maxWidth: '270px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {xtreamOffer.server}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Usuário:</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: '800' }}>
                    {xtreamOffer.username}
                  </span>
                </div>
              </div>

              {/* Botões de Decisão */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleAcceptXtreamOffer}
                  disabled={isLoading}
                  style={{
                    padding: '13px 18px',
                    borderRadius: '10px',
                    background: 'var(--accent-primary)',
                    color: 'var(--text-on-accent)',
                    fontSize: '13.5px',
                    fontWeight: '800',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 0 25px var(--accent-subtle)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" color="var(--text-on-accent)" /> : <Sparkles size={18} color="var(--text-on-accent)" />}
                  {isLoading ? 'Autenticando no Xtream...' : '✨ Conectar como Xtream Codes (Recomendado)'}
                </button>

                <button
                  type="button"
                  onClick={handleDeclineXtreamOffer}
                  disabled={isLoading}
                  style={{
                    padding: '11px 18px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Link size={15} />
                  Continuar como Lista M3U Normal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlaylistModal;
