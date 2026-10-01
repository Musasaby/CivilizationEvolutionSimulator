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

  let r = await hit('foot', 0, 'mobile', 2);
  ok(Math.abs(r.dmg - r.atk * 2) < 0.02, '戦士（歩兵系）→ 騎兵（機動系）に2倍', JSON.stringify(r));
  r = await hit('ranged', 1, 'foot', 0);
  ok(Math.abs(r.dmg - r.atk * 2) < 0.01, '弓兵（射撃系）→ 戦士（歩兵系）に2倍（弾）', JSON.stringify(r));
  r = await hit('mobile', 2, 'siege', 3);
  ok(Math.abs(r.dmg - r.atk * 2) < 0.02, '騎兵 → 大砲兵（攻城）に2倍', JSON.stringify(r));
  r = await hit('mobile', 4, 'ranged', 4);
  ok(Math.abs(r.dmg - r.atk * 2) < 0.02, '装甲バイク兵（機動系）→ 機関銃兵（射撃系）に2倍', JSON.stringify(r));
  r = await hit('foot', 5, 'ranged', 1);
  ok(Math.abs(r.dmg - r.atk) < 0.01, '光剣兵（歩兵系）→ 弓兵（射撃系）は1倍（苦手な相手）', JSON.stringify(r));
  r = await hit('siege', 3, null, 0, true);
  ok(Math.abs(r.dmg - r.atk * 4 * r.bk) < 0.05, '大砲兵 → 建物に4倍（× 時代の倍率）', JSON.stringify(r));
  r = await hit('siege', 5, null, 0, true);
  ok(Math.abs(r.dmg - r.atk * 4 * r.bk) < 0.05, '軌道砲 → 建物に4倍（× 時代の倍率）', JSON.stringify(r));
  r = await hit('siege', 3, 'foot', 3);
  ok(Math.abs(r.dmg - r.atk) < 0.01, '大砲兵の弾が兵に当たると1倍（相性なし）', JSON.stringify(r));

  // 歩兵と機動は、どの時代も近づいてたたく（射程が短い）。射撃は長い
  r = await page.evaluate(() => Object.fromEntries(Object.keys(ces.LINES).map((k) => [k, [0, 1, 2, 3, 4, 5].filter((e) => e >= ces.LINES[k].era).map((e) => ces.unitStats(k, e).range)])));
  ok(r.foot.every((v) => v >= 1 && v <= 1.2) && r.mobile.every((v) => v === 1.1), '歩兵・機動の射程は 1〜1.2（銃を撃たない）', JSON.stringify(r));
  ok(r.ranged.every((v) => v >= 3) && r.siege.every((v) => v >= 5.5) && r.siege[2] === 8, '射撃は射程3以上、攻城は 5.5 → 6.5 → 8', JSON.stringify(r));

  // 攻城は建物だけを狙う。敵の兵が目の前にいても無視する（囲まれても反撃しない）
  r = await page.evaluate(() => {
    const G = ces.G, [ca, cb] = [G.civs[1], G.civs[2]];
    for (const u of G.units) u.dead = true;
    G.units = []; G.projectiles = [];
    const a = ces.spawnUnit(ca, -1, 0, 'siege', 3);
    a.mode = 'attack'; a.targetCiv = cb; a.readyAt = 0;
    const foe = ces.spawnUnit(cb, -0.5, 0, 'foot', 3); foe.cd = 1e9; foe.speed = 0; foe.hp = foe.maxHp = 1e6;
    const f = ces.spawnUnit(ca, -1, 0.3, 'foot', 3);
    f.mode = 'attack'; f.targetCiv = cb; f.readyAt = 0;
    a.speed = f.speed = 0; a.cd = f.cd = 1e9;
    ces.step(0.05);                                    // 兵の位置を登録する
    const none = ces.pickTarget(a), ft = ces.pickTarget(f);
    ces.placeBuilding(cb, 'farm', G.size / 2 + 3, G.size / 2, true);
    const farm = G.buildings[G.buildings.length - 1];
    ces.step(0.05);
    const t = ces.pickTarget(a);
    farm.dead = true;
    return { none: none === null, building: !!t && t.isBuilding, foot: !!ft && !ft.isBuilding && ft.kind === 'foot' };
  });
  ok(r.none, '攻城：敵の兵だけが近くにいても、何も狙わない', JSON.stringify(r));
  ok(r.building, '攻城：兵と建物が近くにあれば、建物を狙う', JSON.stringify(r));
  ok(r.foot, '（くらべ）歩兵は、近くの敵の兵を狙う', JSON.stringify(r));

  // 進化：その系統の建物でいちばん新しい時代まで。費用は進化先の半分・HP の割合と枠は変わらない
  r = await page.evaluate(() => {
    const G = ces.G, c = G.civs[1];
    for (const u of G.units) u.dead = true;
    G.units = []; G.projectiles = [];
    c.res = { food: 1e5, wood: 1e5, stone: 1e5, know: 1e5 };
    const us = [0, 1, 2].map((i) => ces.spawnUnit(c, -2, i * 0.5, 'foot', 0));
    us[0].hp = us[0].maxHp / 2;
    const none = ces.evolveUnits(c, 'foot');           // 古い建物がないので進化できない
    c.era = 2;
    ces.placeBuilding(c, 'barracks', c.capital.tx + 2, c.capital.tz + 2, true);
    const food0 = c.res.food, can = ces.evolvable(c, 'foot').length;
    const n = ces.evolveUnits(c, 'foot', 2);
    const cost = ces.evolveCost('foot', 2), spent = food0 - c.res.food;
    const noRanged = ces.evolveUnits(c, 'ranged');     // 射撃場がない系統は進化しない
    return { none, can, n, spent, want: 2 * cost.food, eras: us.map((u) => u.era), ratio: +(us[0].hp / us[0].maxHp).toFixed(2),
      kinds: us.map((u) => u.kind).join(), maxHp: +us[0].maxHp.toFixed(2), wantHp: +ces.unitStats('foot', 2).hp.toFixed(2), noRanged };
  });
  ok(r.none === 0 && r.can === 3 && r.n === 2 && r.noRanged === 0, '進化：建物がなければ進化しない／建物の時代まで／系統の建物がなければ進化しない', JSON.stringify(r));
  ok(r.spent === r.want, '進化の費用は、進化先の兵の費用の半分（切り上げ）× 人数', JSON.stringify(r));
  ok(r.eras.join() === '2,2,0' && r.kinds === 'foot,foot,foot' && r.ratio === 0.5 && r.maxHp === r.wantHp, '進化：系統は変わらず、HP の割合を保ったまま新しい強さになる', JSON.stringify(r));

  // タレットには相性がない
  r = await page.evaluate(() => ces.hitMult(null, { isBuilding: false, kind: 'mobile' }));
  ok(r === 1, 'タレットの弾は1倍');

  // AI：敵の軍の半分以上が機動系なら、それに弱い兵（射撃系・攻城）づくりを止め、歩兵系を重く見る
  r = await page.evaluate(() => {
    const G = ces.G, c = G.civs[1], P = G.player;
    for (const u of G.units) u.dead = true;
    G.units = [];
    const at = { barracks: 2, range: -2, stable: 0, foundry: 4 };
    for (const k in at) ces.placeBuilding(c, k, c.capital.tx + at[k], c.capital.tz + 2, true);
    for (let i = 0; i < 8; i++) ces.spawnUnit(P, P.capital.x, P.capital.z + 1, 'mobile', 3);
    for (let i = 0; i < 2; i++) ces.spawnUnit(P, P.capital.x, P.capital.z + 1, 'foot', 3);
    const mix = ces.enemyMix(c), need = ces.counterNeed(mix);
    ces.aiTrainPlan(c, mix);
    const paused = Object.fromEntries(G.buildings.filter((b) => b.civ === c && ces.BUILD[b.type].trains).map((b) => [b.type, !!b.paused]));
    // 敵が歩兵ばかりに変わったら、射撃場は再開し、厩舎（歩兵に弱い）を止める
    for (const u of G.units) if (u.kind === 'mobile') u.dead = true;
    G.units = G.units.filter((u) => !u.dead);
    for (let i = 0; i < 8; i++) ces.spawnUnit(P, P.capital.x, P.capital.z + 1, 'foot', 3);
    const mix2 = ces.enemyMix(c);
    ces.aiTrainPlan(c, mix2);
    const paused2 = Object.fromEntries(G.buildings.filter((b) => b.civ === c && ces.BUILD[b.type].trains).map((b) => [b.type, !!b.paused]));
    return { need, paused, paused2 };
  });
  ok(r.need.foot > 0.7, 'AI：敵が騎兵ばかりなら、歩兵系が役に立つと見る', JSON.stringify(r.need));
  ok(r.paused.range && r.paused.foundry && !r.paused.barracks && !r.paused.stable, 'AI：機動ばかりの敵には、射撃場と砲兵工場を止める', JSON.stringify(r.paused));
  ok(!r.paused2.range && r.paused2.stable && !r.paused2.barracks, 'AI：歩兵ばかりの敵には、厩舎を止めて射撃場を再開', JSON.stringify(r.paused2));

  await browser.close();
  console.log(fails ? `\n${fails} 件 FAIL` : '\nすべて PASS');
  process.exit(fails ? 1 : 0);
})();
