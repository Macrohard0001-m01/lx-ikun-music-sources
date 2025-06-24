/**
 * @name 测试音乐源
 * @description 我只是一个测试音乐源哦
 * @version 1.0.0
 * @author xxx
 * @homepage http://xxx
 */


const { EVENT_NAMES, request, on, send } = globalThis.lx

const qualitys = {
  kw: {
    '128k': '128',
    '320k': '320',
    flac: 'flac',
    flac24bit: 'flac24bit',
  },
  local: {},
}
const httpRequest = (url, options) => new Promise((resolve, reject) => {
  request(url, options, (err, resp) => {
    if (err) return reject(err)
    resolve(resp.body)
  })
})

const apis = {
  kw: {
    musicUrl({ songmid }, quality) {
      return httpRequest('http://xxx').then(data => {
        return data.url
      })
    },
  },
  local: {
    musicUrl(info) {
      return httpRequest('http://xxx').then(data => {
        return data.url
      })
    },
    pic(info) {
      return httpRequest('http://xxx').then(data => {
        return data.url
      })
    },
    lyric(info) {
      return httpRequest('http://xxx').then(data => {
        return {
          lyric: '...', // 歌曲歌词
          tlyric: '...', // 翻译歌词，没有可为 null
          rlyric: '...', // 罗马音歌词，没有可为 null
          lxlyric: '...', // lx 逐字歌词，没有可为 null，歌词格式为 [分钟:秒.毫秒]<开始时间（基于该句）,持续时间>歌词文字
                          // 例如： [00:00.000]<0,36>测<36,36>试<50,60>歌<80,75>词
        }
      })
    }
  }
}

// 注册应用API请求事件
// source 音乐源，可能的值取决于初始化时传入的sources对象的源key值
// info 请求附加信息，内容根据action变化
// action 请求操作类型，目前只有musicUrl，即获取音乐URL链接，
//    当action为musicUrl时info的结构：{type, musicInfo}，
//        info.type：音乐质量，可能的值有128k / 320k / flac / flac24bit（取决于初始化时对应源传入的qualitys值中的一个）
//                   特殊情况：源为local时，该值为 null
//        info.musicInfo：音乐信息对象，里面有音乐ID、名字等信息
on(EVENT_NAMES.request, ({ source, action, info }) => {
  // 被调用时必须返回 Promise 对象
  switch (action) {
    // action 为 musicUrl 时需要在 Promise 返回歌曲 url
    case 'musicUrl':
      return apis[source].musicUrl(info.musicInfo, qualitys[source][info.type]).catch(err => {
        console.log(err)
        return Promise.reject(err)
      })
    // action 为 lyric 时需要在 Promise 返回歌词信息
    case 'lyric':
      return apis[source].musicUrl(info.musicInfo).catch(err => {
        console.log(err)
        return Promise.reject(err)
      })
    // action 为 pic 时需要在 Promise 返回歌曲封面 url
    case 'pic':
      return apis[source].musicUrl(info.musicInfo).catch(err => {
        console.log(err)
        return Promise.reject(err)
      })
  }
})

// 脚本初始化完成后需要发送inited事件告知应用
// 注意：初始化事件被发送前，执行脚本的过程中出现任何错误将视为脚本初始化失败
send(EVENT_NAMES.inited, {
  openDevTools: false, // 是否打开开发者工具，方便用于调试脚本
  sources: { // 当前脚本支持的源
    kw: { // 支持的源对象，可用key值：kw/kg/tx/wy/mg/local
      name: '酷我音乐',
      type: 'music',  // 目前固定为 music
      actions: ['musicUrl'], // 除了local外，其他的固定为 ['musicUrl']
      qualitys: ['128k', '320k', 'flac', 'flac24bit'], // 当前脚本的该源所支持获取的Url音质，有效的值有：['128k', '320k', 'flac', 'flac24bit']
    },
    // ...
    local: {
      name: '本地音乐',
      type: 'music',  // 目前固定为 music
      actions: ['musicUrl', 'lyric', 'pic'], // 源为 local 时，支持 ['musicUrl', 'lyric', 'pic']
      qualitys: [], // 源为 local 时，该值传入空数组即可
    },
  },
})