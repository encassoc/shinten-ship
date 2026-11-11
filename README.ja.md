# shinten-ship

**shinten の出荷デスク。暗号化された住所を、送り状を作る場所でだけ復号する。**

[shinten](https://github.com/eucassoc/shinten) で配送先を暗号化している店舗は、
注文ごとに郵便番号と暗号文しか持ちません。それでも誰かが送り状を印字します。
shinten-ship はその誰かの道具です。出荷担当の端末で動き、各注文の暗号文を
その端末の秘密鍵で復号し、配送業者の送り状ソフトがそのまま受け付ける取込ファイルを
書きます。住所が平文で存在するのはその端末の上、取込ファイルがある間だけで、
その後は消えます。

[English](README.md)

- 注文のエクスポート(注文ID、郵便番号、暗号文、送り状に要る平文項目: 品名、個数、
  日付、時間帯、保冷)を JSON、JSON Lines、CSV で読みます。
- ヤマト運輸 B2クラウド(基本レイアウト、97項目、位置固定)と日本郵便
  ゆうパックプリントR(項目名付きの列。フィルタで一対一に対応付け)の取込 CSV を
  書きます。他の業者は列の対応表を一つ足すだけです。業者の API、アカウント、
  業者側の変更は不要です。
- アップロード後に取込ファイルを消し、作ったものと消したものをダイジェストで
  記録します。証跡ログに後から載せられる形です。
- デスク用の CLI と、デスクを動かすエージェント向けの MCP サーバー。

デスクの秘密鍵は端末から出ません。デスクが複数ある店舗や外部の倉庫は、暗号化の
宛先が増えるだけです。バックアップ鍵をオフラインに置いてください。失った鍵
だけで暗号化した内容は、誰にも復号できません。

## 準備

```sh
npm install -g shinten-ship
shinten keygen -o desk.json         # shinten の鍵。公開鍵を店舗のフォームの暗号化の宛先として公開する
```

`ship.json` に差出人と業者のアカウントを書きます。

```json
{
  "sender": { "name": "株式会社テスト商店", "postalCode": "100-0001", "address": "東京都千代田区千代田1-1", "building": "テストビル3F", "phone": "03-1234-5678" },
  "yamato": { "customerCode": "123456789", "fareCode": "01" },
  "japanpost": { "mailType": "0" },
  "recipients": { "keys": [ { "kty": "EC", "crv": "P-256", "...": "この発送窓口" }, { "kty": "EC", "crv": "P-256", "...": "控えの鍵" } ] }
}
```

`recipients` は、店舗のフォームが暗号化に使うはずの公開鍵を、この発送窓口が承認したものです。
他の鍵でも暗号化された注文や、これらの鍵が欠けた注文は、店舗のサイトの鍵一覧が
差し替えられたことを意味します。ラベルは一つも作られず、`labels` は STOP で終わります。
同じ鍵で `shinten watch -r` を定期的に店舗の鍵一覧に向けて実行すれば、注文が来る前に
差し替えを見つけられます。


ヤマトの `customerCode` は B2クラウド契約のご請求先顧客コード、`fareCode` は
運賃管理番号です。請求先コードに3桁の分類がある場合は `classCode` を足します。

## 注文

注文のエクスポートは、店舗が既に持っているもの(平文項目と暗号文)に、送り状に
書く内容を加えたものです。次のどの形でも読めます。

```json
[{ "id": "A-1", "postalCode": "150-0001", "envelope": { "...": "保存されている shinten の暗号文" },
   "item": "雑貨", "count": 1, "deliveryDate": "2026-04-03", "timeSlot": "14-16", "cool": "chilled" }]
```

```csv
order_id,zip,shinten,item,count
A-1,150-0001,"{""protected"":""...""}",雑貨,1
```

時間帯は `am`、`12-14`、`14-16`、`16-18`、`18-20`、`19-21`、`20-21`(業者ごとに
受け付ける範囲が違います)。`cool` は `chilled` か `frozen` です。

## 送り状

```sh
shinten-ship labels --carrier yamato-b2 -k desk.json -c ship.json -o labels.csv orders.json
# B2クラウドで labels.csv を取り込み(基本レイアウト、取込開始行 2)、印字したら
shinten-ship purge labels.csv
```

このデスクの鍵で復号できない暗号文や、業者の項目に収まらない注文(ヤマトで住所が64バイト
超、業者にない時間帯)は除外して報告し、残りを書き出します。ファイルは業者の
ソフトが読む CP932、CRLF です。

記録は `~/.shinten-ship/records.jsonl`(または `SHINTEN_SHIP_RECORDS`)に
追記されます。各ファイルのダイジェスト、含まれる注文の ID と暗号文のダイジェスト、
消去の事実です。住所が記録に入ることはありません。

## MCP

```json
{ "mcpServers": { "shinten-ship": { "command": "shinten-ship-mcp",
  "env": { "SHINTEN_KEY": "/path/to/desk.json", "SHINTEN_SHIP_CONFIG": "/path/to/ship.json" } } } }
```

| ツール | 内容 |
|---|---|
| `carriers` | このデスクが書ける形式と、各業者のソフトでの読み込み方 |
| `make_labels` | 注文の暗号文を復号し、送り状ファイルを指定パスに書く |
| `purge` | アップロード後に送り状ファイルを消し、ダイジェストを記録する |

## 業者の形式

| 業者 | 形式 | 出典 |
|---|---|---|
| ヤマト運輸 B2クラウド | 送り状発行データレイアウト 入出力用。97項目、位置固定、1行目は見出し、取込は2行目から | ヤマト運輸のレイアウト資料(bmypage.kuronekoyamato.co.jp) |
| 日本郵便 ゆうパックプリントR | ソフトの項目名を列名にした CSV。フィルタ設定(簡易編集)を一度作る | 日本郵便 フィルタ設定説明書(2026年5月27日)と発送予定データのレイアウト |

業者の形式は業者の都合で変わります。形式は `src/carriers/` の1ファイルです。

## 例

[shinten の web-shop の例](https://github.com/eucassoc/shinten/tree/main/examples/web-shop)
で、架空のネットショップの出荷担当の端末を動かせます。暗号化された注文からヤマト運輸
B2クラウドの取込ファイルを作り、印刷後に削除し、サイトが承認していない鍵を配っていた
ときには止まります。流れは[約2分の動画](https://github.com/eucassoc/shinten/blob/main/examples/web-shop/demo.mp4)で見られます。

受付から復号、削除までの各手順は [deedlog](https://github.com/eucassoc/deedlog) で記録し、
二つの連署サーバーが連署します。そのため、例を動かすには `dlog` コマンドが必要です
（Go が必要です）。

```sh
go install github.com/eucassoc/deedlog/cmd/dlog@latest

git clone https://github.com/eucassoc/shinten && cd shinten/examples/web-shop
npm install
npm start          # http://127.0.0.1:8800/
```

## 開発

```sh
npm install
npm test
```

## ライセンス

Apache-2.0
