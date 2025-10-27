// ==UserScript==
// @name         Suno → Discord RPC (время + кнопка + обложка)
// @namespace    suno-rpc
// @version      4.2
// @description  Название, автор, время, обложка + кнопка "Открыть в Suno"
// @match        https://suno.com/*
// @match        https://www.suno.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ENDPOINT = 'http://localhost:3000/update';
  const DEBUG = false;
  const SEND_DELAY_MS = 200;

  const q  = (s,r=document)=>r.querySelector(s);
  const qa = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const txt= el => (el?.textContent || '').trim();
  const cap= (s,n=128)=>(typeof s==='string'?s.slice(0,n):'');

  const clean = s => (s || '')
    .replace(/\s*\|\s*Join me on Suno.*$/i,'')
    .replace(/^suno\s*-\s*/i,'')
    .replace(/\s+/g,' ')
    .trim();

  // Функция для извлечения URL обложки
  function extractCoverUrl() {
    // 1. Ищем в плейбаре (основной вариант)
    const playbarImg = q('img[aria-label*="Cover image"], img[aria-label*="Обложка"], img[alt*="Cover image"], img[alt*="Обложка"]');
    if (playbarImg && playbarImg.src) {
      console.log('[Suno RPC] Найдена обложка в плейбаре:', playbarImg.src);
      return playbarImg.src;
    }

    // 2. Ищем по структуре DOM (резервный вариант)
    const playbarRoot = findPlaybarRoot();
    if (playbarRoot) {
      const imgs = qa('img', playbarRoot);
      for (let img of imgs) {
        if (img.src && img.src.includes('suno.ai') && (img.width >= 40 || img.height >= 40)) {
          console.log('[Suno RPC] Найдена обложка в DOM:', img.src);
          return img.src;
        }
      }
    }

    // 3. Ищем в карточке трека
    const songImg = q('img[src*="suno.ai/images"]');
    if (songImg && songImg.src) {
      console.log('[Suno RPC] Найдена обложка в карточке:', songImg.src);
      return songImg.src;
    }

    // 4. Пробуем получить из meta-тегов
    const metaOgImage = q('meta[property="og:image"]');
    if (metaOgImage && metaOgImage.content) {
      console.log('[Suno RPC] Найдена обложка в meta:', metaOgImage.content);
      return metaOgImage.content;
    }

    console.log('[Suno RPC] Обложка не найдена');
    return '';
  }

  // Остальные функции из вашего оригинального скрипта
  const GENRE_WORDS = new Set([
    'phonk','dubstep','trap','techno','house','ambient','lofi','rock','metal',
    'jazz','funk','disco','pop','edm','dnb','drum','bass','electro','trance',
    'wave','hardbass','phonkhouse','hiphop','hip-hop','rap'
  ]);
  const isGenre = s => GENRE_WORDS.has((s||'').toLowerCase());

  const isNick = s => {
    if (!s) return false;
    const v = s.replace(/^@/,'').trim();
    if (!v) return false;
    if (v.length > 32) return false;
    if (v.split(/\s+/).length > 3) return false;
    if (!/^[\w.@\-А-Яа-яЁё ]{1,32}$/.test(v)) return false;
    if (isGenre(v)) return false;
    return true;
  };

  const cleanTitle = s => cap(clean(s) || 'Без названия', 128);
  const cleanArtist = s => {
    const v = clean(s).replace(/^@/,'').trim();
    return isNick(v) ? cap(v,128) : '';
  };

  const climb = (el,steps=8)=>{
    const a=[]; let cur=el;
    while(cur && steps-- > 0){ a.push(cur); cur=cur.parentElement; }
    return a;
  };

  const findPlaybarRoot = ()=>{
    const link = q('a[aria-label^="Плейбар"], a[aria-label^="Playbar"]');
    return link ? (link.closest('[class], [role]') || link.parentElement) : null;
  };

  const authorFromPlaybar = (pbRoot)=>{
    if(!pbRoot) return '';
    const aAria = qa('a[aria-label]', pbRoot).find(a=>{
      const al=(a.getAttribute('aria-label')||'').toLowerCase();
      return al.includes('artist')||al.includes('исполн')||al.includes('автор');
    });
    if(aAria){
      const v = cleanArtist(txt(q('span', aAria)) || txt(aAria));
      if(v) return v;
    }
    const aProfile = q('a[href^="/@"]', pbRoot);
    if(aProfile){
      const v = cleanArtist(txt(aProfile));
      if(v) return v;
    }
    const up = pbRoot.parentElement;
    if(up){
      const near = q('a[aria-label*="Artist"], a[aria-label*="Исполн"], a[href^="/@"], span.line-clamp-1', up);
      const v = cleanArtist(txt(near));
      if(v) return v;
    }
    return '';
  };

  function extractTitle(roots){
    for(const r of roots){
      const el =
        q('a[aria-label^="Плейбар"], a[aria-label^="Playbar"]', r) ||
        q('a.mr-24.whitespace-nowrap[href^="/song/"]', r) ||
        q('a[href^="/song/"]', r) ||
        q('[class*="track"], [class*="song"], [class*="title"]', r);
      const v = txt(el);
      if(v) return cleanTitle(v);
    }
    const ms = navigator.mediaSession?.metadata?.title?.trim();
    if(ms) return cleanTitle(ms);
    const meta = q('meta[property="og:title"]')?.getAttribute('content');
    if(meta) return cleanTitle(meta);
    return cleanTitle((document.title||'').replace(/\s+·\s*Suno.*/i,''));
  }

  function extractArtist(roots, pbRoot){
    const candidates=[];
    const push=(label,val,w)=>{
      const v = cleanArtist(val);
      const score = v ? (w + Math.max(0,16-v.length) - (/^suno$/i.test(v)?50:0)) : -1e6;
      candidates.push({label,value:v,score});
    };

    push('MediaSession', navigator.mediaSession?.metadata?.artist, 120);
    push('Playbar', authorFromPlaybar(pbRoot), 110);

    for(const r of roots){
      const el = q('a[href^="/@"]', r);
      if(el){ push('ProfileAround', txt(el), 95); break; }
    }

    const left = q('nav, aside, [class*="sidebar"]');
    if(left){
      const el = q('a[href^="/@"], [class*="username"], [class*="user"]', left);
      if(el) push('Sidebar', txt(el), 85);
    }

    qa('a[href^="/@"], a[href*="/user"], a[href*="/users"]').slice(0,5)
      .forEach(el => push('AnyProfile', txt(el), 70));

    candidates.sort((a,b)=>b.score-a.score);
    if(DEBUG) console.table(candidates.slice(0,6));
    const best = candidates.find(c => c.value && !/^suno$/i.test(c.value));
    return best?.value || 'Suno';
  }

  function buildRoots(){
    const audio = q('#active-audio-play') || q('audio');
    const around = audio ? climb(audio,8) : [];
    const playbar = findPlaybarRoot();
    const extra = [playbar, document.body].filter(Boolean);
    return { audio, roots:[...around, ...extra], playbar };
  }

  let lastGoodArtist = '';

  function parseTimeToSec(str){
    if(!str) return NaN;
    const [m,s] = str.split(':').map(Number);
    if(Number.isFinite(m) && Number.isFinite(s)) return m*60+s;
    return NaN;
  }

  function getPayload(){
    const {audio, roots, playbar} = buildRoots();

    const song = extractTitle(roots);
    let artist = extractArtist(roots, playbar);
    const coverUrl = extractCoverUrl(); // <-- НОВОЕ: получаем URL обложки

    if(!artist || isGenre(artist)){
      artist = lastGoodArtist || 'Suno';
    } else {
      lastGoodArtist = artist;
    }

    const times = qa('span.w-10').map(el => txt(el)).filter(Boolean);
    let currentText='', totalText='', remainText='';
    if(times.length >= 2){
      [currentText, totalText] = times.slice(-2);
      const cur = parseTimeToSec(currentText);
      const tot = parseTimeToSec(totalText);
      if(Number.isFinite(cur) && Number.isFinite(tot) && tot >= cur){
        const rem = tot - cur;
        const mm = String(Math.floor(rem/60)).padStart(2,'0');
        const ss = String(rem%60).padStart(2,'0');
        remainText = `-${mm}:${ss}`;
      }
    }

    const duration = (audio?.duration && isFinite(audio.duration)) ? audio.duration : 0;
    const progress = (audio?.currentTime && isFinite(audio.currentTime)) ? audio.currentTime : 0;

    const titleLink =
      q('a[aria-label^="Плейбар"], a[aria-label^="Playbar"]') ||
      q('a.mr-24.whitespace-nowrap[href^="/song/"]') ||
      q('a[href^="/song/"]');
    const url = titleLink ? new URL(titleLink.getAttribute('href'), location.origin).href : location.href;

    const timeDisplay = (currentText && totalText) ? `⏱ ${currentText} / ${totalText} (${remainText||'-00:00'})` : '';

    return { song, artist, duration, progress, url, timeDisplay, coverUrl }; // <-- НОВОЕ: добавляем coverUrl
  }

  let lastSnap='', timer=null;
  async function send(){
    const d = getPayload();
    const snap = JSON.stringify({ s:d.song, a:d.artist, p:Math.round(d.progress) });
    if(snap === lastSnap) return;
    lastSnap = snap;

    try{
      await fetch(ENDPOINT, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(d)
      });
      if (DEBUG) console.log('[Suno→RPC] payload:', d);
      else console.log(`[Suno→RPC] ${d.song} | ${d.artist} ${d.timeDisplay} | Cover: ${d.coverUrl ? 'Yes' : 'No'}`);
    }catch(e){
      console.warn('[Suno→RPC] send error:', e);
    }
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(send, SEND_DELAY_MS); };

  new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });
  setInterval(schedule, 2000);
  document.addEventListener('play', schedule, true);
  document.addEventListener('playing', schedule, true);
  document.addEventListener('loadeddata', schedule, true);
})();