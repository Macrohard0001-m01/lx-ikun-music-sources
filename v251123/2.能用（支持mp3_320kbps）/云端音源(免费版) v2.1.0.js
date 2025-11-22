/*!
 * @name 云端音源(免费版)
 * @description 仅支持 128k/320k 音质, 每日2000次数, 2025/11/18
 * @version v2.1.0
 * @author BJ
 */
(function() {
  // 配置信息
  const WORKER_URL = "https://tg.beiji.qzz.io";
  const INSTALL_KEY = "nzLmDjNPWTiCmqPUPIFbpNsQEsP9xSDN";
  const USER_PERMISSION = 'free';
  
  const CONFIG = {
    DEBUG_MODE: true,  // 开启调试模式
    RETRY: {
      enabled: true,
      maxAttempts: 3,
      delay: 1000,
      retryableErrors: ['网络错误', '连接超时', 'ECONNRESET', 'ETIMEDOUT']
    },
    TIMEOUT: 15000,
    VERSION: "2.0.0",
    CLIENT_NAME: "lx-music-cloud-aggregator"
  };
  
  const MUSIC_QUALITY = {
    kw: ["128k", "320k", "flac", "flac24bit", "hires"],
    mg: ["128k", "320k", "flac", "flac24bit", "hires"],
    kg: ["128k", "320k", "flac", "flac24bit", "hires", "atmos", "master"],
    tx: ["128k", "320k", "flac", "flac24bit", "hires", "atmos", "atmos_plus", "master"],
    wy: ["128k", "320k", "flac", "flac24bit", "hires", "atmos", "master"],
    git: ["128k", "320k", "flac"]
  };
  
  const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY);
  const { EVENT_NAMES, request, on, send, utils, env, version } = globalThis.lx || {};
  
  let CURRENT_TOKEN = null;
  let activationPromise = null;
  
  function log(level, ...args) {
    if (!CONFIG.DEBUG_MODE && level === 'debug') return;
    const timestamp = new Date().toISOString();
    const prefix = '[' + timestamp + '] [云端版-' + level.toUpperCase() + ']';
    console.log(prefix, ...args);
  }
  
  function getStorageKey() {
    return 'lx_music_derived_token_' + INSTALL_KEY.substring(0, 10);
  }
  
  function loadTokenFromStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(getStorageKey());
      }
      return null;
    } catch (e) {
      log('warn', '无法读取localStorage:', e.message);
      return null;
    }
  }
  
  function saveTokenToStorage(token) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(getStorageKey(), token);
      }
    } catch (e) {
      log('warn', '无法保存到localStorage:', e.message);
    }
  }
  
  function activateToken() {
    if (activationPromise) {
      return activationPromise;
    }
    
    activationPromise = new Promise((resolve, reject) => {
      const cachedToken = loadTokenFromStorage();
      if (cachedToken) {
        log('info', '使用缓存的派生Token');
        CURRENT_TOKEN = cachedToken;
        return resolve(cachedToken);
      }
      
      log('info', '首次激活，正在请求派生Token...');
      log('info', '【调试信息】');
      log('info', '  - INSTALL_KEY类型:', typeof INSTALL_KEY);
      log('info', '  - INSTALL_KEY长度:', INSTALL_KEY ? INSTALL_KEY.length : 0);
      log('info', '  - INSTALL_KEY值:', INSTALL_KEY ? INSTALL_KEY.substring(0, 30) + '...' : 'undefined');
      log('info', '  - WORKER_URL:', WORKER_URL);
      
      // 严格检查 INSTALL_KEY
      if (!INSTALL_KEY) {
        log('error', '【严重错误】INSTALL_KEY 为 undefined 或 null');
        return reject('INSTALL_KEY 未定义');
      }
      
      if (typeof INSTALL_KEY !== 'string') {
        log('error', '【严重错误】INSTALL_KEY 不是字符串，类型:', typeof INSTALL_KEY);
        return reject('INSTALL_KEY 类型错误');
      }
      
      if (INSTALL_KEY.trim() === '') {
        log('error', '【严重错误】INSTALL_KEY 是空字符串');
        return reject('INSTALL_KEY 为空');
      }
      
      const activateUrl = WORKER_URL + '/api/activate';
      const deviceId = 'lx_device_' + Date.now();
      const requestData = { 
        installKey: INSTALL_KEY, 
        deviceId: deviceId 
      };
      
      log('info', '【激活请求】');
      log('info', '  - URL:', activateUrl);
      log('info', '  - 请求数据:', JSON.stringify(requestData));
      
      // 使用 POST 表单方式发送（application/x-www-form-urlencoded）
      const formData = 'installKey=' + encodeURIComponent(INSTALL_KEY) + '&deviceId=' + encodeURIComponent(deviceId);
      
      log('info', '  - 表单数据长度:', formData.length);
      log('info', '  - 发送激活请求');
      
      request(activateUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData,
        timeout: CONFIG.TIMEOUT
      }, (err, resp) => {
        if (err) {
          log('error', '【网络错误】激活失败:', err.message);
          return reject('激活失败: ' + err.message);
        }
        
        log('info', '【调试】收到激活响应');
        
        let body;
        try {
          body = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
          log('info', '【调试】激活响应内容:', JSON.stringify(body));
        } catch (e) {
          log('error', '【解析错误】', e.message);
          return reject('激活响应解析失败: ' + e.message);
        }
        
        if (body && body.code === 200 && body.derivedToken) {
          CURRENT_TOKEN = body.derivedToken;
          saveTokenToStorage(CURRENT_TOKEN);
          log('info', '【✅ 激活成功】用户:', body.userName, '权限:', body.permission);
          resolve(CURRENT_TOKEN);
        } else {
          const errorMsg = body?.message || '未知激活错误';
          log('error', '【❌ 激活失败】', errorMsg);
          log('error', '【调试】完整响应:', JSON.stringify(body));
          reject(errorMsg);
        }
      });
    });
    
    return activationPromise;
  }
  
  function buildHeaders() {
    const userAgent = env ? 'lx-music-' + env + '/' + (version || 'unknown') : 'lx-music-request/' + (version || 'unknown');
    return {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
      'X-Auth-Token': CURRENT_TOKEN || '',
      'X-Client-Version': CONFIG.VERSION,
      'X-Client-Name': CONFIG.CLIENT_NAME
    };
  }
  
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  function isRetryableError(error) {
    if (!error || typeof error !== 'string') return false;
    return CONFIG.RETRY.retryableErrors.some(retryable => error.includes(retryable));
  }
  
  function makeRequest(requestUrl, attempt = 1) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeoutId = setTimeout(() => reject(new Error('请求超时')), CONFIG.TIMEOUT);
      
      log('info', '发起请求: Worker API');
      
      request(requestUrl, {
        method: 'GET',
        headers: buildHeaders(),
        follow_max: 5
      }, (err, resp) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        if (err) {
          const errorMsg = '网络错误: ' + err.message;
          log('error', errorMsg);
          
          if (CONFIG.RETRY.enabled && attempt < CONFIG.RETRY.maxAttempts && isRetryableError(err.message)) {
            log('info', '准备重试，第' + attempt + '次...');
            return delay(CONFIG.RETRY.delay * attempt)
              .then(() => makeRequest(requestUrl, attempt + 1))
              .then(resolve)
              .catch(reject);
          }
          
          return reject(errorMsg);
        }
        
        let body;
        try {
          body = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
        } catch (e) {
          log('error', '响应解析失败:', e.message);
          return reject('响应解析失败: ' + e.message);
        }
        
        // 不输出完整响应内容，避免暴露音源信息
        if (body && body.code === 200) {
          log('info', '获取成功，耗时: ' + duration + 'ms');
          return resolve(body.url);
        }
        
        if (body && body.code === 403 && body.message && body.message.includes('派生Token')) {
          log('warn', '派生Token失效，尝试重新激活...');
          CURRENT_TOKEN = null;
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(getStorageKey());
          }
          activationPromise = null;
          return activateToken()
            .then(() => makeRequest(requestUrl, attempt))
            .then(resolve)
            .catch(reject);
        }
        
        // 只输出错误信息，不输出敏感的音源细节
        const errorMsg = body?.message || '请求失败(code: ' + body?.code + ')';
        log('error', errorMsg);
        reject(errorMsg);
      });
    });
  }
  
  const handleGetMusicUrl = async (source, musicInfo, quality) => {
    log('info', '开始播放 - 平台:', source, '音质:', quality);
    
    if (!CURRENT_TOKEN) {
      log('info', 'Token不存在，开始激活...');
      await activateToken();
    }
    
    const songId = musicInfo.hash ?? musicInfo.songmid ?? musicInfo.id;
    if (!songId) {
      log('error', '无法获取歌曲ID');
      return Promise.reject('无法获取歌曲ID');
    }
    
    // 不输出歌曲ID和URL，避免暴露细节
    const requestUrl = WORKER_URL + '?source=' + source + '&songId=' + encodeURIComponent(songId) + '&quality=' + quality;
    
    try {
      const url = await makeRequest(requestUrl);
      log('info', '播放成功');
      return url;
    } catch (error) {
      log('error', '播放失败:', error);
      return Promise.reject(String(error));
    }
  };
  
  const musicSources = {};
  MUSIC_SOURCE.forEach(item => {
    musicSources[item] = {
      name: item.toUpperCase(),
      type: 'music',
      actions: ['musicUrl'],
      qualitys: ['128k', '320k']
    };
  });
  
  // 不输出音源配置详情，避免暴露策略
  log('info', '支持平台:', MUSIC_SOURCE.length, '个');
  
  if (on && EVENT_NAMES) {
    on(EVENT_NAMES.request, ({ action, source, info }) => {
      if (action === 'musicUrl') {
        return handleGetMusicUrl(source, info.musicInfo, info.type);
      }
      return Promise.reject('不支持的action');
    });
    
    send(EVENT_NAMES.inited, {
      status: true,
      openDevTools: false,
      sources: musicSources
    });
    
    log('info', '音源初始化完成');
  }
  
  // 预激活（静默）
  activateToken().catch(e => {
    // 静默失败，不输出详细错误
    log('error', '初始化失败，请检查配置');
  });
})();