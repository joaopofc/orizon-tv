import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDataDir = process.env.ORIZON_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const POSTERS_DIR = path.join(baseDataDir, 'cache', 'posters');

// Garante que o diretório de cache de posters existe
if (!fs.existsSync(POSTERS_DIR)) {
  fs.mkdirSync(POSTERS_DIR, { recursive: true });
}

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

export async function handleImageCache(req, res) {
  const imageUrl = req.query.url;

  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
    return res.status(400).send('URL de imagem inválida');
  }

  // Gera hash único para o arquivo em disco a partir da URL
  const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
  const extension = imageUrl.includes('.png') ? '.png' : '.jpg';
  const filePath = path.join(POSTERS_DIR, `${hash}${extension}`);

  // Configura cabeçalhos de cache no navegador (1 ano)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 1. HIT: Se já estiver salvo no SSD local, entrega imediatamente (1ms)
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', extension === '.png' ? 'image/png' : 'image/jpeg');
    res.setHeader('X-Cache', 'HIT-SSD');
    return fs.createReadStream(filePath).pipe(res);
  }

  // 2. MISS: Baixa da internet, salva no SSD e entrega ao app
  try {
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
      timeout: 12000,
      httpAgent,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      validateStatus: (status) => status >= 200 && status < 400
    });

    const contentType = response.headers['content-type'] || (extension === '.png' ? 'image/png' : 'image/jpeg');
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Cache', 'MISS-FETCHED');

    // Grava no SSD e envia ao cliente simultaneamente
    const diskWriter = fs.createWriteStream(filePath);
    response.data.pipe(diskWriter);
    response.data.pipe(res);

    diskWriter.on('error', (err) => {
      console.error('[Image Cache Disk Error]', err.message);
    });

  } catch (err) {
    // Se falhar o download remoto, responde com 404 limpo para o front exibir placeholder
    if (!res.headersSent) {
      res.status(404).send('Imagem indisponível');
    }
  }
}

export function clearImageCache() {
  try {
    if (fs.existsSync(POSTERS_DIR)) {
      const files = fs.readdirSync(POSTERS_DIR);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(POSTERS_DIR, file));
        } catch {}
      }
      return { success: true, count: files.length };
    }
  } catch (err) {
    console.error('Erro ao limpar cache de posters:', err);
  }
  return { success: false, count: 0 };
}
