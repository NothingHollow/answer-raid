<script lang="ts">
  /** 结算页:评级 / 战绩 / 逐档热力图 / 重开。 */
  import { fly } from 'svelte/transition';
  import { TIERS } from '../data/tiers';
  import { ROUNDS_PER_TIER } from '../data/types';
  import { game, rank, accuracy, retry, toIntro } from '../quiz.svelte';
  import { loadBest } from '../storage';
  import { msg, t, fmt } from '../i18n.svelte.ts';
  import Rich from './Rich.svelte';
  import { sfx } from '../audio';

  const best = loadBest();
  let copied = $state(false);

  const perTier = $derived(ROUNDS_PER_TIER);

  const heat = $derived(
    TIERS.map((t, i) => {
      const filled = i < game.finalTierIndex ? perTier : i === game.finalTierIndex ? game.tierProgress : 0;
      return { t, filled, reached: i <= game.finalTierIndex };
    }),
  );

  const headline = $derived(
    game.cleared
      ? game.correct >= TIERS.length * perTier
        ? 'PERFECT CLEAR'
        : 'MISSION CLEAR'
      : 'CONNECTION LOST',
  );

  const shareText = $derived(
    fmt('res.shareText', {
      score: game.score,
      rank: rank().t,
      rankDesc: rank().d,
      correct: game.correct,
      answered: game.answered,
      combo: game.bestChain,
    }),
  );

  async function share(): Promise<void> {
    sfx('select');
    try {
      if (navigator.share) {
        await navigator.share({ title: t(msg('res.shareTitle')), text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      copied = true;
      setTimeout(() => (copied = false), 2200);
    } catch {
      /* 用户取消或不支持 */
    }
  }

  const LOGO = ` ██████╗███████╗ █████╗
██╔════╝██╔════╝██╔══██╗
██║     ███████╗███████║
██║     ╚════██║██╔══██║
╚██████╗███████║██║  ██║
 ╚═════╝╚══════╝╚═╝  ╚═╝`;
</script>

<div class="res" class:cleared={game.cleared}>
  <section class="banner panel" in:fly={{ y: 24, duration: 500 }}>
    <p class="headline" class:lose={!game.cleared}>{headline}</p>
    <p class="sub mute">
      {#if game.cleared}
        <Rich text={fmt('res.clear', { handle: game.handle, n: TIERS.length })} />
      {:else}
        {fmt('res.lost', { tier: fmt(`tier.${TIERS[game.finalTierIndex].id}.label`) })}
      {/if}
    </p>

    <div class="rankRow">
      <div class="rankBox">
        <span class="rlbl mute">RANK</span>
        <span class="rt">{rank().t}</span>
      </div>
      <div class="scoreBox">
        <span class="rlbl mute">SCORE</span>
        <span class="sc">{game.score.toLocaleString()}</span>
        <span class="rd dim">{rank().d}</span>
      </div>
      {#if game.newBest}
        <span class="nb" in:fly={{ x: 20, duration: 400, delay: 500 }}>NEW RECORD</span>
      {/if}
    </div>
  </section>

  <section class="cols">
    <div class="panel box" in:fly={{ y: 20, duration: 420, delay: 120 }}>
      <h3 class="ph">{t(msg('res.log'))}</h3>
      <dl class="stats">
        <div><dt>{t(msg('res.accuracy'))}</dt><dd>{(accuracy() * 100).toFixed(0)}%<em>{game.correct}/{game.answered}</em></dd></div>
        <div><dt>{t(msg('res.bestCombo'))}</dt><dd>×{game.bestChain}</dd></div>
        <div><dt>{t(msg('res.reached'))}</dt><dd class="tiermark">{fmt(`tier.${TIERS[game.finalTierIndex].id}.label`)}</dd></div>
        <div><dt>{t(msg('res.livesLeft'))}</dt><dd>{Math.max(0, game.lives)}</dd></div>
        <div><dt>{t(msg('res.jokersUsed'))}</dt><dd>{game.jokersUsed.length}/3</dd></div>
        <div><dt>{t(msg('res.best'))}</dt><dd>{best ? best.score.toLocaleString() : '—'}</dd></div>
      </dl>

      <h3 class="ph">{t(msg('res.perTier'))}</h3>
      <ul class="heat">
        {#each heat as h (h.t.id)}
          <li style="--th:{h.t.hue}" class:locked={!h.reached}>
            <span class="hname">{h.t.icon} {fmt(`tier.${h.t.id}.label`)}</span>
            <span class="cell">
              {#each Array(ROUNDS_PER_TIER) as _, i (i)}
                <span class="blk" class:on={i < h.filled}></span>
              {/each}
            </span>
            <span class="hnum mute">{h.filled}/{ROUNDS_PER_TIER}</span>
          </li>
        {/each}
      </ul>
    </div>

    <div class="panel box" in:fly={{ y: 20, duration: 420, delay: 200 }}>
      <h3 class="ph">{t(msg('res.next'))}</h3>
      <div class="acts">
        <button class="btn primary" onclick={() => { sfx('select'); retry(); }}>{t(msg('res.retry'))}</button>
        <button class="btn" onclick={() => { sfx('blip'); toIntro(); }}>{t(msg('res.home'))}</button>
        <button class="btn" onclick={share}>{t(msg(copied ? 'res.copied' : 'res.share'))}</button>
        <a class="btn" href="#/leaderboard">{t(msg('nav.leaderboard'))}</a>
        <a class="btn" href="#/ranked">{t(msg('nav.ranked'))}</a>
      </div>

      <h3 class="ph">{t(msg('res.join'))}</h3>
      <div class="join">
        <figure class="qrBox">
          <img class="qrImg" src="./QR.png" alt={t(msg('res.qrAlt'))} />
          <figcaption class="qcap">{t(msg('res.scan'))}</figcaption>
        </figure>
        <div class="jtxt">
          <p><Rich text={t(msg('res.club'))} /></p>
          <p class="dim">{t(msg('res.activities'))}</p>
        </div>
      </div>

      <pre class="logo" aria-hidden="true">{LOGO}</pre>
    </div>
  </section>
</div>

<style>
  .res {
    position: relative;
    z-index: 3;
    max-width: 1080px;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2rem) clamp(0.9rem, 3vw, 1.6rem) 3rem;
    display: flex;
    flex-direction: column;
    gap: clamp(0.9rem, 2vw, 1.3rem);
  }

  .banner {
    padding: 1.4rem 1.5rem 1.5rem;
    text-align: center;
    border-top-width: 2px;
  }
  .cleared .banner {
    box-shadow: 0 0 60px hsl(var(--hue) 100% 50% / 0.2);
  }
  .headline {
    margin: 0 0 0.4rem;
    font-family: var(--display);
    font-size: clamp(1.5rem, 7vw, 3.2rem);
    letter-spacing: 0.14em;
    color: var(--accent);
    text-shadow: 0 0 34px var(--accent-glow);
    animation: flicker 5s infinite;
  }
  .headline.lose {
    color: var(--danger);
    text-shadow: 0 0 34px var(--danger-glow);
  }
  .sub {
    margin: 0;
    font-size: 0.88rem;
  }

  .rankRow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(1rem, 5vw, 3rem);
    margin-top: 1.3rem;
    flex-wrap: wrap;
    position: relative;
  }
  .rankBox,
  .scoreBox {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }
  .rlbl {
    font-size: 0.66rem;
    letter-spacing: 0.3em;
  }
  .rt {
    font-family: var(--display);
    font-size: clamp(2.4rem, 11vw, 4.4rem);
    color: var(--accent);
    text-shadow: 0 0 40px var(--accent-glow);
    border: 2px solid var(--line-hard);
    padding: 0 0.25em;
    animation: pulseGlow 2.6s ease-in-out infinite;
  }
  .sc {
    font-family: var(--display);
    font-size: clamp(2rem, 9vw, 3.4rem);
    color: var(--fg-strong);
    font-variant-numeric: tabular-nums;
  }
  .rd {
    font-size: 0.8rem;
  }
  .nb {
    position: absolute;
    top: -0.8rem;
    right: 0;
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    color: var(--on-accent);
    background: var(--warn);
    padding: 0.1rem 0.5rem;
    animation: blink 1.2s steps(1) infinite;
  }

  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: clamp(0.9rem, 2vw, 1.3rem);
    align-items: start;
  }
  @media (max-width: 860px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .box {
    padding: 1.1rem 1.2rem 1.3rem;
  }
  .ph {
    font-size: 0.78rem;
    letter-spacing: 0.2em;
    color: var(--fg-mute);
    text-transform: uppercase;
    margin-bottom: 0.75rem;
  }
  .box .ph:not(:first-child) {
    margin-top: 1.4rem;
  }

  .stats {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.55rem;
  }
  .stats > div {
    border: 1px solid var(--line);
    padding: 0.5rem 0.6rem;
    background: var(--scrim);
  }
  .stats dt {
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    color: var(--fg-mute);
  }
  .stats dd {
    margin: 0.15rem 0 0;
    font-family: var(--display);
    font-size: 1.3rem;
    color: var(--accent);
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }
  .stats dd em {
    font-style: normal;
    font-size: 0.6em;
    color: var(--fg-mute);
  }
  .stats dd.tiermark {
    font-size: 1.05rem;
  }

  .heat {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .heat li {
    display: grid;
    grid-template-columns: 7.5rem 1fr auto;
    align-items: center;
    gap: 0.7rem;
    font-size: 0.82rem;
  }
  .heat li.locked {
    opacity: 0.4;
  }
  .hname {
    color: hsl(var(--th) 90% 66%);
    white-space: nowrap;
  }
  .cell {
    display: flex;
    gap: 0.25rem;
  }
  .blk {
    flex: 1;
    height: 14px;
    border: 1px solid hsl(var(--th) 60% 50% / 0.35);
    background: var(--scrim);
  }
  .blk.on {
    background: hsl(var(--th) 100% 58%);
    box-shadow: 0 0 12px hsl(var(--th) 100% 60% / 0.6);
  }
  .hnum {
    font-size: 0.74rem;
  }

  .acts {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .acts .btn {
    justify-content: flex-start;
    letter-spacing: 0.08em;
  }

  .join {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .qrBox {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem;
    border: 1px solid var(--line-hard);
    /* 二维码必须落在白底上才能被扫出来 —— 暗色主题下代码块底色就是近黑,这里固定用白 */
    background: #ffffff;
  }
  .qrImg {
    display: block;
    width: 132px;
    height: 132px;
    object-fit: contain;
  }
  .qcap {
    font-size: 0.58rem !important;
    letter-spacing: 0.14em;
    color: #4a5b56; /* 二维码白底上的固定深灰 */
    margin-top: 0.3rem;
  }
  .jtxt {
    flex: 1;
    min-width: 180px;
  }
  .jtxt p {
    margin: 0 0 0.3rem;
    font-size: 0.82rem;
  }
  /* Rich 渲染出的 <b> / <code> 是动态内容,svelte 静态分析看不到 —— 用 :global 保住样式 */
  .jtxt :global(b) {
    color: var(--accent);
  }
  .jtxt :global(code) {
    font-family: var(--mono);
    font-size: 0.9em;
    color: var(--fg-strong);
    background: rgba(255, 255, 255, 0.06);
    padding: 0 0.25em;
  }

  .logo {
    margin: 1.3rem 0 0;
    font-family: var(--mono);
    font-size: clamp(0.32rem, 1.5vw, 0.6rem);
    line-height: 1.05;
    color: var(--accent);
    opacity: 0.35;
    white-space: pre;
    text-align: center;
  }
</style>
