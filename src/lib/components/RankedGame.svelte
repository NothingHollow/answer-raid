<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, tagLabel } from '../i18n.svelte.ts';
  import { loadHandle, saveHandle } from '../storage';
  import { rankedRequest, RankedApiError } from '../ranked-api';
  import type { RankedAction, RankedRun } from '../ranked-types';
  import Rich from './Rich.svelte';

  const label = (zh: string, en: string) => locale() === 'zh' ? zh : en;
  let name = $state(loadHandle());
  let run = $state<RankedRun | null>(null);
  let pendingId = $state('');
  let busy = $state(false);
  let error = $state('');
  let now = $state(Date.now());
  let offset = 0;
  let timeoutVersion = -1;
  let disposed = false;
  let quitting = $state(false);
  const question = $derived(run?.question[locale()]);
  const remaining = $derived(run ? Math.max(0, (run.deadline - now) / 1000) : 0);
  function remember(id: string) { try { sessionStorage.setItem('raid.ranked.run', id); } catch { /* Optional resume. */ } }
  function forget() { try { sessionStorage.removeItem('raid.ranked.run'); } catch { /* Optional resume. */ } }
  function accept(next: RankedRun) {
    run = next;
    pendingId = next.id;
    offset = next.serverNow - Date.now();
    now = next.serverNow;
    remember(next.id);
  }
  async function call(action: RankedAction | 'start', choice?: number) {
    if (busy) return;
    busy = true; error = '';
    try {
      const next = await rankedRequest(action === 'start'
        ? { action, id: pendingId, handle: name.trim() }
        : { action, id: run?.id ?? pendingId, version: run?.version, choice });
      if (disposed) return;
      accept(next);
      if (action === 'start') saveHandle(name.trim());
      if (next.phase === 'abandoned') { forget(); run = null; pendingId = ''; quitting = false; }
    } catch (cause) {
      if (disposed) return;
      const code = cause instanceof RankedApiError ? cause.code : 'unavailable';
      if (code === 'stale') {
        try { accept(await rankedRequest({ action: 'read', id: run?.id ?? pendingId })); }
        catch { error = 'unavailable'; }
      } else if (code === 'session') { forget(); run = null; pendingId = ''; error = 'session'; }
      else error = code;
    } finally { if (!disposed) busy = false; }
  }
  function start() {
    if (!name.trim() || busy) return;
    if (!pendingId || run) pendingId = crypto.randomUUID();
    run = null; timeoutVersion = -1; quitting = false;
    void call('start');
  }
  function keydown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey || quitting) return;
    const choice = 'ABCD'.indexOf(event.key.toUpperCase());
    if (run?.phase === 'question' && choice >= 0 && !run.eliminated.includes(choice)) {
      event.preventDefault(); void call('answer', choice);
    }
  }
  onMount(() => {
    try { pendingId = sessionStorage.getItem('raid.ranked.run') ?? ''; } catch { /* New game. */ }
    if (pendingId) void call('read');
    const interval = setInterval(() => {
      now = Date.now() + offset;
      if (run?.phase === 'question' && now >= run.deadline && !busy && !error && timeoutVersion !== run.version) {
        timeoutVersion = run.version; void call('read');
      }
    }, 100);
    return () => { disposed = true; clearInterval(interval); };
  });
</script>

<svelte:window onkeydown={keydown} />
<main class="ranked">
  <nav><a href="#/">← {label('首页', 'Home')}</a><a href="#/leaderboard">{label('排行榜', 'Leaderboard')} ↗</a></nav>
  <header><p>ANSWER RAID</p><h1>{label('排位赛', 'Ranked game')}</h1></header>
  {#if error}
    <div class="error" role="alert">
      {error === 'session' ? label('本局已过期，请重新开始。', 'This run has expired. Start a new game.') : error === 'rate' ? label('操作太频繁，请稍后重试。', 'Too many requests. Please try again shortly.') : label('连接失败，成绩尚未确认。请重试。', 'Connection failed. Your result has not been confirmed. Please retry.')}
      {#if pendingId}<button class="btn" disabled={busy} onclick={() => call(run ? 'read' : 'start')}>{label('重试', 'Retry')}</button>{/if}
    </div>
  {/if}
  {#if !run}
    <section class="panel setup">
      <h2>{label('留下你的名字', 'Put your name on the board')}</h2>
      <p>{label('完成的排位赛成绩会公开显示在共享排行榜上。', 'Completed ranked results appear publicly on the shared leaderboard.')}</p>
      <p>{label('每档答对 6 题晋级，3 个锦囊。倒计时无法暂停，切换页面也会继续。', 'Answer 6 correctly per tier, with 3 jokers per run. The timer keeps running if you leave this page.')}</p>
      <form onsubmit={(e) => { e.preventDefault(); start(); }}>
        <label for="ranked-name">{label('名字 / 昵称', 'Name / nickname')}</label>
        <input id="ranked-name" bind:value={name} maxlength="24" required autocomplete="nickname" disabled={busy} />
        <button class="btn primary" disabled={busy || !name.trim()}>{busy ? label('连接中…', 'Connecting…') : label('开始排位赛', 'Start ranked game')}</button>
      </form>
    </section>
  {:else}
    <div class="hud panel"><span class="handle">{run.handle}</span><span>{run.tier} · {run.progress}/6</span><span>{label('生命', 'Lives')} {run.lives}</span><strong>{run.score.toLocaleString()} <small>{label('分', 'pts')}</small></strong></div>
    {#if run.phase === 'over'}
      <section class="panel done" aria-live="polite"><h2>{run.cleared ? label('通关成功', 'Run cleared') : label('本局结束', 'Run complete')}</h2><p>{label('成绩已保存到共享排行榜。', 'Your score is saved to the shared leaderboard.')}</p><p>{run.correct}/{run.answered} · {label('最高连击', 'Best combo')} ×{run.bestCombo}</p><div class="actions"><a class="btn primary" href="#/leaderboard">{label('查看排名', 'View leaderboard')}</a><button class="btn" onclick={start} disabled={busy}>{label('再来一局', 'Play again')}</button></div></section>
    {/if}
    {#if question}
      <article class="panel question">
        <div class="question-head"><span>{label('第', 'Q')}{run.answered + (run.phase === 'question' ? 1 : 0)}{label('题', '')}</span><span>{run.question.tags.map(tagLabel).join(' · ')}</span>{#if run.phase === 'question'}<strong class:urgent={remaining <= 5}>{remaining.toFixed(1)}s</strong>{/if}</div>
        <h2><Rich text={question.prompt} /></h2>
        {#if run.question.code}<pre>{run.question.code}</pre>{:else if run.question.chartKind === 'ascii'}<pre>{run.question.chartData}</pre>{:else if run.question.chartKind === 'svg' && run.question.chartData}<img class="diagram" src={`data:image/svg+xml;utf8,${encodeURIComponent(run.question.chartData)}`} alt={label('题目示意图', 'Question diagram')} />{/if}
        {#if run.hint}<p class="hint">{label('考点', 'Topic')}: {run.question.tags.map(tagLabel).join(' / ')} · {label('本题得分', 'Score')} ×0.4</p>{/if}
        <div class="options">{#each question.options as option, i}
          <button class:right={run.feedback?.answer === i} class:wrong={run.feedback?.picked === i && !run.feedback.correct} class:eliminated={run.eliminated.includes(i)} disabled={busy || run.phase !== 'question' || run.eliminated.includes(i) || remaining <= 0} onclick={() => call('answer', i)}><span>{'ABCD'[i]}</span><Rich text={option} />{#if run.feedback?.answer === i}<span>✓</span>{/if}</button>
        {/each}</div>
        {#if run.feedback}
          <section class="feedback" aria-live="polite"><h3>{run.feedback.timeout ? label('时间到', 'Time is up') : run.feedback.correct ? label('回答正确', 'Correct') : label('回答错误', 'Incorrect')} · +{run.feedback.gain}</h3><Rich text={question.explain ?? ''} /></section>
          {#if run.phase === 'review'}<button class="btn primary" onclick={() => call('next')} disabled={busy}>{label('下一题', 'Next question')} →</button>{/if}
        {/if}
      </article>
    {/if}
    {#if run.phase === 'question'}
      <div class="jokers"><span>{label('锦囊', 'Jokers')} {run.jokers}/3</span><button class="btn" disabled={busy || !run.jokers || run.eliminated.length > 0 || remaining <= 0} onclick={() => call('fifty')}>50:50</button><button class="btn" disabled={busy || !run.jokers || remaining <= 0} onclick={() => call('freeze')}>+15s</button><button class="btn" disabled={busy || !run.jokers || run.hint || remaining <= 0} onclick={() => call('hint')}>{label('提示', 'Hint')} ×0.4</button></div>
    {/if}
    {#if run.phase !== 'over'}
      {#if quitting}<div class="quit-confirm"><p>{label('退出后，本局成绩不会进入排行榜。倒计时仍在继续。', 'Quitting discards this run. The timer is still running.')}</p><button class="btn" disabled={busy} onclick={() => call('abandon')}>{label('确认退出', 'Quit game')}</button><button class="btn" onclick={() => quitting = false}>{label('继续', 'Keep playing')}</button></div>{:else}<button class="quit" onclick={() => quitting = true}>{label('退出本局', 'Quit game')}</button>{/if}
    {/if}
    {#if busy}<p class="status" role="status">{label('同步中…', 'Syncing…')}</p>{/if}
  {/if}
</main>

<style>
  .ranked { max-width:940px; margin:auto; padding:3.8rem clamp(1rem,4vw,2rem) 3rem; }
  nav,.hud,.question-head,.actions,.jokers { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; }
  nav a { color:var(--fg-dim); text-decoration:none; }
  header { margin:2rem 0; } header p { color:var(--accent); font-size:.75rem; letter-spacing:.2em; } h1 { font-size:2.6rem; margin:.5rem 0; }
  .panel { padding:1.4rem; margin-bottom:1rem; } h2 { font-size:1.25rem; line-height:1.65; } p { line-height:1.7; }
  .setup p,.done p { color:var(--fg-dim); }
  form { display:flex; flex-direction:column; gap:.8rem; max-width:420px; margin-top:1.5rem; }
  input { background:var(--code-bg); border:1px solid var(--line-hard); color:var(--fg); padding:.8rem; font:inherit; }
  .hud { font-size:.85rem; } .handle { overflow-wrap:anywhere; } .hud strong { font-size:1.7rem; color:var(--accent); } small { font-size:.7rem; }
  .question-head { color:var(--fg-dim); font-size:.75rem; } .question-head strong { color:var(--accent); font-size:1.2rem; font-variant-numeric:tabular-nums; } .question-head strong.urgent { color:var(--danger); }
  pre { background:var(--code-bg); padding:1rem; overflow:auto; font-size:.85rem; line-height:1.6; } .diagram { max-width:100%; }
  .options { display:grid; gap:.65rem; margin:1rem 0; } .options button { display:flex; align-items:center; gap:1rem; text-align:left; border:1px solid var(--line); background:var(--panel); padding:1rem; font:inherit; color:var(--fg); }
  .options button:hover:not(:disabled) { border-color:var(--accent); } .options button.right { border-color:var(--accent); background:var(--accent-soft); } .options button.wrong { border-color:var(--danger); } .eliminated { opacity:.25; text-decoration:line-through; }
  .feedback { border-top:1px solid var(--line); padding:1rem 0; font-size:.9rem; line-height:1.8; } .feedback h3 { color:var(--accent); }
  .hint { color:var(--warn); font-size:.85rem; } .jokers { justify-content:flex-start; font-size:.8rem; }
  .error { padding:1rem; border:1px solid var(--danger); margin-bottom:1rem; } .error button { margin:.5rem; }
  .quit { color:var(--fg-mute); background:transparent; border:1px solid var(--line); padding:.6rem; margin-top:1rem; } .quit-confirm { padding:1rem; border:1px solid var(--warn); margin-top:1rem; } .quit-confirm button { margin-right:.5rem; } .status { color:var(--fg-dim); font-size:.8rem; }
</style>
