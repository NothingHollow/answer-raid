/**
 * 端到端冒烟测试:把 `dist/` 里**真实构建产物**加载进 DOM 并驱动点击。
 *
 * 运行:pnpm build && node tools/smoke.mjs
 *
 * 覆盖:开机自检 → 仅排位赛首页 → 主题设置 → 共享排行榜 → 排位赛判分与语言切换。
 */

import { Window } from 'happy-dom';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

let pass = 0;
let fail = 0;
const failures = [];
function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    fail += 1;
    failures.push(`${name}${extra ? ` — ${extra}` : ''}`);
    console.log(`  \u2717 ${name}${extra ? ` — ${extra}` : ''}`);
  }
}
function section(t) {
  console.log(`\n=== ${t} ===`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 启动 DOM + 执行真实 bundle ---------- */
const window = new Window({
  // 锁定中文:项目里的可读断言都是中文文案,同时验证「?lang= 覆盖」这条路径
  url: 'http://localhost/?lang=zh',
  width: 1280,
  height: 900,
  settings: { disableJavaScriptEvaluation: true, disableCSSFileLoading: true },
});
const { document } = window;

/**
 * 把画布尺寸伪装成 0,让背景字符雨的列数为 0 —— 它就不再消耗 Math.random。
 * 这样「抽题」成为唯一的随机消耗者,测试才能精确控制每次抽到的题。
 * (这是测试环境的手段,不改动生产代码。)
 */
for (const proto of [window.Element.prototype, window.HTMLElement.prototype]) {
  Object.defineProperty(proto, 'clientWidth', { get: () => 0, configurable: true });
  Object.defineProperty(proto, 'clientHeight', { get: () => 0, configurable: true });
}

// 补上 happy-dom 没实现的 API(canvas 2d context、ResizeObserver、AudioContext)
const noop = () => {};
const ctxStub = new Proxy(
  {
    canvas: null,
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 8 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  },
  { get: (t, k) => (k in t ? t[k] : noop), set: () => true },
);
window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
/** happy-dom 的 Web Animations 在 cancel() 时会抛 AbortError,把 Svelte 过渡打断 —— 用立即完成的动画替身。 */
window.Element.prototype.animate = function animate() {
  const anim = {
    onfinish: null,
    currentTime: 0,
    playState: 'finished',
    effect: null,
    cancel() {},
    finish() {
      anim.onfinish?.();
    },
    addEventListener() {},
    removeEventListener() {},
  };
  // 让 Svelte 的 onfinish 回调在下一个微任务里拿到结果
  setTimeout(() => anim.onfinish?.(), 0);
  return anim;
};
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
/**
 * AudioContext 探针。
 * 两个真实的坑靠它守住:
 * 1) 页面加载时**不能**创建 AudioContext(浏览器自动播放策略会把它挂起,而且会打印警告),
 *    必须等到真正的用户手势;
 * 2) 创建之后**必须调用 resume()**,否则底噪的节点全都建好、start() 也调了,却一声不响
 *    —— 这正是「音乐听不见」的根因。
 */
const audioProbe = { created: 0, resumed: 0, oscillators: 0 };
window.AudioContext = class {
  constructor() {
    audioProbe.created += 1;
    this.state = 'suspended';
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.destination = {};
  }
  resume() {
    audioProbe.resumed += 1;
    this.state = 'running';
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime: noop, setTargetAtTime: noop, exponentialRampToValueAtTime: noop },
      connect: noop,
    };
  }
  createOscillator() {
    audioProbe.oscillators += 1;
    return {
      type: 'square',
      frequency: { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop },
      connect: noop,
      start: noop,
      stop: noop,
    };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(64) };
  }
  createBufferSource() {
    return { buffer: null, connect: noop, start: noop, stop: noop };
  }
  createBiquadFilter() {
    return { type: 'lowpass', frequency: { value: 0 }, Q: { value: 1 }, connect: noop };
  }
};

// 全局桥接,让 bundle 里的 window / document / localStorage 都能用。
// 注意:Node 24 的 globalThis.navigator 是只读 getter,必须用 defineProperty 覆盖。
globalThis.window = window;
globalThis.document = document;
globalThis.localStorage = window.localStorage;
globalThis.sessionStorage = window.sessionStorage;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = function raf(cb) {
  return setTimeout(() => cb(performance.now()), 16);
};
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// bundle 里会直接引用这些 DOM 全局构造器,必须逐个桥接
for (const name of [
  'HTMLElement',
  'HTMLInputElement',
  'HTMLMediaElement',
  'HTMLCanvasElement',
  'SVGElement',
  'Element',
  'Node',
  'Text',
  'Comment',
  'DocumentFragment',
  'EventTarget',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'MutationObserver',
  'ResizeObserver',
  'CSS',
]) {
  if (window[name] !== undefined) globalThis[name] = window[name];
}
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    configurable: true,
    writable: true,
  });
} catch {
  /* Node 里 navigator 已有实现,通常够用 */
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const jsFile = readdirSync(join(dist, 'assets')).find((f) => f.endsWith('.js'));
document.write(html);

// 直接执行真实构建产物:bundle 自己会 mount 到 #app。
// 刻意不 `import { mount } from 'svelte'` —— Node 下会解析到 server 构建而报错。
await import('file://' + join(dist, 'assets', jsFile).replace(/\\/g, '/'));
await sleep(50);

/* ---------- DOM 查询工具 ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const text = (sel) => ($(sel)?.textContent ?? '').trim();
const has = (sel) => !!$(sel);

function clickByText(sel, needle) {
  const el = $$(sel).find((e) => e.textContent.includes(needle));
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}
function typeInto(sel, value) {
  const el = $(sel);
  if (!el) return false;
  el.value = value;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  return true;
}
/* ---------- 流程 ---------- */
section('1. 开机自检屏');
await sleep(0);
// 反例守卫:这里必须是 0。曾经在 onMount 里就 new AudioContext(),
// 浏览器会因自动播放策略把它挂起,底噪从此再也发不出声音。
ok('加载阶段不创建 AudioContext(等用户手势)', audioProbe.created === 0, `created=${audioProbe.created}`);
ok('渲染了开机自检屏', has('.boot'), document.body.innerHTML.slice(0, 120));
ok('初始没有 HUD(还没进对局)', !has('.hud'));

await sleep(2200); // 等打字机播完
ok('自检文案已出现', text('.log').includes('计算机协会') || text('.log').length > 10, text('.log').slice(0, 60));

// 点击进入标题页
clickByText('.boot', 'SKIP') || $('.boot').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
if (has('.boot')) $('.boot').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(60);

section('2. 标题页');
ok('切换到标题页', has('.intro'));
ok('展示三个难度档位', $$('.tier').length === 3, `实际 ${$$('.tier').length}`);
ok('档位文案含 EZ/HD/IN', ['轻松', '进阶', '深入'].every((t) => text('.tiers').includes(t)));
ok('Practice form and local archive are removed', !has('.field input') && !has('.start') && !has('.record'));
ok('Ranked is the only play link', $$('.intro a[href="#/ranked"]').length === 1);
ok('三个锦囊都列出来了', $$('.jokers li').length === 3, `实际 ${$$('.jokers li').length}`);

section('13. 静音按钮');
{
  const soundBtn = $('.mini.snd');
  ok('存在静音按钮', !!soundBtn, String(!!soundBtn));
  const before = soundBtn?.textContent.trim();
  ok('静音按钮有图标', before === '🔊' || before === '🔇', before);

  if (soundBtn) soundBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(120);
  const after = soundBtn?.textContent.trim();
  ok('点击后图标变化', after !== before, `${before} → ${after}`);
  ok('图标是另一个状态', after === '🔇' || after === '🔊', after);
  ok(
    '静音偏好写入 localStorage',
    localStorage.getItem('csa.raid.sound.v1') !== null,
    String(localStorage.getItem('csa.raid.sound.v1')),
  );

  // 再点回去,别把状态留在静音
  if (soundBtn) soundBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(120);
  ok('再点一次恢复原图标', soundBtn?.textContent.trim() === before, `${soundBtn?.textContent.trim()} vs ${before}`);
}

section('14. 主题切换(暗色 CRT ↔ 亮色强光)');
{
  const themeBtn = $('.mini.thm');
  const rootTheme = () => document.documentElement.dataset.theme;

  ok('存在主题切换按钮', !!themeBtn, String(!!themeBtn));
  ok('初始为暗色主题', rootTheme() === 'dark', String(rootTheme()));
  ok('暗色下有 CRT 叠层', has('.crt'));
  ok('暗色下背景 canvas 可见', !$('canvas')?.classList.contains('hidden'));
  ok('暗色按钮指向亮色(☀)', themeBtn?.textContent.trim() === '☀', themeBtn?.textContent.trim());

  if (themeBtn) themeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(120);

  ok('切到亮色:data-theme=light', rootTheme() === 'light', String(rootTheme()));
  ok('切到亮色:CRT 叠层被移除', !has('.crt'));
  ok('切到亮色:字符雨 canvas 隐藏', $('canvas')?.classList.contains('hidden') === true);
  ok('切到亮色:按钮变为 ☾', themeBtn?.textContent.trim() === '☾', themeBtn?.textContent.trim());
  ok('切到亮色:aria-pressed 为 true', themeBtn?.getAttribute('aria-pressed') === 'true');
  ok(
    '主题偏好写入 localStorage',
    JSON.parse(localStorage.getItem('csa.raid.theme.v1') ?? '""') === 'light',
    String(localStorage.getItem('csa.raid.theme.v1')),
  );
  // 注意:happy-dom 不会真正按 data-theme 选择器解析样式(它不加载 CSS 文件),
  // 所以这里只能断言"属性写对了";配色本身由 test:theme 直接在 CSS 里校验。
  ok('主题属性写在 <html> 上(供 CSS 令牌切换)', rootTheme() === 'light', String(rootTheme()));

  if (themeBtn) themeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(120);
  ok('切回暗色:data-theme=dark', rootTheme() === 'dark', String(rootTheme()));
  ok('切回暗色:CRT 叠层回来', has('.crt'));
}

section('16. Shared leaderboard and ranked flow');
{
  const realFetch = globalThis.fetch;
  let failRead = false;
  let saved = false;
  const mockRun = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', version: 0, handle: '测试', phase: 'question',
    tier: 'EZ', progress: 0, lives: 2, score: 0, correct: 0, answered: 0, combo: 0, bestCombo: 0,
    cleared: false, jokers: 3, hint: false, eliminated: [], deadline: Date.now() + 40000,
    serverNow: Date.now(), feedback: null,
    question: { id: 'qa', tags: [], zh: { prompt: '测试问题', options: ['甲', '乙', '丙', '丁'] }, en: { prompt: 'Test question', options: ['One', 'Two', 'Three', 'Four'] } },
  };
  globalThis.fetch = async (url, options) => {
    if (!options?.body) {
      if (failRead) return Response.json({ error: 'unavailable' }, { status: 503 });
      return Response.json({ entries: String(url).includes('today') ? [] : [
        { rank: 1, handle: '同名', player: 'a1b2c3', score: 1000, tier: 'HD', correct: 6, answered: 7, combo: 6, cleared: false, at: new Date().toISOString() },
        { rank: 2, handle: '同名', player: 'd4e5f6', score: 500, tier: 'EZ', correct: 3, answered: 5, combo: 3, cleared: false, at: new Date().toISOString() },
      ], updatedAt: new Date().toISOString() });
    }
    const body = JSON.parse(options.body);
    if (body.action === 'answer') {
      saved = true;
      return Response.json({ ...mockRun, phase: 'over', version: 1, score: 149, answered: 1, correct: 1, bestCombo: 1, feedback: { correct: true, answer: 0, picked: 0, gain: 149, timeout: false } });
    }
    return Response.json(mockRun);
  };
  async function route(hash) {
    window.location.hash = hash;
    window.dispatchEvent(new window.Event('hashchange'));
    await sleep(150);
  }
  await route('#/leaderboard');
  ok('Leaderboard route renders without starting a game', has('.leaderboard') && !has('.qcard'));
  ok('Ranks display shared scores and distinguish identical names', text('tbody').includes('a1b2c3') && text('tbody').includes('d4e5f6') && $$('.leaderboard tbody .score')[0]?.textContent === (1000).toLocaleString(), text('tbody'));
  failRead = true;
  clickByText('.tools button', '刷新'); await sleep(150);
  ok('A failed refresh preserves the last scores and shows an error', text('.status').includes('无法更新') && $$('.leaderboard tbody tr').length === 2);
  failRead = false;
  clickByText('.filters button', '今日'); await sleep(150);
  ok('Today filter shows an empty state without stale all-time scores', has('.empty') && !has('.table-wrap'));
  await route('#/ranked');
  ok('Ranked setup contains no practice copy', !/练习|practice/i.test(text('.setup')));
  typeInto('#ranked-name', '测试');
  $('.setup form')?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(150);
  ok('Ranked game displays the API question', text('.ranked .question').includes('测试问题'));
  ok('Ranked options do not reveal the correct answer before submission', !has('.ranked .right'));
  $('.ranked .options button')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(150);
  ok('Ranked result confirms saving only after server response', saved && text('.done').includes('已保存') && text('.ranked .hud').includes('149'));
  $('.mini.lang')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(100);
  ok('Ranked results and questions switch to English', text('.done').includes('saved') && text('.ranked .question').includes('Test question'));
  await route('#/');
  ok('English homepage contains no practice or local archive', !/practice/i.test(text('.intro')) && !has('.record') && !has('.start'));
  globalThis.fetch = realFetch;
}

/* ---------- 收尾 ---------- */
window.happyDOM?.close?.();

section('结果');
console.log(`\n通过 ${pass} 项,失败 ${fail} 项`);
if (fail > 0) {
  console.log('\n失败项:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('\n全部通过 ✓');
}
process.exit(process.exitCode ?? 0);
