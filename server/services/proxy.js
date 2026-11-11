import axios from 'axios';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// Agentes HTTP/HTTPS com keep-alive e ignorando erros de certificados comuns em servidores IPTV
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

export async function handleStreamProxy(req, res) {
  const targetUrl = req.query.url;
  const customUa = req.query.ua || req.headers['x-custom-ua'] || 'VLC/3.0.18 LibVLC/3.0.18';
  const customReferer = req.query.referer || req.headers['x-custom-referer'] || '';

  if (!targetUrl) {
    return res.status(400).send('URL do stream não informada');
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const headers = {
      'User-Agent': customUa,
      'Accept': '*/*',
      'Connection': 'keep-alive'
    };

    if (customReferer) {
      headers['Referer'] = customReferer;
    }

    // Copia headers de Range se o player solicitar (comum em VOD/MP4/HLS)
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await axios({
      method: 'GET',
      url: targetUrl,
      headers,
      responseType: 'stream',
      timeout: 25000,
      httpAgent,
      httpsAgent,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });

    const contentType = response.headers['content-type'] || '';
    const isM3U8 = targetUrl.includes('.m3u8') || 
                   contentType.includes('application/vnd.apple.mpegurl') || 
                   contentType.includes('application/x-mpegurl') ||
                   contentType.includes('text/plain');

    // Headers CORS permissivos para o player
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Se for playlist M3U8, reescreve as URLs para passar pelo proxy
    if (isM3U8) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      
      let manifestData = '';
      response.data.on('data', (chunk) => {
        manifestData += chunk.toString('utf-8');
      });

      response.data.on('end', () => {
        const rewritten = rewriteM3U8(manifestData, targetUrl, req.protocol + '://' + req.get('host'));
        res.send(rewritten);
      });

      response.data.on('error', (err) => {
        console.error('[Proxy M3U8 Error]', err.message);
        if (!res.headersSent) res.status(502).send('Falha ao processar M3U8');
      });

    } else {
      // Repasse de fluxo binário (.ts, .mp4, audio)
      res.setHeader('Content-Type', contentType || 'video/mp2t');
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', response.headers['content-range']);
        res.status(206);
      } else {
        res.status(response.status || 200);
      }

      response.data.pipe(res);

      req.on('close', () => {
        if (response.data && typeof response.data.destroy === 'function') {
          response.data.destroy();
        }
      });
    }

  } catch (err) {
    console.error(`[Proxy Error] ${targetUrl}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Não foi possível carregar o stream através do proxy',
        details: err.message
      });
    }
  }
}

/**
 * Reescreve os caminhos do manifesto HLS para passar pelo proxy local
 */
function rewriteM3U8(content, baseUrl, proxyHost) {
  const lines = content.split('\n');
  const result = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      // Tags como #EXT-X-KEY:METHOD=AES-128,URI="http://..."
      if (trimmed.includes('URI="')) {
        const keyMatch = trimmed.match(/URI="([^"]+)"/);
        if (keyMatch) {
          const keyUrl = resolveUrl(keyMatch[1], baseUrl);
          const proxiedKey = `${proxyHost}/api/stream?url=${encodeURIComponent(keyUrl)}`;
          line = line.replace(keyMatch[0], `URI="${proxiedKey}"`);
        }
      }
      result.push(line);
    } else {
      // É uma URL de segmento ou sub-manifesto
      const absoluteSegmentUrl = resolveUrl(trimmed, baseUrl);
      const proxiedUrl = `${proxyHost}/api/stream?url=${encodeURIComponent(absoluteSegmentUrl)}`;
      result.push(proxiedUrl);
    }
  }

  return result.join('\n');
}

function resolveUrl(relative, base) {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}
