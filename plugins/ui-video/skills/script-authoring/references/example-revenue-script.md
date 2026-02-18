# Example: Revenue Forecast Script

This annotated example shows the complete V9 revenue forecast video script.

## Story Arc

A finance analyst needs to forecast Q1 revenue before a board meeting. Kai:

1. Queries the sales pipeline and historical data
2. Presents a forecast with segment breakdown
3. Saves it as a reusable SQL transformation (with approval)
4. Adds it to the Revenue Analytics flow (with approval)

## Scene Constants

```ts
export const V8_FPS = 30;
export const V8_TOTAL_FRAMES = 1800; // 60 seconds

export const V8_SCENES = {
  // Scene 1: User Query (0-9s)
  userQuery: {
    start: 0,
    chatEnter: 15, // Chat panel animates in
    userTypingStart: 45, // Characters start appearing in input
    userTypingEnd: 200, // Input complete
    end: 270,
  },

  // Scene 2: Kai Queries Data & Shows Forecast (9-20s)
  kaiQueryAndForecast: {
    start: 270,
    thinkingStart: 275, // Thinking dots appear
    tool1Start: 285, // query_data: Sales Pipeline
    tool1Complete: 340,
    tool2Start: 350, // query_data: Historical Revenue
    tool2Complete: 410,
    assistantTypingStart: 420, // Forecast text starts
    forecastReveal: 450,
    end: 600,
  },

  // Scene 3: Suggested Action (20-26s)
  suggestedAction: {
    start: 600,
    buttonsAppear: 640, // Two action buttons fade in
    buttonClick: 720, // Cursor clicks first button
    buttonsExit: 750, // Unselected button fades out
    end: 780,
  },

  // Scene 4: Create Transformation (26-42s)
  createTransformation: {
    start: 780,
    chatSlideLeft: 790, // Chat slides left for editor
    editorEnter: 820, // SQL editor panel slides in from right
    tool3Start: 830, // create_sql_transformation (needs approval!)
    approvalButtonsAppear: 850,
    approvalClick: 920, // Cursor clicks Approve
    tool3Complete: 980,
    sqlTypingStart: 1000, // SQL appears in editor
    sqlTypingEnd: 1140,
    saveAnimation: 1160, // "SAVE" → "SAVED" button
    end: 1260,
  },

  // Scene 5: Add to Flow (42-48s)
  addToFlowPrompt: {
    start: 1260,
    editorExit: 1270, // Editor slides out
    chatSlideCenter: 1290, // Chat returns to center
    assistantTypingStart: 1300,
    buttonsAppear: 1340,
    buttonClick: 1400,
    end: 1440,
  },

  // Scene 6: Flow Update + Logo (48-60s)
  flowUpdateLogo: {
    start: 1440,
    chatSlideLeft: 1450,
    flowPanelEnter: 1480, // Flow builder slides in
    tool4Start: 1490, // modify_flow (needs approval!)
    approvalButtonsAppear: 1510,
    approvalClick: 1560,
    tool4Complete: 1590,
    newTransformationHighlight: 1600,
    toastAppear: 1620, // Success toast
    chatFadeOut: 1700,
    logoEnter: 1750,
    subtitleEnter: 1780,
    end: 1800,
  },
};
```

## Conversation Data

```ts
export const revenueNarrativeConversation: RevenueConversation = {
  messages: [
    // Scene 1: User types question, sends it
    {
      role: "user",
      text: "Can you forecast our Q1 revenue based on current pipeline and historical trends?",
      appearFrame: 220, // Appears AFTER inputSentFrame
      typewriter: false, // No typewriter — was typed in input
    },

    // Scene 2: Kai responds with tool calls + forecast
    {
      role: "assistant",
      text: "Based on your pipeline and historical data:\n\n**Forecasted Q1 Revenue: $5.2M** ...",
      appearFrame: 270,
      thinkingUntilFrame: 285, // Shows thinking dots first
      typewriter: true,
      typewriterStartFrame: 420, // Text appears AFTER tool calls complete
      toolCalls: [
        {
          tool: "query_data",
          params: { query_name: "Sales Pipeline" },
          state: "success",
          appearFrame: 285, // Read-only — no approval needed
          completeFrame: 340,
          resultSummary: "847 opportunities found",
        },
        {
          tool: "query_data",
          params: { query_name: "Historical Revenue" },
          state: "success",
          appearFrame: 350,
          completeFrame: 410,
          resultSummary: "12 quarters analyzed",
        },
      ],
      // Suggested actions appear after forecast text
      suggestedActions: [
        { text: "Save as reusable forecast transformation" },
        { text: "Break down by sales rep" },
      ],
      suggestedActionsAppearFrame: 640,
      suggestedActionClickFrame: 720,
      suggestedActionClickedIndex: 0, // First button clicked
    },

    // Scene 4: Write tool with approval flow
    {
      role: "assistant",
      text: "I can create this as a reusable SQL transformation for you.",
      appearFrame: 780,
      typewriter: true,
      typewriterStartFrame: 790,
      toolCalls: [
        {
          tool: "create_sql_transformation",
          params: { name: "Q1 Revenue Forecast", description: "..." },
          state: "success",
          appearFrame: 830,
          requiresConfirmation: true, // This triggers approval UI
          approvalButtonsAppearFrame: 850, // Approve/Decline buttons
          approvedFrame: 920, // User clicks Approve
          completeFrame: 980, // Tool finishes executing
          resultSummary: "Transformation created",
        },
      ],
    },

    // ... remaining messages follow the same pattern
  ],

  // Input field configuration
  inputStatus: "typing",
  inputTypingStartFrame: 45,
  inputSentFrame: 220,
  inputFullMessage:
    "Can you forecast our Q1 revenue based on current pipeline and historical trends?",
  inputCharsPerFrame: 1.5,
};
```

## Key Patterns to Note

1. **Input → Send → Bubble**: `inputTypingStartFrame: 45` → `inputSentFrame: 220` → message `appearFrame: 220`
2. **Tool call timing**: `appearFrame: 285` → `completeFrame: 340` (55 frames = ~1.8s)
3. **Approval flow**: `appearFrame: 830` → `approvalButtonsAppearFrame: 850` → `approvedFrame: 920` → `completeFrame: 980`
4. **Typewriter after tools**: `typewriterStartFrame: 420` starts after `tool2Complete: 410`
5. **Scene transitions**: `chatSlideLeft: 790` is 10 frames after scene start (780)
