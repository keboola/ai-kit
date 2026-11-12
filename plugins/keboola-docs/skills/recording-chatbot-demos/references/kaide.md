# KAiDE (Agnes): the Northvale packaging demo

The first run of this skill, on 2026-10-15. Seven prompts from the "packaging account manager act"
guide (Cuesta's script, Northvale Medical, persona Angelica Baker, Packaging South). Config:
`../examples/kaide.json`, prompts: `../examples/kaide-account-manager-prompts.json`.

## App facts

- Login at `/login`. **`/` always shows the landing page**, so open `/chat`. Session cookie
  `access_token` on `.kaide.agnes-fleet.keboola.systems`, 30 days, but revoked by "Switch account".
- New chat: `/chat`. After the first Send the URL becomes `/chat?session=<uuid>`.
- Selectors: composer `#chat-input` (a textarea; Enter sends), Send `button.cloud-chat-send-btn`,
  chat list `nav.rail .cloud-chat-list-link`. While the assistant works, a **Stop** button sits
  in the composer.
- The answer arrives in bursts: "Show N steps" and "Thinking…" lines first, then the text.
- Questions 3, 4 and 6 lean on earlier answers. In new chats the assistant still answered them right
  ("the top ones" → the top lookalikes; 6 of 35, $6.04M).
- Measured waits: 20–60 s per answer, question 6 (spec sheet and quote) 2.5–3 min. It writes two
  files to the chat's Files panel.
- Guide artifact `.../p/5OglwC8uUYNkg7tQjICOabAc` is shared with the Admin group, and Angelica gets
  "You need access". Ask the person to paste the prompts.
- The demo account has a daily AI spend cap. One run of all seven costs a few dollars, and three
  full runs on 2026-10-15 went through.

## What was delivered

- 7 clips, a new chat each, 34–60 s, 1920×1200, plus the 7 joined (5:51).
- One chat with all 7, the same pacing, 4:34, the current chat visible in the sidebar.
