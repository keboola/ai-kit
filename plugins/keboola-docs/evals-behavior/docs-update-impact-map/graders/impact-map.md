---
type: llm
focus: last_message
---
PASS if the reply lists all three things the rename touches in src/content/docs/guide/clean-howto.md: the sentence with **Open App**, the image alt text "The header with the Open App button", and the screenshot public/guide/open-app.png that needs a reshoot; and it asks for approval before editing.
FAIL if any of the three is missing, or if the reply says the files were already changed.
