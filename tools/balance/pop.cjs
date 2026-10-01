// 兵士の上限のテスト：家だけで決まり、家を建てた時代で変わる。最大 64。使い方：node pop.cjs
const { openGame } = require('./common.cjs');
let fails = 0;
const ok = (cond, name, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!cond) fails++; };
(async () => {
  const { browser, page } = await openGame();
  await page.evaluate(() => ces.arena());
  const r = await page.evaluate(() => {
    const G = ces.G, c = G.civs[1], out = {};
    for (const b of G.buildings) if (b.civ === c && b.type === 'house') b.dead = true;
    const put = (i) => ces.placeBuilding(c, 'house', c.capital.tx + 2 + (i % 6), c.capital.tz + 2 + ((i / 6) | 0), true);
    ces.G.buildings = G.buildings.filter((b) => !b.dead);
    c.era = 0; 
    out.none = c.popCap;                                   // 家がない
    const h = put(0); out.one = c.popCap;                  // 石器の家 1つ
    c.era = 5; out.eraOnly = c.popCap;                     // 時代が進んでも、家が古ければ変わらない
    put(1); out.mixed = c.popCap;                          // 石器 4 ＋ 未来 9
    c.res = { food: 1e5, wood: 1e5, stone: 1e5, know: 1e5 };
    ces.startReno(h);                                      // 石器の家を改修（兵士が作業に行くので、ここでは作業を直接進める）
    h.renoProg = 1; ces.finishReno(h); out.reno = c.popCap;   // 石器 4 → 未来 9
    return out;
  });
  ok(r.none === 0, '家がなければ上限 0', JSON.stringify(r));
  ok(r.one === 4, '石器の家 1つで +4', JSON.stringify(r));
  ok(r.eraOnly === 4, '時代だけ進んでも上限は変わらない（家だけで決まる）', JSON.stringify(r));
  ok(r.reno === 18, '改修すると、その家の上限が新しい時代のものになる（9 ＋ 9）', JSON.stringify(r));
  ok(r.mixed === 13, '未来の家は +9（石器の家 4 ＋ 未来の家 9）', JSON.stringify(r));
  const m = await page.evaluate(() => {
    const G = ces.G, c = G.civs[2];
    c.era = 5;
    for (let i = 0; i < 12; i++) ces.placeBuilding(c, 'house', c.capital.tx + 2 + (i % 6), c.capital.tz - 2 - ((i / 6) | 0), true);
    return { cap: c.popCap, houses: G.buildings.filter((b) => b.civ === c && b.type === 'house').length };
  });
  ok(m.cap === 64, '未来の家をたくさん建てても最大 64', JSON.stringify(m));
  await browser.close();
  console.log(fails ? `\n${fails} 件 FAIL` : '\nすべて PASS');
  process.exit(fails ? 1 : 0);
})();
