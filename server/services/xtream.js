import axios from 'axios';

/**
 * Cliente para autenticação e consumo da API Xtream Codes
 */
export class XtreamCodesClient {
  constructor(serverUrl, username, password) {
    let cleanUrl = (serverUrl || '').trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    try {
      const parsed = new URL(cleanUrl);
      // Extrai protocolo e host/porta (remove /c, /player_api.php ou outros sufixos que geram 404)
      this.serverUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      this.serverUrl = cleanUrl.replace(/\/+$/, '');
    }
    this.username = (username || '').trim();
    this.password = (password || '').trim();
  }

  get apiUrl() {
    return `${this.serverUrl}/player_api.php`;
  }

  async authenticate() {
    try {
      const response = await axios.get(this.apiUrl, {
        params: {
          username: this.username,
          password: this.password
        },
        timeout: 12000,
        headers: {
          'User-Agent': 'IPTVSmartersPlayer'
        }
      });

      const data = response.data;
      if (data && data.user_info && data.user_info.auth === 1) {
        return {
          success: true,
          userInfo: data.user_info,
          serverInfo: data.server_info
        };
      } else {
        return {
          success: false,
          error: 'Credenciais inválidas ou conta expirada.'
        };
      }
    } catch (err) {
      const statusCode = err.response ? err.response.status : null;
      let userFriendly = err.message;
      if (statusCode === 404) {
        userFriendly = 'Servidor retornou 404 (Sua conta teste expirou ou a URL do servidor IPTV foi alterada pelo provedor).';
      } else if (statusCode === 401 || statusCode === 403) {
        userFriendly = 'Acesso não autorizado pelo servidor (usuário ou senha incorretos).';
      }
      return {
        success: false,
        statusCode,
        error: `Erro ao conectar ao servidor Xtream: ${userFriendly}`
      };
    }
  }

  async getLiveCategories() {
    const res = await axios.get(this.apiUrl, {
      params: { username: this.username, password: this.password, action: 'get_live_categories' },
      timeout: 15000
    });
    return res.data || [];
  }

  async getLiveStreams(categoryId = null) {
    const params = { username: this.username, password: this.password, action: 'get_live_streams' };
    if (categoryId) params.category_id = categoryId;
    const res = await axios.get(this.apiUrl, { params, timeout: 25000 });
    return (res.data || []).map(stream => ({
      id: `xt_live_${stream.stream_id}`,
      streamId: stream.stream_id,
      name: stream.name,
      num: stream.num,
      category: stream.category_name || 'Geral',
      categoryId: stream.category_id,
      logo: stream.stream_icon,
      epgChannelId: stream.epg_channel_id,
      type: 'live',
      url: `${this.serverUrl}/live/${this.username}/${this.password}/${stream.stream_id}.m3u8`
    }));
  }

  async getVodCategories() {
    const res = await axios.get(this.apiUrl, {
      params: { username: this.username, password: this.password, action: 'get_vod_categories' },
      timeout: 15000
    });
    return res.data || [];
  }

  async getVodStreams(categoryId = null) {
    const params = { username: this.username, password: this.password, action: 'get_vod_streams' };
    if (categoryId) params.category_id = categoryId;
    const res = await axios.get(this.apiUrl, { params, timeout: 25000 });
    return (res.data || []).map(vod => ({
      id: `xt_vod_${vod.stream_id}`,
      streamId: vod.stream_id,
      name: vod.name,
      rating: vod.rating,
      category: vod.category_name || 'Filmes',
      categoryId: vod.category_id,
      logo: vod.stream_icon,
      extension: vod.container_extension || 'mp4',
      type: 'movie',
      url: `${this.serverUrl}/movie/${this.username}/${this.password}/${vod.stream_id}.${vod.container_extension || 'mp4'}`
    }));
  }

  async getSeriesCategories() {
    const res = await axios.get(this.apiUrl, {
      params: { username: this.username, password: this.password, action: 'get_series_categories' },
      timeout: 15000
    });
    return res.data || [];
  }

  async getSeries(categoryId = null) {
    const params = { username: this.username, password: this.password, action: 'get_series' };
    if (categoryId) params.category_id = categoryId;
    const res = await axios.get(this.apiUrl, { params, timeout: 25000 });
    return (res.data || []).map(series => ({
      id: `xt_series_${series.series_id}`,
      seriesId: series.series_id,
      name: series.name,
      rating: series.rating,
      category: series.category_name || 'Séries',
      categoryId: series.category_id,
      logo: series.cover,
      plot: series.plot,
      type: 'series'
    }));
  }

  async getSeriesInfo(seriesId) {
    const res = await axios.get(this.apiUrl, {
      params: { username: this.username, password: this.password, action: 'get_series_info', series_id: seriesId },
      timeout: 15000
    });
    return res.data;
  }

  async getShortEPG(streamId) {
    try {
      const res = await axios.get(this.apiUrl, {
        params: { username: this.username, password: this.password, action: 'get_short_epg', stream_id: streamId },
        timeout: 8000
      });
      return res.data?.epg_listings || [];
    } catch {
      return [];
    }
  }
}
