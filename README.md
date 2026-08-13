# STEP 業務ホーム

STEPで日常的に使う業務アプリを、検索・お気に入り・最近使ったアプリ・用途別分類から起動するランチャーです。

## 正本と認証

- システム詳細はスタッフ認証APIの `getSystemRegistry`、正式なシステム一覧は `SYSTEM_REGISTRY.md` から機械生成した `workspace-apps.json` から取得してマージします。
- 日常業務で押す画面は `app-catalog.json` で管理し、ID、表示名、説明、用途分類、本番URL、親システム、検索語、`active / hidden / legacy`、お気に入り・最近使ったアプリ対応を保持します。
- 業務ホームには `active` のみを表示し、同一URLまたは `replaces` 指定の重複カードを除外します。
- 認証は既存の `staffLogin`、`getSystemRegistry`、`logoutSystemPortal` を利用します。サーバー側で権限2・3・4を毎回確認します。
- GitHub Pagesへパスワード、APIキー、Apps Scriptの秘密値を埋め込みません。

## ローカル確認

```powershell
npm test
python -m http.server 4173
```

公開先: `https://stepkobetsu-hub.github.io/step-workspace/`
