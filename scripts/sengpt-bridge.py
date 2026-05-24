#!/usr/bin/env python3

import asyncio
import json
import sys

CHATGPT_BASE_URL = "https://chatgpt.com"
AUTH_SESSION_URL = f"{CHATGPT_BASE_URL}/api/auth/session"
BACKEND_API_URL = f"{CHATGPT_BASE_URL}/backend-api/{{}}"
WS_REGISTER_URL = f"{CHATGPT_BASE_URL}/backend-api/register-websocket"


def emit(payload):
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def read_request():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def compose_prompt(prompt, style_prompt, is_new_conversation):
    if not is_new_conversation or not style_prompt:
        return prompt

    return (
        f"{style_prompt}\n\n"
        "Respond in plain terminal-friendly Markdown when helpful.\n\n"
        f"User message:\n{prompt}"
    )


def build_cookie_header(request):
    chunk0 = request.get("sessionTokenChunk0", "").strip()
    chunk1 = request.get("sessionTokenChunk1", "").strip()
    session_token = request.get("sessionToken", "").strip()
    extra_cookies = request.get("extraCookies", "").strip()

    cookies = []

    if chunk0 and chunk1:
        cookies.append(f"__Secure-next-auth.session-token.0={chunk0}")
        cookies.append(f"__Secure-next-auth.session-token.1={chunk1}")
    elif session_token:
        cookies.append(f"__Secure-next-auth.session-token={session_token}")

    if extra_cookies:
        cleaned = extra_cookies.removeprefix("Cookie:").strip()
        if cleaned:
            cookies.append(cleaned)

    return "; ".join(cookies)


async def fetch_access_token(cookie_header):
    from curl_cffi.requests import AsyncSession

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/136.0.0.0 Safari/537.36"
        ),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": f"{CHATGPT_BASE_URL}/",
        "Origin": CHATGPT_BASE_URL,
        "Cookie": cookie_header,
    }

    async with AsyncSession(impersonate="chrome110", timeout=30) as session:
        response = await session.get(AUTH_SESSION_URL, headers=headers)

    data = response.json()
    access_token = data.get("accessToken")
    if not access_token:
        raise RuntimeError(
            "ChatGPT did not return an access token. "
            "Re-copy the cookie from chatgpt.com, and if it is split, use both .0 and .1 values."
        )

    return access_token


class ModernAsyncChatGPTMixin:
    def build_request_headers(self):
        headers = super().build_request_headers()
        headers["Origin"] = CHATGPT_BASE_URL
        headers["Alt-Used"] = "chatgpt.com"
        return headers


async def handle_chat(request):
    import sengpt.re_gpt.async_chatgpt as async_chatgpt_module

    from sengpt.re_gpt.async_chatgpt import AsyncChatGPT

    cookie_header = build_cookie_header(request)
    if not cookie_header:
        emit({"type": "error", "message": "Missing Sengpt session token."})
        return 1

    access_token = await fetch_access_token(cookie_header)

    async_chatgpt_module.CHATGPT_API = BACKEND_API_URL
    async_chatgpt_module.WS_REGISTER_URL = WS_REGISTER_URL

    class ModernAsyncChatGPT(ModernAsyncChatGPTMixin, AsyncChatGPT):
        pass


    conversation_id = request.get("conversationId") or None
    model = request.get("model", "gpt-3.5")
    prompt = compose_prompt(
        request.get("prompt", ""),
        request.get("stylePrompt", ""),
        request.get("isNewConversation", False),
    )

    async with ModernAsyncChatGPT(auth_token=access_token) as gpt:
        if conversation_id:
            conversation = gpt.get_conversation(conversation_id)
        else:
            conversation = gpt.create_new_conversation(model=model)

        full_response = ""
        async for event in conversation.chat(prompt):
            chunk = event.get("content", "")
            if not chunk:
                continue
            full_response += chunk
            emit({"type": "chunk", "content": chunk})

        emit(
            {
                "type": "done",
                "conversationId": conversation.conversation_id,
                "response": full_response,
            }
        )
    return 0


async def handle_reset(request):
    delete_remote = request.get("deleteRemote", False)
    conversation_id = request.get("conversationId") or None
    cookie_header = build_cookie_header(request)

    if delete_remote and conversation_id and cookie_header:
        import sengpt.re_gpt.async_chatgpt as async_chatgpt_module

        from sengpt.re_gpt.async_chatgpt import AsyncChatGPT

        access_token = await fetch_access_token(cookie_header)
        async_chatgpt_module.CHATGPT_API = BACKEND_API_URL
        async_chatgpt_module.WS_REGISTER_URL = WS_REGISTER_URL

        class ModernAsyncChatGPT(ModernAsyncChatGPTMixin, AsyncChatGPT):
            pass

        async with ModernAsyncChatGPT(auth_token=access_token) as gpt:
            await gpt.delete_conversation(conversation_id)

    emit({"type": "reset", "deleted": bool(delete_remote and conversation_id)})
    return 0


async def handle_doctor():
    try:
        import sengpt  # noqa: F401
        import websockets  # noqa: F401
    except Exception as error:
        emit({"type": "doctor", "ok": False, "message": str(error)})
        return 1

    emit({"type": "doctor", "ok": True})
    return 0


async def main():
    request = read_request()
    action = request.get("action", "chat")

    try:
        if action == "doctor":
            return await handle_doctor()
        if action == "reset":
            return await handle_reset(request)
        if action == "chat":
            return await handle_chat(request)
        emit({"type": "error", "message": f"Unknown action: {action}"})
        return 1
    except Exception as error:
        emit({"type": "error", "message": str(error)})
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
