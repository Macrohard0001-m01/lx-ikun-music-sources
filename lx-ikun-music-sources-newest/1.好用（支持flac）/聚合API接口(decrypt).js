/*!
 * @name 聚合API接口 (by lerd)（decrypt)
 * @description 理论可听全平台无损
 * @version v2.0.0
 * @author lerd
 */

const DEV_ENABLE = false;
const MUSIC_QUALITY = {
    'tx': ['128k', '320k', 'flac', 'flac24bit'],
    'wy': ['128k', '320k', 'flac', 'flac24bit'],
    'kg': ['128k', '320k', 'flac', 'flac24bit'],
    'kw': ['128k', '320k', 'flac'],
    'mg': ['320k', 'flac']
};

const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY);

const { 
    EVENT_NAMES, 
    request, 
    on, 
    send, 
    utils, 
    env, 
    version, 
    currentScriptInfo 
} = globalThis.lx;

const httpFetch = (url, options = { method: 'GET' }) => {
    return new Promise((resolve, reject) => {
        request(url, options, (err, res) => {
            if (err) return reject(err);
            resolve(res);
        });
    });
};

const handleGetMusicUrl = async (source, musicInfo, quality) => {
    switch (source) {
        case 'tx': {
            const qualityMap = {
                '128k': '7',
                '320k': '9', 
                'flac': '11',
                'flac24bit': '14'
            };
            const res = await httpFetch(`https://www.hhlqilongzhu.cn/api/dg_qqmusic.php?songmid=${musicInfo.songmid}&quality=${qualityMap[quality]}`);
            if (!res.body || res.body.code !== 0) throw new Error('获取链接失败');
            return res.body.data;
        }

        case 'wy': {
            const qualityMap = {
                '128k': 'standard',
                '320k': 'exhigh',
                'flac': 'lossless',
                'flac24bit': 'hires'
            };
            const res = await httpFetch(`https://www.hhlqilongzhu.cn/api/dg_wymusic.php?songmid=${musicInfo.songmid}&quality=${qualityMap[quality]}`);
            if (!res.body || res.body.code !== 200) throw new Error('获取链接失败');
            return res.body.data;
        }

        case 'kg': {
            const qualityMap = {
                '128k': '128',
                '320k': '320',
                'flac': 'flac',
                'flac24bit': 'flac24bit'
            };
            const res = await httpFetch(`https://www.hhlqilongzhu.cn/api/dg_kgmusic.php?hash=${musicInfo.hash}&quality=${qualityMap[quality]}`);
            if (!res.body || res.body.code !== 200) throw new Error('获取链接失败');
            return res.body.data;
        }

        case 'kw': {
            const qualityMap = {
                '128k': '128',
                '320k': '320',
                'flac': 'flac'
            };
            const res = await httpFetch(`https://www.hhlqilongzhu.cn/api/dg_kwmusic.php?musicid=${musicInfo.musicid}&quality=${qualityMap[quality]}`);
            if (!res.body || res.body.code !== 200) throw new Error('获取链接失败');
            return res.body.data;
        }

        case 'mg': {
            const qualityMap = {
                '320k': '2',
                'flac': '1'
            };
            const res = await httpFetch(`https://www.hhlqilongzhu.cn/api/dg_mgmusic_24bit.php?msg=${musicInfo.msg}&quality=${qualityMap[quality]}`);
            if (!res.body || res.body.code !== 200) throw new Error('获取链接失败');
            return res.body.music_url;
        }

        default:
            throw new Error('不支持的平台');
    }
};

const musicSources = {};
MUSIC_SOURCE.forEach(source => {
    musicSources[source] = {
        name: source,
        type: 'music',
        actions: source === 'mg' ? [] : ['musicUrl'],
        qualitys: MUSIC_QUALITY[source]
    };
});

on(EVENT_NAMES.request, ({ action, source, info }) => {
    switch (action) {
        case 'musicUrl':
            return handleGetMusicUrl(source, info.musicInfo, info.quality)
                .then(url => Promise.resolve(url))
                .catch(err => Promise.reject(err));
        default:
            return Promise.reject('不支持的请求类型');
    }
});

// 初始化校验
const scriptInfo = globalThis.lx.currentScriptInfo;
if (
    scriptInfo.name !== "聚合API接口 (by lerd)" ||
    scriptInfo.description !== "理论可听全平台无损" ||
    scriptInfo.version !== "v2.0.0" ||
    scriptInfo.author !== "lerd"
) {
    throw new Error("初始化失败！请检查音源信息");
}

send(EVENT_NAMES.inited, { 
    status: true,
    openDevTools: DEV_ENABLE,
    sources: musicSources 
});