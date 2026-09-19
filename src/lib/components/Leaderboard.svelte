<script lang="ts">
  import { onMount } from 'svelte';
  import { locale } from '../i18n.svelte.ts';
  import { leaderboard } from '../ranked-api';
  import type { LeaderboardEntry } from '../ranked-types';

  const label = (zh: string, en: string) => locale() === 'zh' ? zh : en;
  let entries = $state<LeaderboardEntry[]>([]);
  let period = $state<'today' | 'all'>('all');
  let loading = $state(true);
  let failed = $state(false);
  let updatedAt = $state('');
  let generation = 0;
  let disposed = false;
  async function refresh() {
    const current = ++generation;
    loading = true;
    try {
      const result = await leaderboard(period);
      if (disposed || current !== generation) return;
      entries = result.entries;
      updatedAt = result.updatedAt;
      failed = false;
    } catch {
      if (!disposed && current === generation) failed = true;
    } finally {
      if (!disposed && current === generation) loading = false;
    }
  }
  function filter(next: 'today' | 'all') {
    if (period === next) return;
    period = next;
    entries = [];
    updatedAt = '';
    void refresh();
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* Fullscreen is optional on unsupported browsers. */ }
  }
  onMount(() => {
    void refresh();
    const timer = setInterval(() => { if (!document.hidden && !loading) void refresh(); }, 10000);
    return () => { disposed = true; generation++; clearInterval(timer); };
  });
</script>

<main class="leaderboard">
  <nav><a href="#/">← {label('首页', 'Home')}</a><a href="#/ranked">{label('参加排位赛', 'Play ranked')} ↗</a></nav>
  <header>
    <p class="eyebrow">ANSWER RAID</p>
    <h1>{label('排行榜', 'Leaderboard')}</h1>
    <p class="subtitle">{label('看看谁能走得更远。', 'See who goes the distance.')}</p>
  </header>
  <div class="toolbar">
    <div class="filters" role="group" aria-label={label('时间范围', 'Time period')}>
      <button class:active={period === 'all'} aria-pressed={period === 'all'} onclick={() => filter('all')}>{label('全部', 'All time')}</button>
      <button class:active={period === 'today'} aria-pressed={period === 'today'} onclick={() => filter('today')}>{label('今日', 'Today')}</button>
    </div>
    <div class="tools">
      <button onclick={refresh} disabled={loading}>{label('刷新', 'Refresh')}</button>
      <button onclick={fullscreen}>{label('全屏展示', 'Fullscreen')}</button>
    </div>
  </div>
  <p class="status" aria-live="polite">
    {#if failed}
      {label('暂时无法更新排行榜，请稍后重试。', 'Could not update the leaderboard. Please try again.')}
    {:else if loading && !updatedAt}
      {label('正在加载成绩…', 'Loading scores…')}
    {:else}
      <span class="live" aria-hidden="true"></span>{label('每 10 秒更新', 'Updates every 10 seconds')}
      {#if updatedAt} · {new Date(updatedAt).toLocaleTimeString(locale() === 'zh' ? 'zh-CN' : 'en-US')}{/if}
    {/if}
  </p>
  {#if entries.length > 0}
    <section class="podium" aria-label={label('前三名', 'Top three')}>
      {#each entries.slice(0, 3) as entry (entry.player)}
        <article class="podium-card" class:first={entry.rank === 1}>
          <span class="place">#{entry.rank}</span>
          <h2>{entry.handle}</h2><span class="player-id">#{entry.player}</span>
          <strong>{entry.score.toLocaleString()}</strong>
          <p>{entry.tier} · {Math.round(entry.correct / entry.answered * 100)}% {label('正确率', 'accuracy')}</p>
        </article>
      {/each}
    </section>
    <div class="table-wrap">
      <table>
        <caption class="sr-only">{label('前 50 名成绩', 'Top 50 scores')}</caption>
        <thead><tr><th>{label('名次', 'Rank')}</th><th>{label('玩家', 'Player')}</th><th>{label('得分', 'Score')}</th><th>{label('档位', 'Tier')}</th><th>{label('正确率', 'Accuracy')}</th><th>{label('最高连击', 'Best combo')}</th></tr></thead>
        <tbody>{#each entries as entry (entry.player)}
          <tr><td class="rank">{entry.rank.toString().padStart(2, '0')}</td><td class="name">{entry.handle}<small>#{entry.player}</small></td><td class="score">{entry.score.toLocaleString()}</td><td>{entry.tier}{#if entry.cleared}<span title={label('已通关', 'Cleared')}> ✓</span>{/if}</td><td>{Math.round(entry.correct / entry.answered * 100)}%<small>{entry.correct}/{entry.answered}</small></td><td>×{entry.combo}</td></tr>
        {/each}</tbody>
      </table>
    </div>
  {:else if !failed && (updatedAt || !loading)}
    <div class="empty panel"><h2>{label('榜首虚位以待', 'The top spot is open')}</h2><p>{label('完成一场排位赛，留下你的成绩。', 'Finish a ranked game to put your score on the board.')}</p><a class="btn primary" href="#/ranked">{label('开始排位赛', 'Play ranked')}</a></div>
  {/if}
  <footer>{label('显示前 50 名，每位玩家每个昵称保留最高分。同名玩家通过编号区分。今日按北京时间（UTC+8）计算。', 'Top 50, keeping each player’s best score per nickname. IDs distinguish matching names. Today follows Beijing time (UTC+8).')}</footer>
</main>

<style>
  .leaderboard { max-width:1200px; margin:auto; padding:3.8rem clamp(1rem,4vw,3rem) 3rem; }
  nav,.toolbar,.tools,.filters { display:flex; align-items:center; justify-content:space-between; gap:.65rem; flex-wrap:wrap; }
  nav a { color:var(--fg-dim); text-decoration:none; font-size:.85rem; }
  header { margin:2.5rem 0 2rem; }
  .eyebrow { color:var(--accent); letter-spacing:.2em; font-size:.75rem; }
  h1 { font-size:clamp(2.5rem,7vw,5rem); line-height:1.1; margin:.6rem 0; color:var(--fg-strong); }
  .subtitle,footer,.status { color:var(--fg-dim); }
  button { border:1px solid var(--line); background:var(--panel); color:var(--fg); padding:.65rem 1rem; }
  button.active { background:var(--accent); color:var(--on-accent); border-color:var(--accent); }
  button:disabled { opacity:.5; }
  .status { font-size:.75rem; min-height:1.5rem; margin:1rem 0; }
  .live { display:inline-block; width:.5rem; height:.5rem; border-radius:50%; background:var(--accent); margin-right:.5rem; }
  .podium { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; margin:1.5rem 0; }
  .podium-card { border:1px solid var(--line); padding:1.4rem; background:var(--panel); }
  .podium-card.first { border-top:3px solid var(--accent); }
  .place { color:var(--accent); font-size:1.1rem; }
  h2 { overflow-wrap:anywhere; font-size:1.3rem; margin:.8rem 0 .1rem; }
  .player-id,small { color:var(--fg-mute); font-size:.7rem; }
  strong { display:block; font-size:clamp(1.8rem,4vw,3rem); margin:1rem 0 .4rem; font-variant-numeric:tabular-nums; color:var(--fg-strong); }
  .podium-card p { font-size:.8rem; color:var(--fg-dim); }
  .table-wrap { overflow-x:auto; border:1px solid var(--line); }
  table { width:100%; border-collapse:collapse; background:var(--panel); text-align:left; }
  th { font-size:.7rem; font-weight:normal; color:var(--fg-mute); padding:1rem; white-space:nowrap; }
  td { border-top:1px solid var(--line); padding:1rem; font-variant-numeric:tabular-nums; }
  .rank { color:var(--fg-mute); }
  .name { min-width:7rem; overflow-wrap:anywhere; }
  small { display:block; margin-top:.2rem; }
  .score { color:var(--accent); font-weight:bold; font-size:1.2rem; }
  footer { font-size:.75rem; line-height:1.7; margin-top:1.5rem; }
  .empty { text-align:center; padding:3rem 1rem; }
  .empty p { color:var(--fg-dim); margin:1rem 0 1.5rem; }
  .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
  @media(max-width:600px) { .podium { grid-template-columns:1fr; } .podium-card:not(.first) { display:none; } td,th { padding:.8rem .65rem; } }
</style>
