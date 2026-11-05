---
title: Do two things with the guide
slug: 'guide/clean-howto'
description: 'Two self-contained recipes for the guide: set it up, then run it.'
---

Practical recipes for the guide. Each is self-contained: a goal, the steps, and what you get. For the ideas behind them see the [overview](/guide/).

<!-- How-to-type page. Fixture page used by check.test.mjs. -->

## Set the guide up

**Goal:** have a working guide in one minute.

1. Open the guide folder.
2. Run the setup command:

```bash
guide setup --yes
```

3. Wait for the prompt to return.

**Result:** `guide status` prints `ready`.

## Run the guide

**Goal:** run the guide once and read the output.

1. Run the command:

```bash
guide run
```

2. Read the summary line at the end.

**Result:** a summary with the row count and the time taken.

## Clean up afterwards

**Goal:** leave nothing behind.

1. Remove the working folder.
2. Confirm nothing is listed:

```bash
guide list
```

**Result:** the list is empty.

Some closing prose so the page sits inside the length band the rules describe,
without any of it changing what the recipes above say. The band is fifty to two
hundred and twenty lines, and a how-to with three recipes lands near the lower
edge of it, which is fine.

A second paragraph of closing prose, kept here only so that the fixture crosses
the lower edge of the band and the test for a clean page sees no warning about
length. Nothing in it is read by the checker beyond counting lines.

**Next:** [No description →](/guide/no-desc/)
