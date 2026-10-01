// 小さな戦いのテスト：2つの軍を平地で戦わせ、勝ち負けと残りの HP をはかる
//   A ＝ 相性で有利な「古い時代」の兵、B ＝ 相性で不利な「新しい時代」の兵
//   目標：1時代差なら A が勝つ。2時代差なら B が勝つ
//   組み合わせの一覧は prototype/index.html の BAL.MATCHES（観戦パネルと同じもの）
// 使い方：node skirmish.cjs [回数=6] [そろえ方=cost|pop] [予算=600 または 枠=12]
//   cost：同じ費用（資源の合計）で人数を決める ／ pop：同じ枠（兵士の上限の枠の数が同じ。戦車は1人3枠など）
const fs = require('fs');
const path = require('path');
const { openGame } = require('./common.cjs');

const TRIALS = +(process.argv[2] || 6);
const MODE = process.argv[3] || 'cost';
const BUDGET = +(process.argv[4] || (MODE === 'pop' ? 12 : 600));

(async () => {
  const { browser, page } = await openGame();
  await page.evaluate(() => ces.arena());
  const groups = await page.evaluate(() => ces.BAL.MATCHES);
  const out = [], rows = [];
  for (const [group, list] of Object.entries(groups)) {
    rows.push(`\n### ${group}\n`, '| A（有利） | B（不利） | 人数 A:B | A の勝率 | 残りHP A / B | 平均の時間 | 判定 |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const m of list) {
      const r = await page.evaluate(({ m, TRIALS, BUDGET, MODE }) => {
        const x = ces.armiesOf(m, MODE, BUDGET), res = [];
        for (let i = 0; i < TRIALS; i++) res.push(ces.battle(x.A, x.B));
        const avg = (f) => res.reduce((s, y) => s + f(y), 0) / res.length;
        return { nameA: x.nameA, nameB: x.nameB, nA: x.nA, nB: x.nB, gap: x.gap,
          winA: avg((y) => (y.win === 'A' ? 1 : 0)), hpA: avg((y) => y.hpA), hpB: avg((y) => y.hpB), t: avg((y) => y.t) };
      }, { m, TRIALS, BUDGET, MODE });
      const goal = r.gap === 1 ? r.winA > 0.5 : r.gap === 2 ? r.winA < 0.5 : null;
      const mark = goal === null ? '-' : goal ? '✅' : '❌';
      rows.push(`| ${r.nameA} | ${r.nameB} | ${r.nA}:${r.nB} | ${Math.round(r.winA * 100)}% | ${r.hpA.toFixed(2)} / ${r.hpB.toFixed(2)} | ${r.t.toFixed(0)}秒 | ${mark} |`);
      out.push({ group, m, ...r, goal });
      console.log(rows[rows.length - 1]);
    }
  }
  const pass = out.filter((x) => x.goal === true).length, total = out.filter((x) => x.goal !== null).length;
  rows.push(`\n目標に届いた組み合わせ：${pass} / ${total}（${TRIALS}回ずつ・${MODE === 'pop' ? `同じ枠 ${BUDGET}枠` : `同じ費用 ${BUDGET}`}）`);
  const md = rows.join('\n');
  fs.writeFileSync(path.join(__dirname, `skirmish-${MODE}.md`), md + '\n');
  console.log(md.split('\n').slice(-1)[0]);
  await browser.close();
})();
