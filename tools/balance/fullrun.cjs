// 通しのテスト：プレイヤーも AI に動かさせ、3つの作戦 × 地形5種類で、ゲームを最後まで（または MINUTES 分）回す
// 使い方：node fullrun.cjs [分=20] [くり返し=1]
const fs = require('fs');
const path = require('path');
const { openGame } = require('./common.cjs');

const MINUTES = +(process.argv[2] || 20);
const REPEAT = +(process.argv[3] || 1);

// 作戦と地形の一覧は prototype/index.html の BAL.STRATEGIES・BAL.TERRAINS（観戦パネルと同じもの）
async function setupGame(page, tname, sname) {
  const ok = await page.evaluate(([t, s]) => ces.startAutoGame(t, s), [tname, sname]);
  if (!ok) throw new Error(`地形を作れなかった：${tname}`);
  await page.click('[data-speed="0"]');
}

(async () => {
  const { browser, page } = await openGame();
  const rows = ['| 地形 | 作戦 | 生きのびた時間 | 到達した時代 | 倒した敵 | ほろぼした国 | 兵の上限まで使った割合 | 最後の軍（歩/機/射/攻） |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  const all = [];
  const { STRATEGIES, TERRAINS } = await page.evaluate(() => ces.BAL);
  for (let rep = 0; rep < REPEAT; rep++) {
    for (const tname of Object.keys(TERRAINS)) {
      for (const sname of Object.keys(STRATEGIES)) {
        await setupGame(page, tname, sname);
        let r;
        // 1分ずつ進める（ページが長く止まらないように）。兵の上限まで使った割合も記録する
        const capUse = [];
        for (let m = 0; m < MINUTES; m++) {
          r = await page.evaluate(() => {
            ces.step(60);
            const G = ces.G, P = G.player;
            const n = G.units.filter((u) => !u.dead && u.civ === P).length;
            return { over: G.phase !== 'play', t: G.time, era: G.maxEra, kills: P.kills, civs: G.civKills, use: P.popCap ? n / P.popCap : 0,
              mix: ces.classMix(P), eraName: ces.ERAS[G.maxEra].name };
          });
          capUse.push(r.use);
          if (r.over) break;
        }
        const use = capUse.reduce((a, b) => a + b, 0) / capUse.length;
        const survived = r.over ? `${Math.floor(r.t / 60)}分${Math.floor(r.t % 60)}秒で負け` : `${MINUTES}分 生存`;
        const row = `| ${tname} | ${sname} | ${survived} | ${r.eraName} | ${r.kills} | ${r.civs} | ${Math.round(use * 100)}% | ${r.mix.foot}/${r.mix.mobile}/${r.mix.ranged}/${r.mix.siege} |`;
        rows.push(row); console.log(row);
        all.push({ terrain: tname, strategy: sname, ...r, capUse: use });
      }
    }
  }
  // 作戦ごとのまとめ
  rows.push('', '| 作戦 | 生存した回数 | 平均の時代 | 平均の撃破 | 平均の生存時間 |', '| --- | --- | --- | --- | --- |');
  for (const s of Object.keys(STRATEGIES)) {
    const l = all.filter((x) => x.strategy === s), avg = (f) => l.reduce((a, x) => a + f(x), 0) / l.length;
    rows.push(`| ${s} | ${l.filter((x) => !x.over).length} / ${l.length} | ${avg((x) => x.era).toFixed(1)} | ${avg((x) => x.kills).toFixed(0)} | ${(avg((x) => x.t) / 60).toFixed(1)}分 |`);
  }
  const md = rows.join('\n');
  fs.writeFileSync(path.join(__dirname, 'fullrun-latest.md'), md + '\n');
  console.log(md.split('\n').slice(-5).join('\n'));
  await browser.close();
})();
