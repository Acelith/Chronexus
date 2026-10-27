# Privacy and data

## What stays on your computer

Everything, by default: campaigns, notes, sheets, images, dice history, assistant
conversations, settings. No account, no telemetry, no analytics.

## What can leave it — and when

| Request | When | What is sent |
| --- | --- | --- |
| Update check | At launch (can be turned off) and when you check manually | Nothing personal; it reads the public release channel |
| Rules wiki / SRD | Only when you search or open an entry | The term or entry you asked for |
| AI components | Only when you press install | Nothing personal; downloads from official sources |
| Your Chronexus Server | Only for campaigns you linked, items you chose | The items you chose, your account credentials |

Nothing is ever sent to an AI service on the internet: the optional assistant runs on
your computer.

## Where the data lives

In the operating system's application-data folder, under `it.nodex.desktop` (the name
comes from Chronexus's earlier name and is kept so existing archives keep working).
Backups go where you choose; automatic ones go to `Documents/Chronexus`.

Do not put the live database in a cloud-synced folder; use backups instead. Backups are
not encrypted.
