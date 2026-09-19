<script lang="ts">
  /**
   * 应用外壳:按 phase 切换 开机自检 / 标题 / 对局 / 晋级幕 / 结算,
   * 并把当前难度档位的色相写入 :root,驱动全站配色。
   */
  import BootScreen from './lib/components/BootScreen.svelte';
  import Intro from './lib/components/Intro.svelte';
  import Hud from './lib/components/Hud.svelte';
  import QuestionCard from './lib/components/QuestionCard.svelte';
  import Feedback from './lib/components/Feedback.svelte';
  import JokerBar from './lib/components/JokerBar.svelte';
  import Promote from './lib/components/Promote.svelte';
  import Result from './lib/components/Result.svelte';
  import Leaderboard from './lib/components/Leaderboard.svelte';
  import RankedGame from './lib/components/RankedGame.svelte';
  import QuitDialog from './lib/components/QuitDialog.svelte';
  import RainBackground from './lib/components/RainBackground.svelte';
  import CrtOverlay from './lib/components/CrtOverlay.svelte';
  import { game, tier, soundOn, toggleSound, initAudio, answerByKey, jokerByKey, canUseJoker, useJoker, requestQuit, cancelQuit, confirmQuit } from './lib/quiz.svelte';
  import { locale, toggleLocale, LANG_SWITCH_LABEL, LANG_LABEL, msg, t } from './lib/i18n.svelte.ts';
  import { theme, toggleTheme, THEME_ICON } from './lib/theme.svelte.ts';
  import { sfx } from './lib/audio';
  import { onMount } from 'svelte';

  const currentPage = () => typeof window === 'undefined' ? '' : window.location.hash.split('?')[0];
  let page = $state(currentPage());

  const inRun = $derived(
    game.phase === 'playing' ||
      game.phase === 'feedback' ||
      game.phase === 'promote' ||
      // 确认退出时把对局留在屏幕上(弹窗盖在上面),避免背景突然空掉
      game.phase === 'confirm-quit',
  );

  /** 全局键盘路由:ESC 退出确认 · A/B/C/D 选项 · 1/2/3 锦囊。输入框内不拦截。 */
  function onKey(e: KeyboardEvent): void {
    if (page === '#/leaderboard' || page === '#/ranked') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // 退出确认:ESC 开 / ESC 关,Enter 直接确认
    if (e.key === 'Escape') {
      e.preventDefault();
      if (game.phase === 'confirm-quit') cancelQuit();
      else requestQuit();
      return;
    }
    if (game.phase === 'confirm-quit') {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmQuit();
      }
      return;
    }

    const joker = jokerByKey(e.key);
    if (joker && game.phase === 'playing') {
      e.preventDefault();
      if (canUseJoker(joker)) useJoker(joker);
      else sfx('wrong');
      return;
    }
    if (answerByKey(e.key)) e.preventDefault();
  }

  onMount(() => {
    initAudio();
  });

  $effect(() => {
    const hue = inRun || game.phase === 'over' ? tier().hue : 152;
    document.documentElement.style.setProperty('--hue', String(hue));
  });
</script>

<RainBackground enabled={theme() === 'dark'} />
<CrtOverlay enabled={theme() === 'dark'} intense={game.phase === 'promote'} />
<svelte:window onkeydown={onKey} onhashchange={() => { page = currentPage(); }} />

<div class="app" class:glitch={game.phase === 'feedback' && game.isCorrect === false}>
  {#if page === '#/leaderboard'}
    <Leaderboard />
  {:else if page === '#/ranked'}
    <RankedGame />
  {:else if game.phase === 'boot'}
    <BootScreen />
  {:else if game.phase === 'intro'}
    <Intro />
  {:else if inRun}
    <main class="play">
      <Hud />
      {#key game.current?.source.id ?? 'none'}
        <div class="stack anim-rise">
          <QuestionCard />
          {#if game.phase === 'feedback'}
            <Feedback />
          {/if}
        </div>
      {/key}
      <JokerBar />
      {#if game.phase === 'promote'}
        <Promote />
      {/if}
      <!-- 中途退出:只在真正答题时露出来,晋级幕期间不需要 -->
      {#if game.phase === 'playing' || game.phase === 'feedback'}
        <div class="quitRow">
          <button class="quitBtn" onclick={requestQuit}>
            <span class="kbd">ESC</span>{t(msg('quit.btn'))}
          </button>
        </div>
      {/if}
    </main>
  {:else if game.phase === 'over'}
    <Result />
  {/if}
</div>

<QuitDialog />

{#if game.phase !== 'boot' || page === '#/leaderboard' || page === '#/ranked'}
  <div class="corner">
    <button
      class="mini lang"
      onclick={toggleLocale}
      title={`${t(msg('lang.switch'))} → ${LANG_LABEL[locale() === 'zh' ? 'en' : 'zh']}`}
      aria-label={t(msg('lang.switch'))}
    >
      <span class="globe" aria-hidden="true">🌐</span>{LANG_SWITCH_LABEL[locale()]}
    </button>
    <button
      class="mini thm"
      onclick={toggleTheme}
      title={`${t(msg('theme.switch'))} → ${t(msg(theme() === 'dark' ? 'theme.light' : 'theme.dark'))}`}
      aria-label={t(msg('theme.switch'))}
      aria-pressed={theme() === 'light'}
    >
      {THEME_ICON[theme()]}
    </button>
    <button
      class="mini snd"
      class:off={!soundOn()}
      onclick={toggleSound}
      title={soundOn() ? t(msg('sound.off')) : t(msg('sound.on'))}
      aria-label={t(msg('sound.switch'))}
      aria-pressed={soundOn()}
    >
      {soundOn() ? '🔊' : '🔇'}{#if !soundOn()}<span class="offMark" aria-hidden="true"></span>{/if}
    </button>
  </div>
{/if}

<style>
  .app {
    position: relative;
    min-height: 100svh;
    z-index: 2;
  }
  .app.glitch {
    animation: shake 0.4s ease-out both;
  }

  .play {
    position: relative;
    z-index: 3;
    max-width: 940px;
    margin: 0 auto;
    padding: 0 clamp(0.6rem, 2.4vw, 1.2rem) 3rem;
    display: flex;
    flex-direction: column;
    gap: clamp(0.7rem, 1.8vw, 1.05rem);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: clamp(0.7rem, 1.8vw, 1.05rem);
  }

  /* 退出按钮:放左下角,刻意做小、做暗,免得喧宾夺主或误触 */
  .quitRow {
    display: flex;
    justify-content: flex-start;
    margin-top: 0.2rem;
  }
  .quitBtn {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.4em 0.8em;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    color: var(--fg-mute);
    background: transparent;
    border: 1px solid var(--line);
    transition: color 0.15s, border-color 0.15s;
  }
  .quitBtn:hover {
    color: var(--danger);
    border-color: var(--danger);
  }

  .corner {
    position: fixed;
    top: 0.5rem;
    right: 0.55rem;
    z-index: 95;
    display: flex;
    gap: 0.35rem;
  }
  .mini {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    background: var(--overlay);
    border: 1px solid var(--line);
    color: var(--fg-dim);
    transition: border-color 0.15s, color 0.15s;
  }
  .mini.lang {
    width: auto;
    min-width: 2rem;
    padding: 0 0.5rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    font-family: var(--mono);
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .mini.lang .globe {
    font-size: 0.8rem;
    line-height: 1;
  }
  /* 主题按钮:单字形,宽度自适应 */
  .mini.thm {
    width: auto;
    min-width: 2rem;
    padding: 0 0.45rem;
    font-size: 0.95rem;
    line-height: 1;
  }
  /* 静音态:除了换图标,再压一层红杠 + 降透明度,避免"看不出点没点上" */
  .mini.snd {
    position: relative;
  }
  .mini.snd.off {
    opacity: 0.75;
  }
  .mini.snd .offMark {
    position: absolute;
    left: 0.35rem;
    right: 0.35rem;
    top: 50%;
    height: 1.5px;
    background: var(--danger);
    transform: rotate(-45deg);
  }
  .mini:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
