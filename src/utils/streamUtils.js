/**
 * Utilitários para detecção e tratamento de canais e transmissões temporárias (jogos, eventos ao vivo, PPV)
 */

export function isTemporaryChannel(stream) {
  if (!stream) return false;

  const rawName = (stream.name || stream.title || '').trim();
  const name = rawName.toLowerCase();
  const category = (stream.category || '').toLowerCase();

  // 1. Padrões claros de confronto direto de futebol/lutas (ex: "Flamengo x Palmeiras", "Chelsea vs Arsenal")
  // Expressão com espaços ou pontuação ao redor de x / vs
  if (/\s+(x|vs\.?|contra)\s+/i.test(name)) {
    return true;
  }

  // 2. Padrão de times conhecidos com x ou vs sem espaçamento estrito
  const brazilianClubs = [
    'flamengo', 'palmeiras', 'corinthians', 'sao paulo', 'são paulo', 'santos',
    'gremio', 'grêmio', 'internacional', 'inter', 'vasco', 'botafogo', 'fluminense',
    'atletico', 'atlético', 'cruzeiro', 'bahia', 'vitoria', 'vitória', 'fortaleza',
    'ceara', 'ceará', 'sport', 'coritiba', 'athletico', 'goias', 'goiás', 'cuiaba', 'cuiabá',
    'real madrid', 'barcelona', 'psg', 'liverpool', 'manchester', 'chelsea', 'arsenal',
    'bayern', 'juventus', 'milan', 'inter milan', 'benfica', 'porto', 'sporting'
  ];

  const clubMatches = brazilianClubs.filter(club => name.includes(club));
  if (clubMatches.length >= 2) {
    return true; // Contém 2 times no nome -> é um jogo de futebol
  }

  // 3. Palavras-chave de categorias que contêm canais temporários de jogos
  const eventCategories = [
    'jogos', 'jogo', 'eventos', 'evento', 'temporario', 'temporário',
    'ppv', 'futebol ao vivo', 'transmissao', 'transmissão', 'premiere club',
    'ufc', 'combate', 'confronto', 'copa', 'libertadores', 'sul-americana',
    'sulamericana', 'champions', 'brasileirao', 'brasileirão'
  ];

  if (eventCategories.some(cat => category.includes(cat))) {
    // Se a categoria é de jogos/eventos e o canal tem data, hora ou x/vs/ao vivo
    if (/\b(x|vs|ao vivo|jogo|partida|rodada|\d{1,2}h|\d{1,2}:\d{2})\b/i.test(name)) {
      return true;
    }
  }

  // 4. Marcadores específicos em títulos de canais
  if (/\b(temporario|temporário|jogo de hoje|jogos de hoje|evento especial|canal temporario)\b/i.test(name)) {
    return true;
  }

  return false;
}

