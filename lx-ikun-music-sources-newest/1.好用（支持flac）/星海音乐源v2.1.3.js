/*!
 * @name 星海音乐源
 * @description 基于GD Studio API的聚合音乐播放源，支持网易云、QQ、酷狗、酷我、咪咕五大平台，含自动更新功能
 * @version v2.1.3
 * @author 万去了了（cdy1234561103@petalmail.com）
 * @homepage https://zrcdy.dpdns.org/
 * @updateUrl https://zrcdy.dpdns.org/xinghai-music-source.js
 */

// ============================ 核心配置区域 ===========
const UPDATE_CONFIG = {
  // 版本检测文件路径（用于检查脚本更新）
  versionFileUrl: 'https://zrcdy.dpdns.org/version.txt',
  // 最新脚本文件路径（用户更新时下载的地址）
  latestScriptUrl: 'https://zrcdy.dpdns.org/xinghai-music-source.js',
  // 当前脚本版本（必须与@version保持一致）
  currentVersion: 'v2.1.3'
};

// GD Studio API基础地址（固定端点，无需修改）
const API_URL = 'https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light';

// 各平台音质支持配置（wy=网易云，tx=QQ，kw=酷我，kg=酷狗，mg=咪咕）
const MUSIC_QUALITY = {
  wy: ['128k', '320k', 'flac'],
  tx: ['128k', '320k', 'flac'],
  kw: ['128k', '320k', 'flac'],
  kg: ['128k', '320k', 'flac'],
  mg: ['128k', '320k']
};

// 解构LX Music宿主环境API（固定声明方式，请勿修改）
const { EVENT_NAMES, request, on, send, env, version: lxVersion } = globalThis.lx;
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY); // 动态获取支持的音乐平台列表

// ============================ 工具函数集 ============================
/**
 * 生成格式化的时间戳（用于日志记录）
 * @returns {string} 格式化的时间字符串 YYYY/MM/DD HH:MM:SS
 */
function getTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

/**
 * 智能日志输出（根据运行环境调整输出格式）
 * @param  {...any} args 需要输出的日志内容
 */
function log(...args) {
  const timestamp = getTimestamp();
  if (env !== 'mobile') {
    console.log(timestamp, ...args);
  } else {
    console.log(...args);
  }
}

/**
 * 详细请求日志记录（用于调试和问题追踪）
 * @param {string} action 操作类型描述
 * @param {string} source 音乐平台标识
 * @param {Object} musicInfo 歌曲元数据对象
 * @param {string} quality 音质规格
 * @param {string} extra 附加信息
 */
function logDetail(action, source, musicInfo, quality, extra = '') {
  const timestamp = getTimestamp();
  if (env !== 'mobile') {
    console.group(`${timestamp} 详细日志 [${action}]`);
    console.log('歌曲信息:', {
      名称: musicInfo.name || '未知',
      歌手: musicInfo.singer || '未知',
      平台: source,
      歌曲ID: musicInfo.hash ?? musicInfo.songmid ?? musicInfo.id ?? '未知',
      音质: quality,
      专辑: musicInfo.albumName || '未知',
      时长: musicInfo.interval ? `${musicInfo.interval}秒` : '未知',
      附加信息: extra
    });
    console.groupEnd();
  } else {
    log(`[${action}] 平台:${source} | 音质:${quality} | 歌曲:${musicInfo.name || '未知'}`);
  }
}

/**
 * 封装HTTP请求（统一错误处理机制）
 * @param {string} url 请求目标URL
 * @param {Object} options 请求配置选项
 * @returns {Promise<Object>} 响应数据对象
 */
const httpFetch = (url, options = { method: 'GET' }) => {
  return new Promise((resolve, reject) => {
    const cancelRequest = request(url, options, (err, resp) => {
      if (err) {
        log('请求失败:', err.message, 'URL:', url);
        return reject(new Error(`网络请求异常：${err.message}`));
      }
      log('请求成功:', '状态码:', resp.statusCode, 'URL:', url);
      resolve({
        body: resp.body,
        statusCode: resp.statusCode
      });
    });
  });
};

/**
 * 版本号比对算法（语义化版本比较）
 * @param {string} remoteVer 远程版本号
 * @param {string} currentVer 当前版本号
 * @returns {boolean} 是否需要更新
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
/**
 * 版本更新检查流程（初始化后自动执行）
 */
const checkAutoUpdate = async () => {
  log('开始检查更新，服务器地址:', UPDATE_CONFIG.versionFileUrl);
  try {
    const resp = await httpFetch(UPDATE_CONFIG.versionFileUrl, {
      timeout: 10000,
      headers: { 'Content-Type': 'text/plain' }
    });

    const versionText = resp.body.trim();
    if (!versionText.includes('|')) {
      throw new Error('版本文件格式错误，应为：版本号|更新日志');
    }
    const [remoteVersion, updateLog] = versionText.split('|');
    if (!remoteVersion || !updateLog) {
      throw new Error('版本文件内容不完整');
    }

    const needUpdate = compareVersions(remoteVersion, UPDATE_CONFIG.currentVersion);
    if (needUpdate) {
      log('发现新版本:', remoteVersion, '当前版本:', UPDATE_CONFIG.currentVersion);
      send(EVENT_NAMES.updateAlert, {
        log: `【星海音乐源更新通知】\n当前版本：${UPDATE_CONFIG.currentVersion}\n最新版本：${remoteVersion}\n\n更新内容：\n${updateLog}`,
        updateUrl: UPDATE_CONFIG.latestScriptUrl,
        confirmText: '立即更新',
        cancelText: '暂不更新'
      });
    } else {
      log('当前已是最新版本');
    }
  } catch (err) {
    log('更新检查失败:', err.message);
  }
};

// ============================ 音频链接解析核心 ============================
// 音质映射表（前端标识→API参数）
const qualityMap = {
  '128k': '128',
  '320k': '320',
  'flac': '999'
};

// 平台映射表（前端标识→API标识）
const sourceMap = {
  wy: 'netease',
  tx: 'tencent',
  kw: 'kuwo',
  kg: 'kugou',
  mg: 'migu'
};

/**
 * 获取音频播放地址核心方法
 * @param {string} source 音乐平台标识
 * @param {Object} musicInfo 歌曲信息对象
 * @param {string} quality 音质规格
 * @returns {Promise<string>} 可播放的音频地址
 */
const handleGetMusicUrl = async (source, musicInfo, quality) => {
  logDetail('开始解析音频地址', source, musicInfo, quality);

  const songId = musicInfo.hash ?? musicInfo.songmid ?? musicInfo.id;
  if (!songId) {
    const errMsg = '缺少必要的歌曲标识符';
    log('参数错误:', errMsg, '详细信息:', musicInfo);
    throw new Error(errMsg);
  }

  const apiSource = sourceMap[source];
  if (!apiSource) {
    const errMsg = `不支持的音乐平台：${source}`;
    log('配置错误:', errMsg);
    throw new Error(errMsg);
  }

  const apiQuality = qualityMap[quality];
  if (!apiQuality) {
    const errMsg = `不支持的音质规格：${quality}`;
    log('参数错误:', errMsg);
    throw new Error(errMsg);
  }

  const requestUrl = `${API_URL}&types=url&source=${apiSource}&id=${songId}&br=${apiQuality}`;
  log('构建API请求:', requestUrl);

  try {
    const resp = await httpFetch(requestUrl, {
      method: 'GET',
      headers: {
        'User-Agent': `LX-Music-Mobile/${lxVersion}`,
        'Accept': 'application/json'
      }
    });

    const apiData = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
    if (!apiData.url) {
      const errMsg = `API响应异常：${apiData.msg || '未返回有效音频地址'}`;
      log('解析失败:', errMsg, '响应数据:', apiData);
      throw new Error(errMsg);
    }

    const shortUrl = apiData.url.length > 50 ? `${apiData.url.substring(0, 50)}...` : apiData.url;
    logDetail('解析成功', source, musicInfo, quality, `地址:${shortUrl}`);
    return apiData.url;

  } catch (err) {
    log('音频地址获取失败:', err.message);
    throw err;
  }
};

// ============================ 注册音乐平台 ============================
/**
 * 构建音乐平台配置元数据
 */
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
 * 注册事件监听器（处理音频地址请求）
 */
on(EVENT_NAMES.request, ({ action, source, info }) => {
  if (action !== 'musicUrl') {
    const errMsg = `不支持的操作类型：${action}`;
    log('操作错误:', errMsg);
    return Promise.reject(new Error(errMsg));
  }

  if (!info || !info.musicInfo || !info.type) {
    const errMsg = '请求参数结构不完整';
    log('参数错误:', errMsg, '请求详情:', { action, source, info });
    return Promise.reject(new Error(errMsg));
  }

  return handleGetMusicUrl(source, info.musicInfo, info.type)
    .then(url => {
      log('请求处理完成:', '平台:', source, '地址:', url.substring(0, 50) + '...');
      return Promise.resolve(url);
    })
    .catch(err => {
      log('请求处理失败:', '平台:', source, '错误:', err.message);
      return Promise.reject(err);
    });
});

// ============================ 初始化入口 ============================
log('星海音乐源初始化开始...');
send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: false,
  sources: musicSources
});
log('星海音乐源初始化完成');

checkAutoUpdate();