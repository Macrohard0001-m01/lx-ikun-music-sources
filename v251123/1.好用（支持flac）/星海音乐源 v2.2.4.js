/*!
 * @name 星海音乐源
 * @description 基于GD Studio API的聚合音乐播放源，支持网易云、QQ、酷狗、酷我、咪咕五大平台，含自动更新功能
 * @version v2.2.4
 * @author 万去了了（725375650@qq.com）
 * @homepage https://cdyzr.dpdns.org/
 * @updateUrl https://zrcdy.dpdns.org/xinghai-music-source.js
 */

// ============================ 核心配置区域 ===========
const UPDATE_CONFIG = {
  // PHP版本检查接口
  versionApiUrl: 'https://zrcdy.dpdns.org/version.php',
  latestScriptUrl: 'https://zrcdy.dpdns.org/xinghai-music-source.js',
  currentVersion: 'v2.2.4'
};

const API_URL = 'https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light';

// 请求频率限制配置（5分钟内最多50次请求）
const RATE_LIMIT_CONFIG = {
  maxRequests: 50,
  timeWindow: 5 * 60 * 1000, // 5分钟（毫秒）
  cleanupInterval: 10 * 60 * 1000 // 10分钟清理一次过期记录
};

// 扩展音质支持配置
const MUSIC_QUALITY = {
  wy: ['128k', '192k', '320k', 'flac', 'flac24bit'],
  tx: ['128k', '192k', '320k', 'flac', 'flac24bit'],
  kw: ['128k', '192k', '320k', 'flac', 'flac24bit'],
  kg: ['128k', '192k', '320k', 'flac', 'flac24bit'],
  mg: ['128k', '192k', '320k', 'flac']
};

const { EVENT_NAMES, request, on, send, env } = globalThis.lx;
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY);

// ============================ 工具函数集 ============================
function log(...args) {
  console.log(...args);
}

/**
 * 简化日志输出
 */
function logSimple(action, source, musicInfo, status, extra = '') {
  const songName = musicInfo.name || '未知歌曲';
  log(`[${action}] 平台:${source} | 歌曲:${songName} | 状态:${status}${extra ? ' | ' + extra : ''}`);
}

/**
 * 简化的请求频率限制管理器
 */
class SimpleRateLimiter {
  constructor() {
    this.requests = [];
    this.lastCleanup = Date.now();
  }

  /**
   * 检查是否超过频率限制
   * @returns {Object} { allowed: boolean, remaining: number, resetIn: number }
   */
  checkLimit() {
    const now = Date.now();
    
    // 清理过期记录（每次检查时都清理）
    this.requests = this.requests.filter(timestamp => 
      now - timestamp < RATE_LIMIT_CONFIG.timeWindow
    );

    // 检查是否超过限制
    const requestCount = this.requests.length;
    const allowed = requestCount < RATE_LIMIT_CONFIG.maxRequests;
    
    if (allowed) {
      // 添加当前请求时间戳
      this.requests.push(now);
    }

    // 计算重置时间
    const oldestRequest = this.requests.length > 0 ? Math.min(...this.requests) : now;
    const resetTime = oldestRequest + RATE_LIMIT_CONFIG.timeWindow;
    const resetIn = Math.max(0, Math.ceil((resetTime - now) / 1000 / 60)); // 剩余分钟数

    return {
      allowed,
      remaining: Math.max(0, RATE_LIMIT_CONFIG.maxRequests - requestCount - (allowed ? 1 : 0)),
      resetIn
    };
  }

  /**
   * 获取当前限制状态
   */
  getStatus() {
    return this.checkLimit();
  }
}

// 初始化频率限制器
const rateLimiter = new SimpleRateLimiter();

/**
 * 封装HTTP请求
 */
const httpFetch = (url, options = { method: 'GET' }) => {
  return new Promise((resolve, reject) => {
    const cancelRequest = request(url, options, (err, resp) => {
      if (err) {
        log('请求失败:', err.message);
        return reject(new Error(`网络请求异常：${err.message}`));
      }
      resolve({
        body: resp.body,
        statusCode: resp.statusCode
      });
    });
  });
};

/**
 * 版本号比对算法
 */
const compareVersions = (remoteVer, currentVer) => {
  const remoteParts = remoteVer.replace(/^v/, '').split('.').map(Number);
  const currentParts = currentVer.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(remoteParts.length, currentParts.length); i++) {
    const remote = remoteParts[i] || 0;
    const current = currentParts[i] || 0;
    if (remote > current) return true;
    if (remote < current) return false;
  }
  return false;
};

// ============================ 自动更新系统 ============================
const checkAutoUpdate = async () => {
  log('开始检查更新，接口:', UPDATE_CONFIG.versionApiUrl);
  try {
    const resp = await httpFetch(UPDATE_CONFIG.versionApiUrl, {
      timeout: 15000,
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'LX-Music-Mobile'
      }
    });

    // 解析JSON响应
    let apiData;
    try {
      apiData = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
    } catch (parseError) {
      throw new Error('版本接口返回数据格式错误');
    }

    // 验证必需字段
    if (!apiData || typeof apiData !== 'object') {
      throw new Error('版本接口返回数据无效');
    }

    if (!apiData.version) {
      throw new Error('版本接口未返回版本号');
    }

    const remoteVersion = apiData.version;
    const updateLog = apiData.changelog || '暂无更新日志';
    const minRequiredVersion = apiData.min_required || 'v1.0.0';

    const needUpdate = compareVersions(remoteVersion, UPDATE_CONFIG.currentVersion);
    
    if (needUpdate) {
      log('发现新版本:', remoteVersion, '当前版本:', UPDATE_CONFIG.currentVersion);
      
      // 检查是否需要强制更新
      const isForceUpdate = compareVersions(remoteVersion, minRequiredVersion) && 
                           compareVersions(minRequiredVersion, UPDATE_CONFIG.currentVersion);
      
      const updateMessage = `【星海音乐源更新通知】\n当前版本：${UPDATE_CONFIG.currentVersion}\n最新版本：${remoteVersion}\n\n更新内容：\n${updateLog}${
        isForceUpdate ? '\n\n⚠️ 此版本需要强制更新，请立即更新以正常使用' : ''
      }`;

      send(EVENT_NAMES.updateAlert, {
        log: updateMessage,
        updateUrl: UPDATE_CONFIG.latestScriptUrl,
        confirmText: '立即更新',
        cancelText: isForceUpdate ? '退出应用' : '暂不更新'
      });
    } else {
      log('当前已是最新版本:', UPDATE_CONFIG.currentVersion);
    }
  } catch (err) {
    log('更新检查失败:', err.message);
    // 不显示错误给用户，避免影响正常使用
  }
};

// ============================ 音频链接解析核心 ============================
// 扩展音质映射表
const qualityMap = {
  '128k': '128',
  '192k': '192', 
  '320k': '320',
  'flac': '999',
  'flac24bit': '740'
};

const sourceMap = {
  wy: 'netease',
  tx: 'tencent',
  kw: 'kuwo',
  kg: 'kugou',
  mg: 'migu'
};

/**
 * 获取音频播放地址核心方法
 */
const handleGetMusicUrl = async (source, musicInfo, quality) => {
  logSimple('解析音频地址', source, musicInfo, '开始');

  // 检查频率限制
  const limitStatus = rateLimiter.checkLimit();
  if (!limitStatus.allowed) {
    const errMsg = `请求频率超限，请在 ${limitStatus.resetIn} 分钟后重试（${RATE_LIMIT_CONFIG.maxRequests}次/5分钟）`;
    logSimple('解析音频地址', source, musicInfo, '失败', errMsg);
    throw new Error(errMsg);
  }

  log(`频率限制状态：剩余 ${limitStatus.remaining} 次请求`);

  const songId = musicInfo.hash ?? musicInfo.songmid ?? musicInfo.id;
  if (!songId) {
    const errMsg = '缺少歌曲标识符';
    logSimple('解析音频地址', source, musicInfo, '失败', errMsg);
    throw new Error(errMsg);
  }

  const apiSource = sourceMap[source];
  const apiQuality = qualityMap[quality];
  
  if (!apiSource || !apiQuality) {
    const errMsg = `不支持的平台或音质：${source}-${quality}`;
    logSimple('解析音频地址', source, musicInfo, '失败', errMsg);
    throw new Error(errMsg);
  }

  const requestUrl = `${API_URL}&types=url&source=${apiSource}&id=${songId}&br=${apiQuality}`;

  try {
    const resp = await httpFetch(requestUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'LX-Music-Mobile',
        'Accept': 'application/json'
      }
    });

    const apiData = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
    if (!apiData.url) {
      const errMsg = `API返回异常：${apiData.msg || '无有效音频地址'}`;
      logSimple('解析音频地址', source, musicInfo, '失败', errMsg);
      throw new Error(errMsg);
    }

    logSimple('解析音频地址', source, musicInfo, '成功');
    return apiData.url;

  } catch (err) {
    logSimple('解析音频地址', source, musicInfo, '失败', err.message);
    throw err;
  }
};

// ============================ 注册音乐平台 ============================
const musicSources = {};
MUSIC_SOURCE.forEach(sourceKey => {
  musicSources[sourceKey] = {
    name: {
      wy: '网易云音乐',
      tx: 'QQ音乐',
      kw: '酷我音乐',
      kg: '酷狗音乐',
      mg: '咪咕音乐'
    }[sourceKey],
    type: 'music',
    actions: ['musicUrl'],
    qualitys: MUSIC_QUALITY[sourceKey]
  };
});

/**
 * 注册事件监听器
 */
on(EVENT_NAMES.request, ({ action, source, info }) => {
  if (action !== 'musicUrl') {
    return Promise.reject(new Error(`不支持的操作类型：${action}`));
  }

  if (!info || !info.musicInfo || !info.type) {
    return Promise.reject(new Error('请求参数不完整'));
  }

  return handleGetMusicUrl(source, info.musicInfo, info.type)
    .then(url => Promise.resolve(url))
    .catch(err => Promise.reject(err));
});

// ============================ 初始化入口 ============================
log('星海音乐源初始化开始...');
log(`请求频率限制：${RATE_LIMIT_CONFIG.maxRequests}次/${RATE_LIMIT_CONFIG.timeWindow / 60000}分钟`);

send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: false,
  sources: musicSources
});
log('星海音乐源初始化完成');

// 延迟检查更新，确保主程序先完全加载
setTimeout(() => {
  checkAutoUpdate();
}, 2000);