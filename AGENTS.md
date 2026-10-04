# AGENTS.md

ブラウザゲーム（プロトタイプ）。地形を塗る→資源を集めて建物・兵を作る→敵の攻撃を守りつつ石器から未来へ時代を進める→首都が落ちたら終了。兵は自動で動き、王は割合・目標を決めるだけ。

## 構成
- `prototype/index.html`：ゲーム全体（1ファイル、約3700行）。Three.js 0.160 を CDN から読む。ビルドなし
- `GAME_DESIGN.md`：仕様。ルールを変えたら更新する
- `tmp/PLAN*.md`：作業の手順書（git 管理外）

## 確認
- `?debug` 付きで開くと `window.ces` が使える。`ces.step(秒)` で時間を進める
- 煙テスト（ゲームが自動で動くかの簡単チェック）は `cd tools/balance && npm run smoke` で実行できる
- Playwright で確かめる

## ルール
- 敵AIも同じルールで動かす
- 作業は `develop/<名前>` ブランチで。`main` へ直接 push しない
- コミットは `feat: 〜` 形式、説明は日本語
- ユーザーへの説明は、やさしい日本語で

## マルチエージェントワークフロー

複数エージェント協調の実装ワークフローは `.agents/skills/` の各skillで定義されている。

- 状態・設定の正本: `.agents/workflow/`(`config.json`, `tasks.md`, `state.json`)
- 子エージェントとして実装を依頼された場合は、タスク定義(`.agents/workflow/tasks.md`)の受け入れ基準を満たし、テストを実行してから完了報告すること
- 理解確認(任意): `comprehension_check.enabled` が true の場合、各タスク完了後に質問ファイルが生成されます。回答を記入して `/agent-comprehension-check` を実行すると判定・解説が得られます(別セッションでも可)
- 問題発生時の対応順序: 1) `multi-ai-agents-workflow` 由来の問題かを切り分け 2) スクリプトによる自動化などAIの性能に依存しない機械的改善を最優先で検討 3) 2 が難しい場合のみ skills/AGENTS.md 等ドキュメントの改善で対処 4) ワークフロー由来、または解決困難な場合はユーザーに報告して中断 5) ワークフロー由来の問題は、ユーザーの承認を得て upstream(配布元)リポジトリに Issue を起票する(詳細は `agent-workflow` skillの「問題発生時の対応順序」を参照)
