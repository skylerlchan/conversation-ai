"""Parse PDFs with Unsiloed and feed the chunks into the Moss knowledge corpus.

This is the build-time ingestion step for the diligence copilot. It takes the
real documents you want the agent to ground on (an equity research note, a
company 10-K, a paper) and turns them into RAG-ready chunks:

    PDF  ──[Unsiloed Parse API]──►  chunks  ──►  knowledge.json  ──►  pnpm moss:index  ──►  Moss `knowledge` index

It does NOT touch Moss directly. It only produces ``knowledge.json`` (the same
file ``create_index.py`` reads). After running this, push the corpus into Moss
with ``pnpm moss:index``.

Usage (from the repo root):

    # one file
    uv --directory agent-py run src/ingest.py corpus/pdfs/acme-10k.pdf

    # a whole folder, replacing the starter LiveKit-docs corpus
    uv --directory agent-py run src/ingest.py corpus/pdfs --replace

    # then index into Moss
    pnpm moss:index

Requires ``UNSILOED_API_KEY`` in ``agent-py/.env.local``.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Resolve paths relative to this file so the script works from any CWD.
# ``src/ingest.py`` -> parent.parent == agent-py/.
AGENT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = AGENT_DIR / ".env.local"
KNOWLEDGE_PATH = AGENT_DIR / "knowledge.json"
PDF_DIR = AGENT_DIR / "corpus" / "pdfs"
PARSED_DIR = AGENT_DIR / "corpus" / "parsed"

load_dotenv(ENV_PATH)

PARSE_URL = "https://prod.visionapi.unsiloed.ai/parse"

# Finance docs are table-heavy (10-Ks, models), so default to high-resolution
# layout detection and table merging. `agentic_ocr=advanced` is load-bearing:
# without it Unsiloed's OCR scrambles the reading order of normal single-column
# prose (sentence-ending words get bumped to the next line); the advanced pass
# fixes it at no extra credit cost. Verified against the demo memo fixture.
PARSE_OPTIONS = {
    "use_high_resolution": "true",
    "layout_analysis": "smart_layout_detection",
    "merge_tables": "true",
    "agentic_ocr": "advanced",
}

POLL_INTERVAL_S = 3
POLL_TIMEOUT_S = 600


def _slug(name: str) -> str:
    """A filesystem/id-safe slug from a filename stem."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "doc"


def parse_pdf(pdf_path: Path, api_key: str, *, use_cache: bool = True) -> dict:
    """Submit one PDF to Unsiloed and poll until the parse job succeeds.

    Caches the raw Unsiloed result under ``corpus/parsed/<slug>.json`` so
    re-runs don't re-spend parse credits. Returns the final result dict.
    """
    cache_path = PARSED_DIR / f"{_slug(pdf_path.stem)}.json"
    if use_cache and cache_path.exists():
        print(f"  cache hit: {cache_path.relative_to(AGENT_DIR)}")
        return json.loads(cache_path.read_text(encoding="utf-8"))

    headers = {"api-key": api_key}
    with httpx.Client(timeout=120) as client:
        resp = client.post(
            PARSE_URL,
            headers=headers,
            files={"file": (pdf_path.name, pdf_path.read_bytes(), "application/pdf")},
            data=PARSE_OPTIONS,
        )
        resp.raise_for_status()
        job = resp.json()
        job_id = job.get("job_id")
        if not job_id:
            raise RuntimeError(f"Unsiloed did not return a job_id: {job}")
        print(f"  job {job_id} started (status: {job.get('status')})")

        deadline = time.monotonic() + POLL_TIMEOUT_S
        while True:
            status_resp = client.get(f"{PARSE_URL}/{job_id}", headers=headers)
            status_resp.raise_for_status()
            result = status_resp.json()
            status = result.get("status")
            if status == "Succeeded":
                break
            if status in {"Failed", "Error"}:
                raise RuntimeError(f"Unsiloed parse failed: {result}")
            if time.monotonic() > deadline:
                raise TimeoutError(
                    f"Unsiloed job {job_id} did not finish within {POLL_TIMEOUT_S}s"
                )
            time.sleep(POLL_INTERVAL_S)

    PARSED_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"  parsed: {result.get('total_chunks')} chunks -> {cache_path.relative_to(AGENT_DIR)}")
    return result


def flatten_chunks(result: dict, source: str) -> list[dict]:
    """Turn one Unsiloed parse result into knowledge.json document entries.

    Indexes at the chunk level: each Unsiloed chunk (a coherent group of
    segments) becomes one retrievable document, preferring each segment's
    markdown rendering so tables survive. Chunks with no text are dropped.
    Metadata values are strings (a Moss constraint).
    """
    slug = _slug(Path(source).stem)
    docs: list[dict] = []

    for i, chunk in enumerate(result.get("chunks", [])):
        segments = chunk.get("segments", []) or []
        parts: list[str] = []
        pages: set[int] = set()
        types: list[str] = []
        for seg in segments:
            text = (seg.get("markdown") or seg.get("content") or "").strip()
            if text:
                parts.append(text)
            page = seg.get("page_number")
            if isinstance(page, int):
                pages.add(page)
            seg_type = seg.get("segment_type")
            if seg_type and seg_type not in types:
                types.append(seg_type)

        body = "\n\n".join(parts).strip()
        if not body:
            continue

        sorted_pages = sorted(pages)
        if not sorted_pages:
            page_label = ""
        elif sorted_pages[0] == sorted_pages[-1]:
            page_label = str(sorted_pages[0])
        else:
            page_label = f"{sorted_pages[0]}-{sorted_pages[-1]}"

        docs.append(
            {
                "id": f"{slug}-c{i:03d}",
                "text": body,
                "metadata": {
                    "source": source,
                    "pages": page_label,
                    "segment_types": ",".join(types),
                },
            }
        )

    return docs


def merge_into_knowledge(new_docs: list[dict], *, replace: bool) -> int:
    """Write new_docs into knowledge.json, replacing or merging by id.

    Returns the total document count in the resulting file.
    """
    existing: list[dict] = []
    if not replace and KNOWLEDGE_PATH.exists():
        existing = json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8"))

    by_id = {d["id"]: d for d in existing if isinstance(d, dict) and d.get("id")}
    for doc in new_docs:
        by_id[doc["id"]] = doc

    merged = list(by_id.values())
    KNOWLEDGE_PATH.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return len(merged)


def _collect_pdfs(target: Path) -> list[Path]:
    if target.is_dir():
        return sorted(p for p in target.glob("*.pdf"))
    if target.is_file() and target.suffix.lower() == ".pdf":
        return [target]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "input",
        nargs="?",
        default=str(PDF_DIR),
        help="A PDF file or a directory of PDFs (default: corpus/pdfs/).",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Overwrite knowledge.json instead of merging into it.",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Re-parse even if a cached Unsiloed result exists.",
    )
    args = parser.parse_args()

    api_key = os.getenv("UNSILOED_API_KEY")
    if not api_key:
        print(
            "Missing UNSILOED_API_KEY. Add it to agent-py/.env.local "
            "(get a key from the Unsiloed dashboard).",
            file=sys.stderr,
        )
        return 1

    target = Path(args.input)
    if not target.is_absolute():
        target = (AGENT_DIR / target).resolve()

    pdfs = _collect_pdfs(target)
    if not pdfs:
        print(
            f"No PDFs found at {target}. Drop your research note / 10-K into "
            f"{PDF_DIR.relative_to(AGENT_DIR)}/ and try again.",
            file=sys.stderr,
        )
        return 1

    all_docs: list[dict] = []
    for pdf in pdfs:
        print(f"Parsing {pdf.name} ...")
        result = parse_pdf(pdf, api_key, use_cache=not args.no_cache)
        docs = flatten_chunks(result, source=pdf.name)
        print(f"  -> {len(docs)} knowledge chunks")
        all_docs.extend(docs)

    total = merge_into_knowledge(all_docs, replace=args.replace)
    print(
        f"\nWrote {len(all_docs)} new chunks; {total} total docs in "
        f"{KNOWLEDGE_PATH.relative_to(AGENT_DIR)}."
    )
    print("Next: run `pnpm moss:index` to push the corpus into Moss.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
