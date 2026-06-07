"""Unit tests for the Unsiloed -> knowledge.json ingestion logic.

Covers the pure transform (`flatten_chunks`) and the id slugging, with no
network access or Unsiloed API key. The live parse + poll path is exercised
manually against real PDFs.
"""

from ingest import _slug, flatten_chunks


def _result(*chunks: dict) -> dict:
    return {"status": "Succeeded", "total_chunks": len(chunks), "chunks": list(chunks)}


def test_flatten_prefers_markdown_and_joins_segments():
    result = _result(
        {
            "segments": [
                {"markdown": "# Risk Factors", "segment_type": "Title", "page_number": 5},
                {"markdown": "Supply chain risk.", "segment_type": "Text", "page_number": 5},
            ]
        }
    )
    docs = flatten_chunks(result, source="acme-10k.pdf")

    assert len(docs) == 1
    doc = docs[0]
    assert doc["id"] == "acme-10k-c000"
    assert doc["text"] == "# Risk Factors\n\nSupply chain risk."
    assert doc["metadata"]["source"] == "acme-10k.pdf"
    assert doc["metadata"]["pages"] == "5"
    assert doc["metadata"]["segment_types"] == "Title,Text"


def test_flatten_falls_back_to_content_and_spans_pages():
    result = _result(
        {
            "segments": [
                {"content": "Row A | 12%", "segment_type": "Table", "page_number": 12},
                {"content": "Row B | 13%", "segment_type": "Table", "page_number": 13},
            ]
        }
    )
    docs = flatten_chunks(result, source="note.pdf")

    assert docs[0]["text"] == "Row A | 12%\n\nRow B | 13%"
    assert docs[0]["metadata"]["pages"] == "12-13"
    assert docs[0]["metadata"]["segment_types"] == "Table"


def test_flatten_drops_textless_chunks():
    result = _result(
        {"segments": [{"segment_type": "Picture", "page_number": 1, "image": "..."}]},
        {"segments": [{"markdown": "Real text.", "segment_type": "Text", "page_number": 2}]},
    )
    docs = flatten_chunks(result, source="doc.pdf")

    assert len(docs) == 1
    assert docs[0]["id"] == "doc-c001"  # index preserved; empty chunk skipped, not renumbered


def test_metadata_values_are_strings():
    # Moss requires string metadata values.
    result = _result(
        {"segments": [{"markdown": "x", "segment_type": "Text", "page_number": 3}]}
    )
    meta = flatten_chunks(result, source="d.pdf")[0]["metadata"]
    assert all(isinstance(v, str) for v in meta.values())


def test_slug():
    assert _slug("ACME Corp 10-K") == "acme-corp-10-k"
    assert _slug("acme-10k") == "acme-10k"
    assert _slug("!!!") == "doc"
