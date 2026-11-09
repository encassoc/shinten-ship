# shinten-ship

**The shipping desk for shinten: open sealed addresses where labels are made, and nowhere else.**

A store that seals delivery addresses with [shinten](https://github.com/eucassoc/shinten)
keeps only the postal code and an envelope per order. Someone still has
to print the label. shinten-ship is that someone's tool: it runs on the
shipping desk's own device, opens each order's envelope with the desk's
private key, and writes the import file the carrier's label software
already accepts. The address exists in the clear on that device, for as
long as the import file does, and then it is gone.

[日本語](README.ja.md)

- Reads an order export (order id, postal code, envelope, and the plain
  fields a label needs: item, count, dates, time slot, cool) as JSON,
  JSON Lines or CSV.
- Writes the label-import CSV for Yamato B2 Cloud (基本レイアウト, 97
  columns, positional) and Japan Post ゆうパックプリントR (named columns
  for a one-to-one filter); more carriers are a column map each. No
  carrier API, no account, no change on the carrier's side.
- Purges the import file after upload and records what was made and what
  was purged, by digest, so that an evidence log can carry it later.
- A CLI for the desk, and an MCP server for the agent that runs it.

The desk's private key never leaves the device. A store with several
desks, or an outsourced warehouse, is just several recipients on the
envelope. Keep a backup key offline: an envelope sealed to a lost key
alone cannot be opened by anyone.

## Setup

```sh
npm install -g shinten-ship
shinten keygen > desk.json          # from shinten; publish the public half as a recipient of the store's forms
```

`ship.json` holds the sender and the carrier accounts:

```json
{
  "sender": { "name": "株式会社テスト商店", "postalCode": "100-0001", "address": "東京都千代田区千代田1-1", "building": "テストビル3F", "phone": "03-1234-5678" },
  "yamato": { "customerCode": "123456789", "fareCode": "01" },
  "japanpost": { "mailType": "0" }
}
```

For Yamato, `customerCode` is the ご請求先顧客コード and `fareCode` the
運賃管理番号 from your B2 Cloud contract; add `classCode` when the billing
code has a 3-digit class.

## Orders

An order export is what the store already has: the clear fields and the
envelope, plus what the label says. Any of these forms:

```json
[{ "id": "A-1", "postalCode": "150-0001", "envelope": { "...": "the stored shinten envelope" },
   "item": "雑貨", "count": 1, "deliveryDate": "2026-04-03", "timeSlot": "14-16", "cool": "chilled" }]
```

```csv
order_id,zip,shinten,item,count
A-1,150-0001,"{""protected"":""...""}",雑貨,1
```

Time slots: `am`, `12-14`, `14-16`, `16-18`, `18-20`, `19-21`, `20-21`
(each carrier accepts its own subset). `cool`: `chilled` or `frozen`.

## Labels

```sh
shinten-ship labels --carrier yamato-b2 -k desk.json -c ship.json -o labels.csv orders.json
# upload labels.csv in B2 Cloud (基本レイアウト, start at row 2), print, then:
shinten-ship purge labels.csv
```

An order whose envelope does not open on this desk, or whose details do
not fit the carrier's fields (an address over 64 bytes for Yamato, a time
slot the carrier does not offer), is left out and reported; the rest are
written. Files are CP932, CRLF, as the carriers' software reads them.

Records go to `~/.shinten-ship/records.jsonl` (or `SHINTEN_SHIP_RECORDS`):
the digest of each label file, the orders in it by id and envelope digest,
and each purge. No address is ever in a record.

## MCP

```json
{ "mcpServers": { "shinten-ship": { "command": "shinten-ship-mcp",
  "env": { "SHINTEN_KEY": "/path/to/desk.json", "SHINTEN_SHIP_CONFIG": "/path/to/ship.json" } } } }
```

| Tool | Does |
|---|---|
| `carriers` | The formats this desk writes, and how each carrier's software reads the file |
| `make_labels` | Open the orders' envelopes and write the label file to a path |
| `purge` | Delete a label file after upload, recording its digest |

## Carrier formats

| Carrier | Format | Source |
|---|---|---|
| Yamato B2 Cloud | 送り状発行データレイアウト 入出力用, 97 items, positional, header on row 1, import from row 2 | Yamato's layout document (bmypage.kuronekoyamato.co.jp) |
| Japan Post ゆうパックプリントR | Columns named as the software's fields; the user defines a filter once (フィルタ設定, 簡易編集) | 日本郵便 フィルタ設定説明書 (2026-05-27) and the 発送予定データ layout |

Carrier formats change on the carriers' schedule; a format is one file
under `src/carriers/`.

## Development

```sh
npm install
npm test
```

## License

Apache-2.0
