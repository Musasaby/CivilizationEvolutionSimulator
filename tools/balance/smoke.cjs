// 煙テスト：ゲームを開いて60秒進め、ces.summary() の値がおかしくないかを1コマンドで確かめる
// 使い方：node smoke.cjs（npm run smoke）
const { openGame } = require('./common.cjs');

(async () => {
  let browser = null, code = 0;
  try {
    const { browser: b, page } = await openGame();
    browser = b;
    // 最初の地形・最初の作戦でゲームを始める（startAutoGame は首都がつながらないと false を返す）
    const setup = await page.evaluate(() => {
      const t = Object.keys(ces.BAL.TERRAINS)[0], s = Object.keys(ces.BAL.STRATEGIES)[0];
      return { ok: ces.startAutoGame(t, s), terrain: t, strategy: s };
    });
    if (!setup.ok) throw new Error(`ゲームを始められなかった（地形「${setup.terrain}」作戦「${setup.strategy}」）`);
    await page.evaluate(() => ces.step(60));
    const sm = await page.evaluate(() => ces.summary());
    const errs = [];
    if (!sm) errs.push('summary() が null を返した');
    else {
      if (sm.phase !== 'play') errs.push(`phase が play ではない（${sm.phase}）`);
      if (!(sm.time >= 59)) errs.push(`time が 59 以上ではない（${sm.time}）`);
      for (const [k, v] of Object.entries(sm.resources || {}))
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) errs.push(`resources.${k} が 0 以上の有限の数ではない（${v}）`);
      for (const k of ['units', 'buildings'])
        if (!Number.isInteger(sm[k]) || sm[k] < 0) errs.push(`${k} が 0 以上の整数ではない（${sm[k]}）`);
      if (sm.buildings < 1) errs.push(`buildings が 1 以上ではない（${sm.buildings}）`);
    }
    if (errs.length) { for (const e of errs) console.error(e); code = 1; }
    else console.log(JSON.stringify(sm));
  } catch (e) {
    console.error(e && e.message ? e.message : e);
    code = 1;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(code);
})();
