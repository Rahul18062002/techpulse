# TechPulse

Watches Hacker News, arXiv and GitHub Releases, keeps only what matches each user's interests (viaSocket AI),
and delivers plain-language updates to Slack, Discord, Gmail or Outlook through viaSocket. No Slack/Discord/email
OAuth, bot token or API key lives in this product.

```bash
npm install
npm start            # http://localhost:3000 : onboarding, settings, feed; polls every 20 min, digests at 9:00
npm test             # dedup + instant/digest decision tests (no network)
npm run verify -- gmail   # real end-to-end run as viaSocket's test user (also: slack_dm, slack_channel, discord_channel, discord_dm, outlook)
```

Behind an HTTP proxy (`HTTPS_PROXY` set), Node's built-in `fetch` ignores it unless started with
`NODE_USE_ENV_PROXY=1` (e.g. `NODE_USE_ENV_PROXY=1 npm start` in bash). Without a proxy, nothing extra is needed.

## Layout

| path | what |
| --- | --- |
| `config/interests.json` | interest tags, followable companies, safe defaults |
| `config/sources.json` | which sources are polled and their settings |
| `config/channels.json` | delivery channels: app slug, viaSocket action id + version, what the user picks |
| `config/engine.json` | thresholds and timing (never shown in the UI) |
| `src/sources/*` | one poller per source, same output shape; add a file + a config entry for a new source |
| `src/dedup.js` | cross-source event clustering (runs before relevance) |
| `src/relevance.js` | keyword prefilter + viaSocket AI scoring/summary (JSON schema) |
| `src/pipeline.js` | poll → dedup → relevance → instant or digest |
| `src/delivery.js` | viaSocket enable + runAction, PICK options |
| `src/format.js` | Slack / Discord / email message bodies |
| `server.js`, `public/` | API and the onboarding/settings/feed UI |

## Where each viaSocket value comes from

**Who connects:** the end user, with the Connect button (app icon) per app; `auth_id` stored per user and app;
an expired one shows "Reconnect" and is renewed in place with the same `auth_id`. Only the four delivery apps can be
connected: `/api/viasocket/token` refuses any other slug and `/api/viasocket/connected` only stores a connection
that belongs to this user and one of those apps (the API equivalent of `filteredServices`).

**Who picks the action:** the developer in code, from the channel the user chose (`config/channels.json`).

| channel | action | user picks on screen | product / AI per message | constant (why) | left out on purpose |
| --- | --- | --- | --- | --- | --- |
| Slack DM | Send Message `row1jrbor` V107 | `destination.userId` (PICK) | `markdown_content` | `destination.messageto`="user" (this channel *is* a DM); `bot_details.bot_name`="TechPulse"; `preview` unfurl off (digests stay compact) | thread keys, `tagged_users`, `buttons`, scheduling |
| Slack channel | same | `destination.channel_id` (PICK) | `markdown_content` | `messageto`="channel"; bot name; unfurl off | same |
| Discord channel | Send Message on Channel `rowprvu04wpv` V6 | `channel_id` (PICK) | `message_content` (split under 2000 chars) | `mention_everyone`=false, `tts`=false (never ping/read aloud news), `bot_name` | `bot_icon`, embeds |
| Discord DM | Send Direct Message `rowyxuu48lac` V2 | `user_id` (PICK) | `message_content` | `mention_everyone`=false, `tts`=false | — |
| Gmail | Send Email `rowogelpy0h6` V55 | `to` (their address) | `subject`, `messageBody` (HTML) | `fromName`="TechPulse" | `from` (sends as the connected account), cc/bcc/replyTo/attachments/labelIds |
| Outlook | Send Email `row5ok7mvcs9` V8 | `to_recipients` | `subject`, `body` (HTML), `importance` (High for instant, Normal for digest) | — | cc/bcc, custom headers |

**Where it runs:** every viaSocket call is on the server; the browser only holds the embed token for the Connect popup.
AI calls (`user.ai.send`) run on the server per user with a `json_schema` answer.
