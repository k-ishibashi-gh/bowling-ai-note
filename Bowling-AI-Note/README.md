# ボウリング練習ノート

スマホでボウリング練習を記録し、ChatGPTに貼り付ける相談文を作るPWAです。

- サーバー不要
- ログイン不要
- OpenAI API不使用
- データは端末のブラウザ内に保存
- CSV / JSONでバックアップ・復元
- OCRライブラリはプロジェクト内に同梱

## ローカルでの起動方法

このアプリは静的ファイルだけで動きます。開発確認をするときだけ、同じフォルダで簡易表示サーバーを起動します。

```sh
python3 -m http.server 4173
```

ブラウザで次を開きます。

```text
http://127.0.0.1:4173/
```

ファイルを直接開くより、上の方法で確認するとPWA機能とService Workerを確認しやすくなります。

## GitHub Pagesでの公開方法

1. GitHubで新しいリポジトリを作ります。
2. このフォルダのファイルをリポジトリの一番上に置きます。
3. `index.html`、`manifest.json`、`service-worker.js`、`app.js`、`styles.css`、アイコン画像が同じ階層にあることを確認します。
4. GitHubのリポジトリ画面で `Settings` を開きます。
5. 左メニューの `Pages` を開きます。
6. `Build and deployment` の `Source` で `Deploy from a branch` を選びます。
7. Branchを `main`、フォルダを `/(root)` にして `Save` を押します。
8. 公開URLが表示されるまで数分待ちます。

参考:
- [GitHub Pagesサイト作成](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [GitHub Pagesの公開元設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [PWAのインストール要件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

## iPhoneでホーム画面に追加する方法

1. iPhoneで公開URLを開きます。
2. Safariで開くのがおすすめです。
3. 画面下の共有ボタンを押します。
4. `ホーム画面に追加` を押します。
5. 名前を確認して `追加` を押します。

ホーム画面のアイコンから開くと、アプリのように使えます。

## Androidでホーム画面に追加する方法

1. Androidで公開URLを開きます。
2. Chromeで開くのがおすすめです。
3. 画面に `インストール` が出た場合は押します。
4. 出ない場合は、Chromeのメニューから `ホーム画面に追加` または `アプリをインストール` を選びます。
5. 名前を確認して追加します。

## データバックアップの注意点

記録データはスマホ本体のブラウザ内に保存されます。GitHub PagesやGitHubには、練習記録は自動保存されません。

次の前には、必ず `バックアップ` 画面からJSONを書き出してください。

- スマホを機種変更する前
- ブラウザの履歴やサイトデータを削除する前
- GitHub PagesのURLを変える前
- 別のブラウザで使い始める前

復元にはJSONがおすすめです。CSVは表計算ソフトで見やすい形式ですが、ボール管理など一部の情報はJSONのほうが確実です。

バックアップファイルには練習内容やメモが入ります。公開リポジトリにはアップロードしないでください。

## 公開後に確認するチェックリスト

- 公開URLが `https://` で開ける
- ホーム画面の大きなボタンが表示される
- ピン入力が上から `7 8 9 10`、`4 5 6`、`2 3`、`1` の逆三角に見える
- 今日の記録を1件保存できる
- 履歴画面に保存した記録が出る
- AI相談文を作成してコピーできる
- 分析画面に平均スコアなどが出る
- JSONバックアップを書き出せる
- 書き出したJSONを復元できる
- iPhoneまたはAndroidのホーム画面に追加できる
- ホーム画面のアイコンから開ける
- 一度開いたあと、電波が弱い場所でも基本画面が表示される
- OCRを使う場合、画像を選んだあと確認画面を挟んで保存できる
- OCR使用時に開発者ツールの通信先が公開URLと同じドメインだけになっている

## メモ

OCRは `vendor/tesseract/` に同梱したTesseract.jsを使います。有料OCR APIやOpenAI APIは使いません。

スコアシート画像はブラウザ内の `canvas` で前処理され、同梱したTesseract.js workerで文字認識されます。画像やOCR結果を外部サーバーへ送る処理は入れていません。

初回OCR時は、GitHub Pages上に置いた同梱ファイルを読み込みます。読み込み元は公開URLと同じドメインです。

プライバシー確認ポイント:

- `index.html` は `./vendor/tesseract/tesseract.min.js` を読み込みます。
- `app.js` は `workerPath`、`corePath`、`langPath` をすべて `./vendor/tesseract/` 配下に固定しています。
- `index.html` のCSPで `connect-src 'self'` を指定し、外部への通信を制限しています。
- `service-worker.js` は公開URLと同じドメイン以外への取得を拒否します。
- OCR対象画像は `URL.createObjectURL` と `canvas` で処理され、外部送信用の `fetch`、`XMLHttpRequest`、`sendBeacon` は使っていません。
