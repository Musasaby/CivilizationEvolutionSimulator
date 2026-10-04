# タスク一覧: tmp/PLAN-workflow-smoke.md

## T1: デバッグ API に ces.summary() を追加する
- **目的**: テストからゲームの状態を1つのオブジェクトで取れるようにする。ゲームの仕様(ルール・数値・画面)は変えない
- **対象**: `prototype/index.html`(`window.ces` を定義している「開発用：URL に ?debug をつけると」の箇所)
- **受け入れ基準**:
  - [ ] `window.ces.summary()` が `{ phase, time, era, eraName, resources, units, buildings }` を返す
  - [ ] `era` は `G.maxEra`、`eraName` は `ERAS[G.maxEra].name`、`resources` はプレイヤーの資源(資源名 → 数のオブジェクト)、`units` はプレイヤーの生きている兵の数、`buildings` はプレイヤーの建物の数
  - [ ] ゲーム開始前(`G` が無いとき)は `null` を返す
  - [ ] 確認手順: `tools/balance` で次を実行し、`play` と数値が表示されること(エラーなし)
        `node -e "const {openGame}=require('./common.cjs');(async()=>{const {browser,page}=await openGame();const ok=await page.evaluate(()=>{const b=ces.BAL;return ces.startAutoGame(Object.keys(b.TERRAINS)[0],Object.keys(b.STRATEGIES)[0])});await page.evaluate(()=>ces.step(10));console.log(ok, JSON.stringify(await page.evaluate(()=>ces.summary())));await browser.close()})()"`
- **依存**: なし

## T2: 煙テスト tools/balance/smoke.cjs を追加する
- **目的**: ゲームを開いて60秒進め、ces.summary() の値がおかしくないかを1コマンドで確かめる
- **対象**: `tools/balance/smoke.cjs`(新規)、`tools/balance/package.json`
- **受け入れ基準**:
  - [ ] `smoke.cjs` は `common.cjs` の `openGame()` でゲームを開き、`ces.BAL` の最初の地形・最初の作戦で `ces.startAutoGame` を呼び、`ces.step(60)` のあと `ces.summary()` を取る
  - [ ] 次のどれかを満たさないとき、理由を表示して exit 1 で終わる: `phase === 'play'` / `time >= 59` / `resources` の値がすべて有限の数で 0 以上 / `units` と `buildings` が 0 以上の整数 / `buildings >= 1`
  - [ ] すべて満たすとき、summary を1行の JSON で表示して exit 0 で終わる。ブラウザは必ず閉じる
  - [ ] `tools/balance/package.json` の scripts に `"smoke": "node smoke.cjs"` がある
  - [ ] 確認手順: `cd tools/balance && npm run smoke` が exit 0 で終わる
- **依存**: T1

## T3: AGENTS.md に煙テストの実行方法を書く
- **目的**: 人とエージェントが煙テストの存在と実行方法を知れるようにする
- **対象**: `AGENTS.md`(「## 確認」節)
- **受け入れ基準**:
  - [ ] 「## 確認」節に、`cd tools/balance && npm run smoke` で煙テストを実行できることが1行で書かれている(やさしい日本語)
  - [ ] AGENTS.md の他の節は変わっていない(`git diff AGENTS.md` の変更が「## 確認」節の1行追加だけ)
- **依存**: T2
