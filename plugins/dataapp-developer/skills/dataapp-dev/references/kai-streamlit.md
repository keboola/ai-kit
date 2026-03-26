# Kai for Streamlit Apps

Patterns for embedding Kai AI Assistant into Streamlit data apps.

For architecture overview, credentials, and SSE event reference, see `references/kai-core.md`.

---

## Install

```bash
pip install kai-client python-dotenv
```

## Async Bridge

KaiClient is async. Streamlit is sync:

```python
import asyncio

def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
```

## Client Creation

**Always use `from_storage_api()`**:
```python
from kai_client import KaiClient
import os, streamlit as st

async def get_client():
    return await KaiClient.from_storage_api(
        storage_api_token=os.environ.get("KAI_TOKEN", "").strip() or os.environ.get("KBC_TOKEN") or st.secrets.get("KBC_TOKEN"),
        storage_api_url=os.environ.get("KBC_URL") or st.secrets.get("KBC_URL"),
    )
```

**Note:** Uses `KAI_TOKEN` with fallback to `KBC_TOKEN`, matching the backend pattern in `kai-core.md`.

## Streaming into Containers

```python
async def collect_chat_response(chat_id, text, container):
    accumulated = ""
    pending = None
    tool_names = {}
    text_placeholder = container.empty()
    status_placeholder = container.empty()
    client = await get_client()

    async with client:
        async for event in client.send_message(chat_id, text):
            if event.type == "text":
                accumulated += event.text
                text_placeholder.markdown(accumulated + "▌")
            elif event.type == "tool-input-start":
                # Tool started — show tool name
                call_id = getattr(event, "tool_call_id", "")
                name = getattr(event, "tool_name", None)
                if name:
                    tool_names[call_id] = name
                display_name = name or tool_names.get(call_id, "tool")
                status_placeholder.info(f"🔍 **{display_name}** starting...")
            elif event.type == "tool-input-available":
                # Full input ready
                call_id = getattr(event, "tool_call_id", "")
                name = getattr(event, "tool_name", None)
                if name:
                    tool_names[call_id] = name
                display_name = name or tool_names.get(call_id, "tool")
                status_placeholder.info(f"⚙️ Running **{display_name}**...")
            elif event.type == "tool-output-available":
                # Tool done
                call_id = getattr(event, "tool_call_id", "")
                display_name = tool_names.get(call_id, "tool")
                status_placeholder.success(f"✅ **{display_name}** completed.")
                text_placeholder = container.empty()
            elif event.type == "tool-approval-request":
                pending = {"approval_id": event.approval_id, "tool_call_id": event.tool_call_id}

    status_placeholder.empty()
    text_placeholder.markdown(accumulated)
    return accumulated, pending
```

## Add as a Tab

In `streamlit_app.py`, add an "AI Assistant" tab or page:

```python
# page_modules/assistant.py
import streamlit as st
from kai_client import KaiClient

def create_assistant_page():
    st.title("AI Assistant")

    if "kai_messages" not in st.session_state:
        st.session_state.kai_messages = []
    if "kai_chat_id" not in st.session_state:
        st.session_state.kai_chat_id = KaiClient.new_chat_id()

    for msg in st.session_state.kai_messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    prompt = st.chat_input("Ask Kai about your data...")
    if prompt:
        st.session_state.kai_messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            container = st.container()
            result, pending = run_async(
                collect_chat_response(st.session_state.kai_chat_id, prompt, container)
            )
        st.session_state.kai_messages.append({"role": "assistant", "content": result})
        st.rerun()
```
