// Utilitário de Imagens e Normalização de Gêneros de Filmes e Séries
// Fornece tríades (3 imagens em alta definição) por gênero e algoritmo de rotação em dias ímpares

export const GENRE_IMAGE_TRIPLETS = {
  animacao: [
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80', // Arte estúdio de animação
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80', // Personagens e fantasia digital
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80'  // Ilustração colorida moderna
  ],
  aventura: [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80', // Montanhas dramáticas e exploradores
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80', // Paisagem de cânions e floresta
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&q=80'  // Expedição ao ar livre
  ],
  cinema: [
    'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&q=80', // Sala de cinema clássica e letreiro
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80', // Poltronas de cinema e tela
    'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&q=80'  // Claquete e rolo cinematográfico
  ],
  comedia: [
    'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=400&q=80', // Risadas e entretenimento
    'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400&q=80', // Amigos rindo juntos
    'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=400&q=80'  // Luzes festivas e cores alegres
  ],
  crime: [
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80', // Beco escuro policial noir
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80', // Luzes misteriosas de metrópole
    'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400&q=80'  // Investigação urbana sob chuva
  ],
  documentarios: [
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80', // Câmera de filmagem e produção
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80', // Vida selvagem e natureza
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80'  // Terra do espaço / ciência
  ],
  drama: [
    'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=400&q=80', // Expressão reflexiva e sombras
    'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=400&q=80', // Luz dramática e intensidade
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80'  // Close cinematográfico teatral
  ],
  acao: [
    'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&q=80', // Explosões e cenas de ação
    'https://images.unsplash.com/photo-1533613220915-609f661a6fe1?w=400&q=80', // Luzes de velocidade e impacto
    'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&q=80'  // Fogo e intensidade neon
  ],
  fantasia: [
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80', // Castelos medievais épicos
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80', // Floresta mística iluminada
    'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=400&q=80'  // Céu místico estrelado
  ],
  ficcao: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80', // Espaço e tecnologia sci-fi
    'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&q=80', // Portais cósmicos e galáxias
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80'  // Futuro cyberpunk
  ],
  terror: [
    'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&q=80', // Noite assustadora e neblina
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80', // Casa abandonada e sombras
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80'  // Floresta escura e mistério
  ],
  suspense: [
    'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400&q=80', // Mistério sob a chuva
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80', // Silhueta e suspense
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80'  // Olhar enigmático
  ],
  familia: [
    'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&q=80', // Família reunida assistindo tv
    'https://images.unsplash.com/photo-1536640712-4d4c36ff0e4e?w=400&q=80', // Crianças e diversão
    'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?w=400&q=80'  // Calor familiar e aconchego
  ],
  faroeste: [
    'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=400&q=80', // Deserto árido do oeste
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80', // Montanhas de western americano
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80'  // Horizonte dourado de pôr do sol
  ],
  romance: [
    'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&q=80', // Casal sob pôr do sol
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&q=80', // Encontro romântico
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80'  // Momento a dois à luz suave
  ],
  guerra: [
    'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&q=80', // Campo de batalha e fumaça
    'https://images.unsplash.com/photo-1533613220915-609f661a6fe1?w=400&q=80', // Soldados e trincheiras
    'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&q=80'  // Aeronaves e épico militar
  ],
  historia: [
    'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&q=80', // Livros antigos e pergaminhos
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80', // Monumentos históricos
    'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=400&q=80'  // Ruínas e arquitetura antiga
  ],
  padrao: [
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80',
    'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&q=80',
    'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&q=80'
  ]
};

/**
 * Remove prefixos de operadoras e listas (ex: "FILMES | AVENTURA" -> "AVENTURA")
 */
export function cleanGenreName(rawName = '') {
  if (!rawName) return 'GERAL';
  let clean = rawName
    .replace(/^(filmes?|series?|séries?|vod|canais|4k|fhd|hd)\s*[\/|\-:]\s*/i, '')
    .replace(/^[\s\-–—|:]+/, '')
    .trim();
  
  return clean || rawName.trim().toUpperCase();
}

/**
 * Identifica a chave canônica do gênero para busca de imagens
 */
export function detectGenreKey(rawName = '') {
  const norm = rawName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/animac|desenho|anime|kids|infantil/i.test(norm)) return 'animacao';
  if (/aventur/i.test(norm)) return 'aventura';
  if (/cine|lancamento|premiere|cinema/i.test(norm)) return 'cinema';
  if (/comed|humor|engracad/i.test(norm)) return 'comedia';
  if (/crime|policial|investiga|gangster|mafia/i.test(norm)) return 'crime';
  if (/docum|historiador|natureza|biograf/i.test(norm)) return 'documentarios';
  if (/drama|novela/i.test(norm)) return 'drama';
  if (/acao|action/i.test(norm)) return 'acao';
  if (/fantas|mitolog|magia/i.test(norm)) return 'fantasia';
  if (/ficcao|scifi|sci-fi|espac/i.test(norm)) return 'ficcao';
  if (/terror|horror|medo/i.test(norm)) return 'terror';
  if (/suspens|thriller|mister/i.test(norm)) return 'suspense';
  if (/famil|todas as idades/i.test(norm)) return 'familia';
  if (/faroeste|western/i.test(norm)) return 'faroeste';
  if (/romanc|amor|paixao/i.test(norm)) return 'romance';
  if (/guerra|militar|combate/i.test(norm)) return 'guerra';
  if (/histor/i.test(norm)) return 'historia';

  return 'padrao';
}

/**
 * Retorna uma das 3 imagens temáticas do gênero.
 * Em DIAS ÍMPARES (1, 3, 5, 7, ...), alterna ciclicamente entre as 3 opções.
 * Em DIAS PARES, mantém a imagem de índice 0 como base estável.
 * Dessa forma, a imagem varia entre as 3 exclusivamente em dias ímpares!
 */
export function getGenreImage(rawCategoryName, dayOfMonth = new Date().getDate()) {
  const key = detectGenreKey(rawCategoryName);
  const triplet = GENRE_IMAGE_TRIPLETS[key] || GENRE_IMAGE_TRIPLETS.padrao;

  const isOddDay = dayOfMonth % 2 !== 0;

  let imageIndex = 0;
  if (isOddDay) {
    // Alterna dinamicamente entre as 3 opções (0, 1, 2) nos dias ímpares do mês
    imageIndex = (Math.floor(dayOfMonth / 2)) % 3;
  } else {
    // Em dias pares, base estável
    imageIndex = 0;
  }

  return triplet[imageIndex] || triplet[0];
}

/**
 * Retorna a capa REAL da categoria a partir do array de filmes/séries contidos nela.
 * Regra dos DIAS ÍMPARES:
 * - Em DIAS ÍMPARES (1, 3, 5, 7, ...), rotaciona ciclicamente entre as 3 capas reais dos títulos daquela categoria.
 * - Em DIAS PARES (2, 4, 6, ...), mantém a capa 1 principal da categoria como referência estável.
 * - Se a categoria tiver 1 ou 2 imagens, rotaciona entre as disponíveis.
 */
export function getCategoryCover(cat, dayOfMonth = new Date().getDate()) {
  const previews = (cat && Array.isArray(cat.previewImages) && cat.previewImages.length > 0)
    ? cat.previewImages.filter(img => img && typeof img === 'string' && img.startsWith('http'))
    : [];

  if (previews.length > 0) {
    const isOddDay = dayOfMonth % 2 !== 0;
    const index = isOddDay ? (Math.floor(dayOfMonth / 2)) % previews.length : 0;
    return previews[index] || previews[0];
  }

  // Fallback de transição apenas se o provedor ainda não carregou os pôsteres
  return getGenreImage(typeof cat === 'string' ? cat : (cat?.name || ''));
}

