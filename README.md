# STEP 業務ホーム

STEPで日常的に使う業務アプリを、検索・お気に入り・最近使ったアプリ・用途別分類から起動するランチャーです。

## 正本と認証

- システム詳細はスタッフ認証APIの `getSystemRegistry`、正式なシステム一覧は `SYSTEM_REGISTRY.md` から機械生成した `workspace-apps.json` から取得してマージします。
- 日常業務で押す画面は `app-catalog.json` で管理し、ID、表示名、説明、用途分類、本番URL、親システム、検索語、`active / hidden / legacy`、お気に入り・最近使ったアプリ対応を保持します。
- 業務ホームには `active` のみを表示し、同一URLまたは `replaces` 指定の重複カードを除外します。
- 「項目を追加・設定」から項目名の変更・項目追加・項目削除ができ、「カードを移動」からドラッグまたは移動先選択で配置を変更できます。項目削除時は中のカードを残っている項目へ移します。
- 移動モードでは同一項目内の前後移動ができ、画面上部の「戻る」「進む」で編集履歴を操作できます。
- 任意URLのカードを追加できます。カードの×はアーカイブへ移し、アーカイブ画面で復元または完全削除できます。
- 各カードの利用端末は `PC＋スマホ / PC / スマホ` から選択できます。分類・配置・端末指定は同じ端末・ブラウザーの `stepWorkspaceConfigV1` に保存します。
- Google Sheets直リンクは、用途分類の文字アイコンの右隣へ同じ大きさのSheetsマークを表示します。
- すべてのカードリンクは新しいブラウザータブで開きます。
- 認証は既存の `staffLogin`、`getSystemRegistry`、`logoutSystemPortal` を利用します。サーバー側で権限2・3・4を毎回確認します。
- GitHub Pagesへパスワード、APIキー、Apps Scriptの秘密値を埋め込みません。

## ローカル確認

```powershell
npm test
python -m http.server 4173
```

公開先: `https://stepkobetsu-hub.github.io/step-workspace/`
