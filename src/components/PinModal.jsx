import React, { useState, useEffect } from 'react';
import { Lock, X, KeyRound, AlertCircle, CheckCircle2, ShieldCheck, ShieldAlert } from 'lucide-react';

export function PinModal({
  isOpen,
  onClose,
  onSuccess
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [stepChange, setStepChange] = useState('current'); // 'current' | 'new'
  const [currentPinAttempt, setCurrentPinAttempt] = useState('');
  const [changeSuccess, setChangeSuccess] = useState(false);

  // Obtém o PIN salvo no navegador ou usa o padrão '0000'
  const getSavedPin = () => {
    try {
      return localStorage.getItem('orizon_adult_pin') || '0000';
    } catch {
      return '0000';
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setErrorMessage('');
      setIsChangingPin(false);
      setStepChange('current');
      setCurrentPinAttempt('');
      setChangeSuccess(false);
    }
  }, [isOpen]);

  // Suporte a teclado físico (números de 0 a 9, backspace, enter, esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setPin(prev => prev.slice(0, -1));
        setError(false);
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (pin.length < 4) {
          handleDigitPress(e.key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, isChangingPin, stepChange]);

  if (!isOpen) return null;

  const handleDigitPress = (digit) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);

    if (newPin.length === 4) {
      validateCompletePin(newPin);
    }
  };

  const validateCompletePin = (enteredPin) => {
    const savedPin = getSavedPin();

    if (!isChangingPin) {
      // Modo Normal: Desbloquear Conteúdo Adulto
      if (enteredPin === savedPin) {
        onSuccess();
      } else {
        setError(true);
        setErrorMessage('Senha incorreta. A senha padrão é 0000.');
        setTimeout(() => {
          setPin('');
        }, 600);
      }
    } else {
      // Modo Alteração de Senha
      if (stepChange === 'current') {
        if (enteredPin === savedPin) {
          setCurrentPinAttempt(enteredPin);
          setStepChange('new');
          setPin('');
          setError(false);
          setErrorMessage('');
        } else {
          setError(true);
          setErrorMessage('Senha atual incorreta.');
          setTimeout(() => {
            setPin('');
          }, 600);
        }
      } else if (stepChange === 'new') {
        try {
          localStorage.setItem('orizon_adult_pin', enteredPin);
          setChangeSuccess(true);
          setTimeout(() => {
            setIsChangingPin(false);
            setChangeSuccess(false);
            onSuccess();
          }, 1200);
        } catch {
          setError(true);
          setErrorMessage('Erro ao salvar nova senha.');
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
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
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: '#0d131f',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '24px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(239, 68, 68, 0.15)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
          title="Fechar"
        >
          <X size={16} />
        </button>

        {/* Cabeçalho do Modal */}
        <div style={{
          padding: '34px 28px 18px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* Badge com Ícone de Cadeado Vermelho / Escudo */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: changeSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
            border: `1.5px solid ${changeSuccess ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.35)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: changeSuccess ? '0 0 25px rgba(16, 185, 129, 0.25)' : '0 0 25px rgba(239, 68, 68, 0.25)'
          }}>
            {changeSuccess ? (
              <CheckCircle2 size={32} color="#10b981" />
            ) : isChangingPin ? (
              <KeyRound size={30} color="#f43f5e" />
            ) : (
              <ShieldAlert size={32} color="#ef4444" />
            )}
          </div>

          <div>
            <h3 style={{
              fontSize: '19px',
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: '-0.3px',
              marginBottom: '6px'
            }}>
              {changeSuccess ? (
                'Senha Alterada com Sucesso!'
              ) : isChangingPin ? (
                stepChange === 'current' ? 'Digite a Senha Atual' : 'Defina a Nova Senha de 4 Dígitos'
              ) : (
                'Controle Parental (+18)'
              )}
            </h3>

            <p style={{
              fontSize: '12px',
              color: '#94a3b8',
              lineHeight: '1.5',
              maxWidth: '280px'
            }}>
              {changeSuccess ? (
                'Sua nova senha foi salva e a categoria será desbloqueada.'
              ) : isChangingPin ? (
                stepChange === 'current' ? 'Para segurança, confirme sua senha atual primeiro.' : 'Escolha uma nova senha de 4 números.'
              ) : (
                'Digite sua senha de 4 dígitos para acessar o conteúdo adulto.'
              )}
            </p>
          </div>

          {/* Dica da senha padrão */}
          {!isChangingPin && !changeSuccess && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '11px',
              fontWeight: '600',
              color: '#64748b'
            }}>
              <span>Senha padrão:</span>
              <strong style={{ color: 'var(--accent-bright)' }}>0000</strong>
            </div>
          )}

          {/* Exibição dos 4 Dígitos (Bolinhas) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            marginTop: '10px',
            marginBottom: '4px'
          }}>
            {[0, 1, 2, 3].map(idx => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `2px solid ${
                      error 
                        ? '#ef4444' 
                        : isFilled 
                          ? 'var(--accent-primary)' 
                          : 'rgba(255, 255, 255, 0.2)'
                    }`,
                    background: isFilled 
                      ? (error ? '#ef4444' : 'var(--accent-primary)') 
                      : 'transparent',
                    boxShadow: isFilled 
                      ? (error ? '0 0 12px rgba(239, 68, 68, 0.8)' : '0 0 12px var(--accent-subtle)') 
                      : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                />
              );
            })}
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: '700',
              animation: 'shake 0.3s'
            }}>
              <AlertCircle size={14} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Teclado Numérico Virtual */}
        <div style={{
          padding: '0 28px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px'
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleDigitPress(num.toString())}
              style={{
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontSize: '18px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              {num}
            </button>
          ))}

          {/* Botão Limpar */}
          <button
            onClick={handleClear}
            style={{
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.5)';
            }}
          >
            Limpar
          </button>

          {/* Dígito 0 */}
          <button
            onClick={() => handleDigitPress('0')}
            style={{
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            0
          </button>

          {/* Botão Apagar (Backspace) */}
          <button
            onClick={handleBackspace}
            style={{
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              color: '#94a3b8',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.5)';
            }}
            title="Apagar"
          >
            ⌫
          </button>
        </div>

        {/* Rodapé: Alterar Senha */}
        <div style={{
          padding: '12px 24px 18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {!isChangingPin ? (
            <button
              onClick={() => {
                setIsChangingPin(true);
                setStepChange('current');
                setPin('');
                setError(false);
                setErrorMessage('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
            >
              <KeyRound size={13} />
              <span>Deseja alterar a senha de 4 dígitos?</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setIsChangingPin(false);
                setPin('');
                setError(false);
                setErrorMessage('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Voltar para Desbloqueio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
