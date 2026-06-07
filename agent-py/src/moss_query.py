"""Moss query bridge for the frontend chat.

The diligence-copilot chat (`frontend/app/api/chat`) runs a live semantic search of
the `knowledge` index per question. Moss's documented cloud query path
(`POST https://service.usemoss.dev/query`) is the frontend's first choice, but when
that service is unavailable the route shells out to this script, which uses the same
on-device path the live agent (`agent.py`) relies on — `MossClient.load_index` +
`query` — so retrieval keeps working.

Protocol (line-buffered JSON over stdio):
    stdin :  {"query": "...", "topK": 5, "index": "knowledge"}
    stdout:  {"docs": [{"id","text","metadata","score"}, ...]}   (or {"error": "..."})

Only the final JSON object is written to stdout; SDK/log chatter is redirected to
stderr so the caller can parse stdout cleanly.
"""

import asyncio
import json
import os
import sys

from dotenv import load_dotenv

AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()


async def main() -> None:
    try:
        req = json.loads(sys.stdin.read() or "{}")
    except Exception as e:
        _emit({"error": f"bad request json: {e}"})
        return

    query = (req.get("query") or "").strip()
    if not query:
        _emit({"docs": []})
        return
    top_k = int(req.get("topK") or 5)

    load_dotenv(os.path.join(AGENT_DIR, ".env.local"))
    index = req.get("index") or os.getenv("MOSS_INDEX_NAME", "knowledge")
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")
    if not project_id or not project_key:
        _emit({"error": "MOSS_PROJECT_ID / MOSS_PROJECT_KEY not set"})
        return

    # Keep stdout clean: route any SDK prints to stderr until we emit the result.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        from moss import (  # imported here so import logs hit stderr
            MossClient,
            QueryOptions,
        )

        client = MossClient(project_id, project_key)
        await client.load_index(index)
        result = await client.query(index, query, QueryOptions(top_k=top_k))
        docs = [
            {
                "id": getattr(d, "id", "") or "",
                "text": getattr(d, "text", "") or "",
                "metadata": getattr(d, "metadata", None),
                "score": float(getattr(d, "score", 0.0) or 0.0),
            }
            for d in (getattr(result, "docs", None) or [])
        ]
    except Exception as e:
        sys.stdout = real_stdout
        _emit({"error": f"moss query failed: {e}"})
        return
    finally:
        sys.stdout = real_stdout

    _emit({"docs": docs})


if __name__ == "__main__":
    asyncio.run(main())
