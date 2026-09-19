<script lang="ts">
  /** 标题页：排位赛入口、共享排行榜与三档难度规则。 */
  import { fade, fly } from 'svelte/transition';
  import { TIERS } from '../data/tiers';
  import { ALL_QUESTIONS_SOURCE } from '../data/questions';
  import { ROUNDS_PER_TIER } from '../data/types';
  import { JOKERS_PER_RUN, jokers } from '../quiz.svelte';
  import { msg, t, fmt } from '../i18n.svelte.ts';
  const p2 = (n: number) => String(n).padStart(2, '0');

  const LOGO = ` ██████╗███████╗ █████╗     ██████╗  █████╗ ██╗██████╗
██╔════╝██╔════╝██╔══██╗    ██╔══██╗██╔══██╗██║██╔══██╗
██║     ███████╗███████║    ██████╔╝███████║██║██║  ██║
██║     ╚════██║██╔══██║    ██╔══██╗██╔══██║██║██║  ██║
╚██████╗███████║██║  ██║    ██║  ██║██║  ██║██║██████╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═════╝ `;
</script>

<div class="intro">
  <header class="head">
    <div class="org" in:fade={{ duration: 260 }}>
      <span class="chip">{t(msg('org.chip'))}</span>
      <span class="chip">{fmt('org.bank', { n: ALL_QUESTIONS_SOURCE.length })}</span>
    </div>

    <div class="logoWrap">
      <pre class="logo" aria-hidden="true">{LOGO}</pre>
      <pre class="logo ghost" aria-hidden="true">{LOGO}</pre>
      <pre class="logo ghost2" aria-hidden="true">{LOGO}</pre>
    </div>

    <h1 class="title">
      <span class="w1">ANSWER</span>
      <span class="w2">RAID</span>
    </h1>
    <p class="sub">
      {fmt('intro.tagline', { tiers: TIERS.length, rounds: ROUNDS_PER_TIER, tier: TIERS[TIERS.length - 1].name })}
    </p>
    <div class="ranked-links">
      <a class="btn primary" href="#/ranked">{t(msg('nav.ranked'))}</a>
      <a class="btn" href="#/leaderboard">{t(msg('nav.leaderboard'))}</a>
    </div>
  </header>

  <section class="grid">
    <div class="panel tiers" in:fly={{ y: 22, duration: 420, delay: 60 }}>
      <h2 class="ph">{t(msg('intro.tiers'))}</h2>
      <ol>
        {#each TIERS as t, i (t.id)}
          <li style="--tier-hue:{t.hue}" class="tier">
            <span class="idx">{p2(i + 1)}</span>
            <span class="icon">{t.icon}</span>
            <span class="meta">
              <span class="name"
                >{fmt(`tier.${t.id}.label`)}{#if fmt(`tier.${t.id}.label`) !== t.name} · <em>{t.name}</em>{/if}</span
              >
              <span class="desc">{fmt(`tier.${t.id}.desc`)}</span>
            </span>
            <span class="stat">
              <span>{fmt('intro.nPerTier', { n: ROUNDS_PER_TIER })}</span>
              <span>{fmt('intro.perQuestion', { s: t.timeLimit })}</span>
              <span>{fmt('intro.lives', { n: t.allowMiss })}</span>
            </span>
          </li>
        {/each}
      </ol>
      <p class="rule mute">
        {t(msg('intro.randomNote'))}
      </p>
    </div>

    <div class="rightCol">
      <div class="panel card" in:fly={{ y: 22, duration: 420, delay: 210 }}>
        <h2 class="ph">{t(msg('intro.jokers'))}</h2>
        <ul class="jokers">
          {#each jokers() as j (j.id)}
            <li><span class="jk">{j.glyph}</span><b>{j.name}</b><span class="dim">{j.desc}</span></li>
          {/each}
        </ul>
        <p class="rule mute">
          {fmt('intro.jokersNote', { n: JOKERS_PER_RUN })}
        </p>
      </div>

    </div>
  </section>

  <footer class="foot mute">
    <span>{t(msg('intro.footKeys'))}</span>
  </footer>
</div>

<style>
  .ranked-links { display:flex; justify-content:center; gap:.75rem; flex-wrap:wrap; margin:1.4rem 0 .3rem; }
  .intro {
    position: relative;
    z-index: 3;
    max-width: 1180px;
    margin: 0 auto;
    padding: clamp(1.2rem, 3.5vw, 2.6rem) clamp(0.9rem, 3vw, 2rem) 3rem;
    display: flex;
    flex-direction: column;
    gap: clamp(1.2rem, 3vw, 2rem);
  }

  .head {
    text-align: center;
  }
  .org {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .logoWrap {
    position: relative;
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
  }
  .logo {
    margin: 0;
    font-family: var(--mono);
    font-weight: 700;
    font-size: clamp(0.3rem, 1.42vw, 0.78rem);
    line-height: 1.05;
    letter-spacing: 0;
    color: var(--accent);
    text-shadow: 0 0 18px var(--accent-glow);
    animation: flicker 4.5s infinite;
    white-space: pre;
  }
  .logo.ghost,
  .logo.ghost2 {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .logo.ghost {
    color: var(--ghost-a);
    opacity: 0.55;
    animation: glitchShift 3.4s infinite steps(2);
  }
  .logo.ghost2 {
    color: var(--ghost-b);
    opacity: 0.45;
    animation: glitchShift 2.6s infinite reverse steps(2);
  }

  .title {
    display: flex;
    gap: 0.6em;
    justify-content: center;
    align-items: baseline;
    margin: 0.9rem 0 0.4rem;
    font-size: clamp(2rem, 9vw, 5rem);
    letter-spacing: 0.06em;
    line-height: 1;
  }
  .w1 {
    color: var(--fg-strong);
    text-shadow: 0 0 30px hsl(var(--hue) 100% 60% / 0.35);
  }
  .w2 {
    color: var(--accent);
    text-shadow: 0 0 26px var(--accent-glow);
    -webkit-text-stroke: 1px var(--accent);
  }
  .sub {
    margin: 0;
    color: var(--fg-dim);
    font-size: clamp(0.8rem, 2.4vw, 0.98rem);
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: clamp(0.9rem, 2vw, 1.4rem);
    align-items: start;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .panel {
    padding: 1.1rem 1.2rem 1.25rem;
  }
  .ph {
    font-size: 0.82rem;
    letter-spacing: 0.2em;
    color: var(--fg-mute);
    margin-bottom: 0.9rem;
    text-transform: uppercase;
  }

  .tiers ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .tier {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid hsl(var(--tier-hue) 70% 55% / 0.35);
    border-left: 3px solid hsl(var(--tier-hue) 100% 60%);
    background: linear-gradient(90deg, hsl(var(--tier-hue) 90% 50% / 0.1), transparent 60%);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .tier:hover {
    transform: translateX(4px);
    box-shadow: -4px 0 22px hsl(var(--tier-hue) 100% 60% / 0.22);
  }
  .idx {
    font-size: 0.72rem;
    color: hsl(var(--tier-hue) 60% 70%);
    opacity: 0.7;
  }
  .icon {
    font-size: 1.5rem;
    color: hsl(var(--tier-hue) 100% 62%);
    text-shadow: 0 0 14px hsl(var(--tier-hue) 100% 60% / 0.6);
  }
  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-family: var(--display);
    font-size: 1.02rem;
    color: var(--fg-strong);
    letter-spacing: 0.05em;
  }
  .name em {
    font-style: normal;
    color: hsl(var(--tier-hue) 100% 62%);
    font-size: 0.8em;
  }
  .desc {
    font-size: 0.78rem;
    color: var(--fg-dim);
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.1rem;
    font-size: 0.72rem;
    color: hsl(var(--tier-hue) 55% 72%);
    white-space: nowrap;
  }

  .rightCol {
    display: flex;
    flex-direction: column;
    gap: clamp(0.9rem, 2vw, 1.1rem);
  }

  .jokers {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .jokers li {
    display: grid;
    grid-template-columns: 1.6rem auto 1fr;
    gap: 0.6rem;
    align-items: center;
    font-size: 0.86rem;
    padding: 0.35rem 0.5rem;
    border: 1px dashed var(--line);
  }
  .jk {
    font-size: 1.1rem;
    color: var(--accent);
    text-align: center;
  }
  .jokers b {
    color: var(--fg-strong);
  }

  .rule {
    margin: 0.85rem 0 0;
    font-size: 0.76rem;
    line-height: 1.7;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    justify-content: space-between;
    font-size: 0.74rem;
    border-top: 1px solid var(--line);
    padding-top: 0.9rem;
  }
</style>
