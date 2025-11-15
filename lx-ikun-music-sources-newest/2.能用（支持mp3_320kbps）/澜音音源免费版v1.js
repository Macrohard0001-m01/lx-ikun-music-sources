/*!
 * @name 新澜音源(公益版)
 * @description 支持所有平台320k音质
 * @version v1
 * @author 时迁酱
 */

const DEV_ENABLE = false;
const UPDATE_ENABLE = true;
const API_URL = "https://source.shiqianjiang.cn/api/music";
const API_KEY = "";
const SCRIPT_MD5 = "c1f83be397459330a5d944e3511b37cb";
const MUSIC_QUALITY = {"kw":["128k","320k"],"mg":["128k","320k"],"kg":["128k","320k"],"tx":["128k","320k"],"wy":["128k","320k"],"git":["128k","320k"]};

const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY);
const { EVENT_NAMES, request, on, send, utils, env, version } = globalThis.lx;

const httpFetch = (url, options = { method: "GET" }) => {
  return new Promise((resolve, reject) => {
    console.log("--- start --- " + url);
    request(url, options, (err, resp) => {
      if (err) return reject(err);
      console.log("API Response: ", resp);
      resolve(resp);
    });
  });
};

const handleGetMusicUrl = async (source, musicInfo, quality) => {
  const songId = musicInfo.hash ?? musicInfo.songmid;
  const requestUrl = `${API_URL}/url?source=${source}&songId=${songId}&quality=${quality}`;
  
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": `${
      env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`
    }`
  };
  
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  
  const request = await httpFetch(requestUrl, {
    method: "GET",
    headers,
    follow_max: 5,
  });
  
  const { body } = request;
  if (!body || isNaN(Number(body.code))) throw new Error("unknown error");
  if (env != "mobile") console.groupEnd();
  
  switch (body.code) {
    case 200:
      console.log(
        `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) success, URL: ${body.url}`
      );
      return body.url;
    case 403:
      console.log(
        `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed: 权限不足或Key失效`
      );
      throw new Error("权限不足或Key失效");
    case 429:
      console.log(
        `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed: 请求过于频繁`
      );
      throw new Error("请求过速，请稍后再试");
    case 500:
      console.log(
        `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed: ${body.message}`
      );
      throw new Error(`获取URL失败: ${body.message ?? "未知错误"}`);
    default:
      console.log(
        `handleGetMusicUrl(${source}_${
          musicInfo.songmid
        }, ${quality}) failed: ${body.message ? body.message : "未知错误"}`
      );
      throw new Error(body.message ?? "未知错误");
  }
};

const checkUpdate = async () => {
  try {
    const request = await httpFetch(
      `${API_URL.replace('/music', '')}/script?checkUpdate=${SCRIPT_MD5}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `${
            env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`
          }`,
        },
      }
    );
    const { body } = request;

    if (!body || body.code !== 200) console.log("checkUpdate failed");
    else {
      console.log("checkUpdate success");
      if (body.data != null) {
        globalThis.lx.send(lx.EVENT_NAMES.updateAlert, {
          log: body.data.updateMsg,
          updateUrl: body.data.updateUrl,
        });
      }
    }
  } catch (error) {
    console.log("checkUpdate error:", error);
  }
};

const musicSources = {};
MUSIC_SOURCE.forEach((item) => {
  musicSources[item] = {
    name: item,
    type: "music",
    actions: ["musicUrl"],
    qualitys: MUSIC_QUALITY[item],
  };
});

on(EVENT_NAMES.request, ({ action, source, info }) => {
  switch (action) {
    case "musicUrl":
      if (env != "mobile") {
        console.group(`Handle Action(musicUrl)`);
        console.log("source", source);
        console.log("quality", info.type);
        console.log("musicInfo", info.musicInfo);
      } else {
        console.log(`Handle Action(musicUrl)`);
        console.log("source", source);
        console.log("quality", info.type);
        console.log("musicInfo", info.musicInfo);
      }
      return handleGetMusicUrl(source, info.musicInfo, info.type)
        .then((data) => Promise.resolve(data))
        .catch((err) => Promise.reject(err));
    default:
      console.error(`action(${action}) not support`);
      return Promise.reject("action not support");
  }
});

if (UPDATE_ENABLE) checkUpdate();

send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: DEV_ENABLE,
  sources: musicSources,
});