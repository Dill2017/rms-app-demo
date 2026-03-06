from __future__ import annotations

import logging
import time
from typing import Any

from databricks.sdk import WorkspaceClient
from fastapi import HTTPException

from .core import Dependencies, create_router
from .models import GenieAskIn, GenieAskOut, GenieQueryResult

router = create_router()
logger = logging.getLogger(__name__)

GENIE_SPACE_ID = "01f1187b51271f3c809cd77fbc42e1a8"
_GENIE_PATH = f"/api/2.0/genie/spaces/{GENIE_SPACE_ID}"
_POLL_INTERVAL = 3
_MAX_POLLS = 40
_TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}


def _do_post(ws: WorkspaceClient, path: str, body: dict[str, Any]) -> dict[str, Any]:
    return ws.api_client.do("POST", f"{_GENIE_PATH}{path}", body=body)


def _do_get(ws: WorkspaceClient, path: str) -> dict[str, Any]:
    return ws.api_client.do("GET", f"{_GENIE_PATH}{path}")


def _poll_message(ws: WorkspaceClient, conversation_id: str, message_id: str) -> dict[str, Any]:
    path = f"/conversations/{conversation_id}/messages/{message_id}"
    for _ in range(_MAX_POLLS):
        msg = _do_get(ws, path)
        status = msg.get("status", "UNKNOWN")
        if status in _TERMINAL_STATUSES:
            return msg
        time.sleep(_POLL_INTERVAL)
    return _do_get(ws, path)


def _extract_response(msg: dict[str, Any]) -> GenieAskOut:
    text: str | None = None
    sql: str | None = None
    suggested_questions: list[str] | None = None
    error: str | None = None

    if msg.get("error"):
        err = msg["error"]
        error = err.get("message", str(err)) if isinstance(err, dict) else str(err)

    for att in msg.get("attachments", []):
        if att.get("text", {}).get("content"):
            text = att["text"]["content"]
        query = att.get("query", {})
        if query.get("query"):
            sql = query["query"]
            if query.get("description"):
                text = query["description"]
        sq = att.get("suggested_questions", {})
        if sq.get("questions"):
            suggested_questions = sq["questions"]

    status = msg.get("status", "UNKNOWN")
    message_id = msg.get("id") or msg.get("message_id") or "unknown"

    return GenieAskOut(
        conversation_id=msg.get("conversation_id", ""),
        message_id=message_id,
        status=status,
        text=text,
        sql=sql,
        query_result=None,
        suggested_questions=suggested_questions,
        error=error,
    )


def _fetch_query_result(
    ws: WorkspaceClient, conversation_id: str, message_id: str, msg: dict[str, Any]
) -> GenieQueryResult | None:
    has_query = any(att.get("query") for att in msg.get("attachments", []))
    if not has_query:
        return None

    try:
        path = f"/conversations/{conversation_id}/messages/{message_id}/query-result"
        res = _do_get(ws, path)
        stmt = res.get("statement_response", {})
        result = stmt.get("result")
        if not result:
            return None

        manifest = stmt.get("manifest", {})
        schema_cols = manifest.get("schema", {}).get("columns", [])
        columns: list[str] = [c.get("name", "") for c in schema_cols]

        data_array = result.get("data_array", [])
        rows: list[list[str | float | int | None]] = [list(row) for row in data_array]

        return GenieQueryResult(columns=columns, data=rows, row_count=len(rows))
    except Exception:
        logger.warning("Could not fetch query result", exc_info=True)
        return None


@router.post("/genie/ask", response_model=GenieAskOut, operation_id="askGenie")
def ask_genie(
    body: GenieAskIn,
    ws: Dependencies.Client,
):
    """Ask a natural language question to the Genie Space."""
    try:
        if body.conversation_id:
            initial = _do_post(
                ws,
                f"/conversations/{body.conversation_id}/messages",
                {"content": body.question},
            )
            conv_id = body.conversation_id
        else:
            initial = _do_post(ws, "/start-conversation", {"content": body.question})
            conv_id = initial["conversation_id"]

        message_id = initial["message_id"]
        msg = _poll_message(ws, conv_id, message_id)
        response = _extract_response(msg)

        if response.status == "COMPLETED" and response.sql:
            qr = _fetch_query_result(ws, conv_id, response.message_id, msg)
            if qr:
                response.query_result = qr

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Genie endpoint failed", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Genie error: {type(e).__name__}: {e}",
        ) from e
