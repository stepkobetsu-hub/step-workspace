# STEP 業務ホーム

STEPで日常的に使う業務アプリを、検索・お気に入り・最近使ったアプリ・用途別分類から起動するランチャーです。

## 正本と認証

- アプリ詳細はスタッフ認証APIの `getSystemRegistry`、正式な登録一覧は `SYSTEM_REGISTRY.md` から機械生成した `workspace-apps.json` から取得してマージします。
- URLや正式名称をこのリポジトリへ複製していません。
- 認証は既存の `staffLogin`、`getSystemRegistry`、`logoutSystemPortal` を利用します。サーバー側で権限2・3・4を毎回確認します。
- GitHub Pagesへパスワード、APIキー、Apps Scriptの秘密値を埋め込みません。

## ローカル確認

```powershell
npm test
python -m http.server 4173
```

公開先: `https://stepkobetsu-hub.github.io/step-workspace/`
