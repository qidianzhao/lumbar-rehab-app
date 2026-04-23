"""数据导出接口 —— 生成用户训练数据 PDF 报告。

当前实现：服务端动态组装纯文本内容，通过 fpdf2 生成 PDF 并以 Data URL 返回，
无需对象存储，前端直接用 expo-file-system 写本地文件后调用 expo-sharing 分享。
"""
from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.assessment import Assessment
from app.models.checkin import Checkin
from app.models.health_profile import HealthProfile
from app.models.training import PainLog, TrainingSession
from app.schemas.common import APIResponse
from app.schemas.export import ExportPdfRequest, ExportPdfResponse

router = APIRouter()


def _build_pdf_text(sections: dict) -> bytes:
    """生成 PDF，优先用 fpdf2，不可用时用内置方式生成带内容的 PDF。"""
    try:
        from fpdf import FPDF  # type: ignore[import-untyped]

        class PDF(FPDF):
            def header(self):
                self.set_font("Helvetica", "B", 14)
                self.cell(0, 10, "LDH Training Report", align="C", new_x="LMARGIN", new_y="NEXT")
                self.ln(2)

            def section(self, title: str, lines: list[str]):
                self.set_font("Helvetica", "B", 11)
                self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
                self.set_font("Helvetica", size=10)
                for line in lines:
                    safe = line.encode("latin-1", errors="replace").decode("latin-1")
                    self.multi_cell(0, 6, safe)
                self.ln(3)

        pdf = PDF()
        pdf.add_page()
        for title, lines in sections.items():
            pdf.section(title, lines)
        return bytes(pdf.output())

    except ImportError:
        return _build_pdf_plain(sections)


def _build_pdf_plain(sections: dict) -> bytes:
    """用纯 Python 构建带文字内容的 PDF（不依赖第三方库）。"""
    lines_all: list[str] = ["LDH Training Report", ""]
    for title, lines in sections.items():
        lines_all.append(f"== {title} ==")
        lines_all.extend(lines)
        lines_all.append("")

    # 构建 PDF 文本流
    def pdf_str(s: str) -> str:
        return s.encode("ascii", errors="replace").decode("ascii")

    objects: list[bytes] = []
    offsets: list[int] = []

    def add_obj(content: bytes) -> int:
        idx = len(objects) + 1
        objects.append(content)
        return idx

    # obj 1: catalog (placeholder, filled after pages)
    # obj 2: pages (placeholder)
    # obj 3: font
    font_obj = b"<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>"
    add_obj(font_obj)  # obj 1 = font

    # Build page content stream
    stream_lines: list[str] = []
    stream_lines.append("BT")
    stream_lines.append("/F1 12 Tf")
    y = 780
    for line in lines_all:
        safe = pdf_str(line)[:90]
        stream_lines.append(f"10 {y} Td")
        stream_lines.append(f"({safe}) Tj")
        stream_lines.append(f"-10 -{y} Td")
        y -= 16
        if y < 40:
            break
    stream_lines.append("ET")
    stream_bytes = "\n".join(stream_lines).encode("ascii")

    content_stream = (
        f"<</Length {len(stream_bytes)}>>\nstream\n".encode("ascii")
        + stream_bytes
        + b"\nendstream"
    )
    add_obj(content_stream)  # obj 2 = content stream

    # obj 3: page
    page_obj = b"<</Type /Page /Parent 4 0 R /MediaBox [0 0 595 842] /Contents 2 0 R /Resources <</Font <</F1 1 0 R>>>>>>"
    add_obj(page_obj)  # obj 3 = page

    # obj 4: pages
    pages_obj = b"<</Type /Pages /Kids [3 0 R] /Count 1>>"
    add_obj(pages_obj)  # obj 4 = pages

    # obj 5: catalog
    catalog_obj = b"<</Type /Catalog /Pages 4 0 R>>"
    add_obj(catalog_obj)  # obj 5 = catalog

    # Assemble PDF
    body = b"%PDF-1.4\n"
    xref_offsets: list[int] = []
    for obj_content in objects:
        xref_offsets.append(len(body))
        idx = len(xref_offsets)
        body += f"{idx} 0 obj\n".encode() + obj_content + b"\nendobj\n"

    xref_pos = len(body)
    xref = f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for off in xref_offsets:
        xref += f"{off:010d} 00000 n \n".encode()

    trailer = f"trailer\n<</Size {len(objects) + 1} /Root 5 0 R>>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    return body + xref + trailer


@router.post("/pdf", response_model=APIResponse[ExportPdfResponse])
async def export_pdf(
    body: ExportPdfRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[ExportPdfResponse]:
    user_id = int(current_user["id"])
    sections: dict[str, list[str]] = {}

    # ── 运动档案 ────────────────────────────────────────────
    if "health_profile" in body.include_sections:
        hp = await db.scalar(select(HealthProfile).where(HealthProfile.user_id == user_id))
        lines = []
        if hp:
            lines = [
                f"Height: {hp.height or '-'} cm",
                f"Weight: {hp.weight or '-'} kg",
                f"Disc segments: {', '.join(hp.disc_segments or []) or '-'}",
                f"Severity: {hp.disc_severity or '-'}",
                f"Other conditions: {', '.join(hp.other_conditions or []) or '-'}",
                f"Daily sitting: {hp.daily_sitting_hours or '-'}",
                f"Exercise habit: {hp.exercise_habit or '-'}",
            ]
        else:
            lines = ["No health profile on record."]
        sections["Health Profile"] = lines

    # ── 训练统计 ────────────────────────────────────────────
    if "training_stats" in body.include_sections:
        sessions = (
            await db.execute(
                select(TrainingSession).where(
                    TrainingSession.user_id == user_id,
                    TrainingSession.started_at >= datetime.combine(body.start_date, datetime.min.time()),
                    TrainingSession.started_at <= datetime.combine(body.end_date, datetime.max.time()),
                    TrainingSession.status == "completed",
                )
            )
        ).scalars().all()

        total_sec = sum(s.duration_seconds or 0 for s in sessions)
        avg_rate = (
            sum(s.completion_rate or 0 for s in sessions) / len(sessions) if sessions else 0
        )
        lines = [
            f"Period: {body.start_date} ~ {body.end_date}",
            f"Total sessions: {len(sessions)}",
            f"Total duration: {total_sec // 60} min",
            f"Avg completion rate: {avg_rate:.1f}%",
        ]
        sections["Training Stats"] = lines

    # ── 疼痛记录 ────────────────────────────────────────────
    if "pain_records" in body.include_sections:
        pain_rows = (
            await db.execute(
                select(PainLog).where(
                    PainLog.user_id == user_id,
                    PainLog.created_at >= datetime.combine(body.start_date, datetime.min.time()),
                    PainLog.created_at <= datetime.combine(body.end_date, datetime.max.time()),
                ).order_by(PainLog.created_at)
            )
        ).scalars().all()

        lines = []
        for p in pain_rows:
            lines.append(
                f"{p.created_at.date()}  region={p.body_region}  level={p.pain_level}"
                + (f"  note={p.description}" if p.description else "")
            )
        sections["Pain Records"] = lines or ["No pain records in this period."]

    # ── 体能测试结果 ────────────────────────────────────────
    if "assessment_results" in body.include_sections:
        asmts = (
            await db.execute(
                select(Assessment).where(
                    Assessment.user_id == user_id,
                    Assessment.created_at >= datetime.combine(body.start_date, datetime.min.time()),
                    Assessment.created_at <= datetime.combine(body.end_date, datetime.max.time()),
                ).order_by(Assessment.created_at)
            )
        ).scalars().all()

        lines = []
        for a in asmts:
            lines.append(f"{a.created_at.date()}  level={a.overall_level}")
            for k, v in (a.scores or {}).items():
                lines.append(f"  {k}: {v}")
        sections["Assessment Results"] = lines or ["No assessments in this period."]

    # ── 生成 PDF ────────────────────────────────────────────
    pdf_bytes = _build_pdf_text(sections)

    import base64
    b64 = base64.b64encode(pdf_bytes).decode("ascii")
    data_url = f"data:application/pdf;base64,{b64}"

    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    return APIResponse(
        code=0,
        message="ok",
        data=ExportPdfResponse(pdf_url=data_url, expires_at=expires_at),
    )
