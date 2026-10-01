// 相性のルールのテスト（PASS / FAIL を出す）。使い方：node rules.cjs
const path = require('path');
const { openGame } = require('./common.cjs');

let fails = 0;
const ok = (cond, name, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!cond) fails++; };

(async () => {
  const { browser, page } = await openGame();
  await page.evaluate(() => ces.arena());

  // 1回の攻撃で相手の HP がどれだけ減るか（弾の兵は、弾が届くまで進める）。相手は反撃しない
  const hit = (ka, ea, kb, eb, building) => page.evaluate(({ ka, ea, kb, eb, building }) => {
    const G = ces.G, [ca, cb] = [G.civs[1], G.civs[2]];
    for (const u of G.units) u.dead = true;
    G.units = []; G.projectiles = [];
    const a = ces.spawnUnit(ca, -1, 0, ka, ea);
    let t;
    if (building) {
      ces.placeBuilding(cb, 'farm', G.size / 2 + 1, G.size / 2, true);
      t = G.buildings[G.buildings.length - 1];
      a.x = t.x - 1; a.z = t.z;
    } else { t = ces.spawnUnit(cb, 0, 0, kb, eb); t.cd = 1e9; t.speed = 0; }
    t.hp = t.maxHp = 1e6;
    ces.unitAttack(a, t);
    a.cd = 1e9; a.speed = 0;
    for (let k = 0; k < 60 && G.projectiles.some((p) => !p.dead); k++) ces.step(0.05);
    const dmg = 1e6 - t.hp;
    if (building) t.dead = true;
    return { dmg: +dmg.toFixed(2), atk: +a.atk.toFixed(2), bk: a.bk };
  }, { ka, ea, kb, eb, building });

  let r = await hit('inf', 0, 'cavalry', 2);
  ok(Math.abs(r.dmg - r.atk * 2) < 0.02, '戦士（歩兵系）→ 騎兵（機動系）に2倍', JSON.stringify(r));
  r = await hit('archer', 1, 'inf', 0);
  ok(Math.abs(r.dmg - r.atk * 2) < 0.01, '弓兵（射撃系）→ 戦士（歩兵系）に2倍（弾）', JSON.stringify(r));
  r = await hit('cavalry', 2, 'cannon', 3);
  ok(Math.abs(r.dmg - r.atk * 2) < 0.02, '騎兵 → 大砲兵（攻城）に2倍', JSON.stringify(r));
  r = await hit('tank', 4, 'archer', 4);
  ok(Math.abs(r.dmg - r.atk * 2) < 0.01, '戦車（機動系・範囲攻撃）→ 弓兵に2倍', JSON.stringify(r));
  r = await hit('inf', 5, 'archer', 1);
  ok(Math.abs(r.dmg - r.atk) < 0.01, '光線兵（歩兵系）→ 弓兵（射撃系）は1倍（苦手な相手）', JSON.stringify(r));
  r = await hit('cannon', 3, null, 0, true);
  ok(Math.abs(r.dmg - r.atk * 4 * r.bk) < 0.05, '大砲兵 → 建物に4倍（× 時代の倍率）', JSON.stringify(r));
  r = await hit('cannon', 3, 'inf', 3);
  ok(Math.abs(r.dmg - r.atk) < 0.01, '大砲兵 → 兵には1倍（相性なし）', JSON.stringify(r));

  // 範囲攻撃：系統のちがう兵がまとまっていても、それぞれに合った倍率がかかる
  r = await page.evaluate(() => {
    const G = ces.G, [ca, cb] = [G.civs[1], G.civs[2]];
    for (const u of G.units) u.dead = true;
    G.units = []; G.projectiles = [];
    const a = ces.spawnUnit(ca, -3, 0, 'tank', 4);
    const x = ces.spawnUnit(cb, 0, 0, 'archer', 4), y = ces.spawnUnit(cb, 0.2, 0.1, 'inf', 4);
    for (const t of [x, y]) { t.hp = t.maxHp = 1e6; t.cd = 1e9; t.speed = 0; }
    ces.unitAttack(a, x); a.cd = 1e9; a.speed = 0;
    for (let k = 0; k < 60 && G.projectiles.some((p) => !p.dead); k++) ces.step(0.05);
    return { atk: a.atk, archer: 1e6 - x.hp, inf: 1e6 - y.hp };
  });
  ok(Math.abs(r.archer - r.atk * 2) < 0.01 && Math.abs(r.inf - r.atk) < 0.01, '戦車の範囲攻撃：弓兵に2倍・歩兵に1倍', JSON.stringify(r));

  // タレットには相性がない
  r = await page.evaluate(() => ces.hitMult(null, { isBuilding: false, kind: 'cavalry' }));
  ok(r === 1, 'タレットの弾は1倍');

  // AI：敵の軍の半分以上が機動系なら、それに弱い兵（射撃系・攻城）づくりを止め、歩兵系を重く見る
  r = await page.evaluate(() => {
    const G = ces.G, c = G.civs[1], P = G.player;
    for (const u of G.units) u.dead = true;
    G.units = [];
    for (const k of ['barracks', 'range', 'stable']) {
      ces.placeBuilding(c, k, c.capital.tx + (k === 'barracks' ? 2 : k === 'range' ? -2 : 0), c.capital.tz + 2, true);
    }
    for (let i = 0; i < 8; i++) ces.spawnUnit(P, P.capital.x, P.capital.z + 1, 'cavalry', 2);
    for (let i = 0; i < 2; i++) ces.spawnUnit(P, P.capital.x, P.capital.z + 1, 'inf', 2);
    const mix = ces.enemyMix(c), need = ces.counterNeed(mix);
    ces.aiTrainPlan(c, mix);
    const paused = Object.fromEntries(G.buildings.filter((b) => b.civ === c && ces.BUILD[b.type].trains).map((b) => [b.type, !!b.paused]));
    // 敵が歩兵ばかりに変わったら、射撃場は再開し、厩舎（歩兵に弱い）を止める
    for (const u of G.units) if (u.kind === 'cavalry') u.dead = true;
    G.units = G.units.filter((u) => !u.dead);
    for (let i = 0; i < 8; i++) ces.spawnUnit(P, P.capital.x, P.capital.z + 1, 'inf', 2);
    const mix2 = ces.enemyMix(c);
    ces.aiTrainPlan(c, mix2);
    const paused2 = Object.fromEntries(G.buildings.filter((b) => b.civ === c && ces.BUILD[b.type].trains).map((b) => [b.type, !!b.paused]));
    return { need, paused, paused2 };
  });
  ok(r.need.foot > 0.7, 'AI：敵が騎兵ばかりなら、歩兵系が役に立つと見る', JSON.stringify(r.need));
  ok(r.paused.range && !r.paused.barracks && !r.paused.stable, 'AI：騎兵ばかりの敵には、射撃場を止める', JSON.stringify(r.paused));
  ok(!r.paused2.range && r.paused2.stable && !r.paused2.barracks, 'AI：歩兵ばかりの敵には、厩舎を止めて射撃場を再開', JSON.stringify(r.paused2));

  await browser.close();
  console.log(fails ? `\n${fails} 件 FAIL` : '\nすべて PASS');
  process.exit(fails ? 1 : 0);
})();
