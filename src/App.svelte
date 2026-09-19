<script lang="ts">
  /**
   * 应用外壳：开机自检、首页、排位赛与共享排行榜。
   */
  import BootScreen from './lib/components/BootScreen.svelte';
  import Intro from './lib/components/Intro.svelte';
  import Leaderboard from './lib/components/Leaderboard.svelte';
  import RankedGame from './lib/components/RankedGame.svelte';
  import RainBackground from './lib/components/RainBackground.svelte';
  import CrtOverlay from './lib/components/CrtOverlay.svelte';
  import { game, soundOn, toggleSound, initAudio } from './lib/quiz.svelte';
  import { locale, toggleLocale, LANG_SWITCH_LABEL, LANG_LABEL, msg, t } from './lib/i18n.svelte.ts';
  import { theme, toggleTheme, THEME_ICON } from './lib/theme.svelte.ts';
  import { onMount } from 'svelte';

  const currentPage = () => typeof window === 'undefined' ? '' : window.location.hash.split('?')[0];
  let page = $state(currentPage());

  onMount(() => {
    initAudio();
  });

</script>

<RainBackground enabled={theme() === 'dark'} />
<CrtOverlay enabled={theme() === 'dark'} />
<svelte:window onhashchange={() => { page = currentPage(); }} />

<div class="app">
  {#if page === '#/leaderboard'}
    <Leaderboard />
  {:else if page === '#/ranked'}
    <RankedGame />
  {:else if game.phase === 'boot'}
    <BootScreen />
  {:else}
    <Intro />
  {/if}
</div>


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
