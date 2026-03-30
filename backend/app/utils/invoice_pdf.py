"""
Bilingual Arabic / English invoice generator for DrFahm school payments.

Dependencies (already in requirements.txt):
    reportlab==4.2.2
    arabic-reshaper==3.0.0
    python-bidi==0.4.2

Usage:
    from app.utils.invoice_pdf import generate_school_invoice_pdf
    pdf_bytes = generate_school_invoice_pdf(invoice_data)

All company details are in COMPANY_CONFIG below — update before launch.
Logo: set LOGO_PATH to the absolute path of your PNG file when ready.
"""

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

import arabic_reshaper
from bidi.algorithm import get_display


# ── Company config — UPDATE BEFORE LAUNCH ────────────────────────────────────

COMPANY_CONFIG = {
    # Logo — set to absolute path of PNG when ready; None = text header
    "logo_path":       None,

    "name_en":         "DrFahm",
    "name_ar":         "د.فهم",

    # Address — update with real details
    "address_en":      "London, United Kingdom",
    "address_ar":      "لندن، المملكة المتحدة",

    # VAT — leave empty string if not registered
    "vat_number":      "",

    # Billing contact
    "email":           "billing@drfahm.com",
    "website":         "www.drfahm.com",
}

# ── Exam display names ────────────────────────────────────────────────────────

EXAM_NAMES = {
    "qudurat": {"en": "Qudurat", "ar": "قدرات"},
    "tahsili": {"en": "Tahsili", "ar": "تحصيلي"},
}

PLAN_TIER_NAMES = {
    "standard": {"en": "Standard",  "ar": "معياري"},
    "volume":   {"en": "Volume",    "ar": "مجموعة"},
}

# ── Colours ───────────────────────────────────────────────────────────────────

VIOLET      = colors.HexColor("#7c3aed")
VIOLET_LIGHT = colors.HexColor("#ede9fe")
GRAY_DARK   = colors.HexColor("#1e1b4b")
GRAY_MID    = colors.HexColor("#6b7280")
GRAY_LIGHT  = colors.HexColor("#f3f4f6")
WHITE       = colors.white
BLACK       = colors.black


# ── Arabic text helper ────────────────────────────────────────────────────────

def ar(text: str) -> str:
    """Reshape and apply BiDi algorithm to Arabic text for correct PDF rendering."""
    reshaped = arabic_reshaper.reshape(text)
    return get_display(reshaped)


# ── Font registration ─────────────────────────────────────────────────────────

def _register_fonts():
    """
    Register a Unicode-capable font that handles Arabic + Latin.
    reportlab ships with Helvetica (Latin only). For Arabic we need a TTF.

    In production on Railway, use a system font or bundle one in the repo.
    Fallback: if no Arabic font is found, Arabic text renders as boxes — Latin
    text is always correct.

    To bundle a font: drop a .ttf into backend/app/static/fonts/ and update
    ARABIC_FONT_PATH below.
    """
    import os

    # Try common system paths on Ubuntu (Railway uses Ubuntu)
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        # Bundled font path — add your own here
        os.path.join(os.path.dirname(__file__), "..", "static", "fonts", "NotoSansArabic-Regular.ttf"),
    ]

    for path in candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("Unicode", path))
                return "Unicode"
            except Exception:
                continue

    # Fallback — Latin only
    return "Helvetica"


# ── Main function ─────────────────────────────────────────────────────────────

def generate_school_invoice_pdf(invoice_data: dict) -> bytes:
    """
    Generate a bilingual Arabic/English school invoice PDF.

    invoice_data keys (all from /api/billing/admin/create-school-checkout response):
        invoice_number    str
        org_name          str
        exam              str    qudurat | tahsili
        plan_tier         str    standard | volume
        student_count     int
        price_per_student float  SAR
        total_sar         float
        expires_days      int    365
        generated_at      str    ISO datetime (optional)

    Returns bytes — write to response or save to disk.
    """
    font = _register_fonts()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    # ── Styles ──
    def style(name, font_name=font, size=10, color=BLACK, align="LEFT",
              bold=False, space_before=0, space_after=2):
        return ParagraphStyle(
            name,
            fontName=font_name + "-Bold" if bold and font_name == "Helvetica" else font_name,
            fontSize=size,
            textColor=color,
            alignment={"LEFT": 0, "CENTER": 1, "RIGHT": 2}.get(align, 0),
            spaceAfter=space_after,
            spaceBefore=space_before,
            leading=size * 1.4,
        )

    s_title     = style("title",     size=22, color=VIOLET,    bold=True, align="LEFT")
    s_subtitle  = style("subtitle",  size=11, color=GRAY_MID,  align="LEFT")
    s_ar_title  = style("ar_title",  size=18, color=VIOLET,    align="RIGHT")
    s_ar_sub    = style("ar_sub",    size=10, color=GRAY_MID,  align="RIGHT")
    s_label     = style("label",     size=8,  color=GRAY_MID)
    s_value     = style("value",     size=10, color=GRAY_DARK, bold=True)
    s_ar_label  = style("ar_label",  size=8,  color=GRAY_MID,  align="RIGHT")
    s_ar_value  = style("ar_value",  size=10, color=GRAY_DARK, align="RIGHT")
    s_th        = style("th",        size=9,  color=WHITE,     bold=True, align="CENTER")
    s_td        = style("td",        size=9,  color=GRAY_DARK, align="CENTER")
    s_total_en  = style("total_en",  size=12, color=VIOLET,    bold=True)
    s_total_ar  = style("total_ar",  size=12, color=VIOLET,    align="RIGHT")
    s_footer    = style("footer",    size=8,  color=GRAY_MID,  align="CENTER")
    s_note      = style("note",      size=8,  color=GRAY_MID)

    # ── Data prep ──
    inv_num      = invoice_data.get("invoice_number", "—")
    org_name     = invoice_data.get("org_name", "—")
    exam_key     = invoice_data.get("exam", "qudurat")
    tier_key     = invoice_data.get("plan_tier", "standard")
    count        = int(invoice_data.get("student_count", 0))
    price_each   = float(invoice_data.get("price_per_student", 0))
    total        = float(invoice_data.get("total_sar", 0))
    expires_days = int(invoice_data.get("expires_days", 365))

    now_str      = invoice_data.get("generated_at") or datetime.now(timezone.utc).strftime("%d %B %Y")
    exam_en      = EXAM_NAMES.get(exam_key, {}).get("en", exam_key.title())
    exam_ar      = EXAM_NAMES.get(exam_key, {}).get("ar", exam_key)
    tier_en      = PLAN_TIER_NAMES.get(tier_key, {}).get("en", tier_key.title())
    tier_ar      = PLAN_TIER_NAMES.get(tier_key, {}).get("ar", tier_key)

    product_desc_en = (
        f"DrFahm School Licence — {exam_en} ({tier_en})\n"
        f"All 5 worlds per track · {expires_days}-day access · {count} students"
    )
    product_desc_ar = ar(
        f"رخصة مدرسة د.فهم — {exam_ar} ({tier_ar})\n"
        f"جميع المستويات الخمسة · وصول لمدة {expires_days} يومًا · {count} طالب"
    )

    c = COMPANY_CONFIG
    elements = []
    W = 170 * mm  # usable width

    # ══════════════════════════════════════════════════════════════════════════
    # HEADER — company name both languages side by side
    # ══════════════════════════════════════════════════════════════════════════
    header_data = [[
        Paragraph(c["name_en"], s_title),
        Paragraph(ar(c["name_ar"]), s_ar_title),
    ]]
    header_table = Table(header_data, colWidths=[W * 0.5, W * 0.5])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(header_table)

    # Company sub-details
    sub_data = [[
        Paragraph(f"{c['address_en']}  |  {c['email']}  |  {c['website']}", s_subtitle),
        Paragraph(ar(f"{c['address_ar']}  |  {c['email']}"), s_ar_sub),
    ]]
    sub_table = Table(sub_data, colWidths=[W * 0.6, W * 0.4])
    sub_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(sub_table)

    if c.get("vat_number"):
        elements.append(Paragraph(f"VAT: {c['vat_number']}", s_note))

    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width=W, thickness=2, color=VIOLET))
    elements.append(Spacer(1, 4 * mm))

    # ══════════════════════════════════════════════════════════════════════════
    # INVOICE TITLE + NUMBER
    # ══════════════════════════════════════════════════════════════════════════
    title_data = [[
        Paragraph("TAX INVOICE / فاتورة ضريبية", style("inv_title", size=14, color=GRAY_DARK, bold=True)),
        Paragraph(f"#{inv_num}", style("inv_num", size=11, color=VIOLET, align="RIGHT")),
    ]]
    title_table = Table(title_data, colWidths=[W * 0.6, W * 0.4])
    title_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(title_table)
    elements.append(Spacer(1, 3 * mm))

    # ══════════════════════════════════════════════════════════════════════════
    # BILL TO + DATE BLOCK
    # ══════════════════════════════════════════════════════════════════════════
    bill_left = [
        [Paragraph("BILL TO / إلى", s_label),   Paragraph(ar("إلى / BILL TO"), s_ar_label)],
        [Paragraph(org_name, s_value),            Paragraph(ar(org_name), s_ar_value)],
        [Paragraph("", s_note),                   Paragraph("", s_note)],
        [Paragraph("DATE / التاريخ", s_label),    Paragraph(ar("التاريخ / DATE"), s_ar_label)],
        [Paragraph(now_str, s_value),              Paragraph(ar(now_str), s_ar_value)],
    ]
    bill_table = Table(bill_left, colWidths=[W * 0.5, W * 0.5])
    bill_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    elements.append(bill_table)
    elements.append(Spacer(1, 5 * mm))

    # ══════════════════════════════════════════════════════════════════════════
    # LINE ITEMS TABLE
    # ══════════════════════════════════════════════════════════════════════════
    col_w = [W * 0.40, W * 0.15, W * 0.20, W * 0.25]

    # Header row — bilingual
    thead = [[
        Paragraph("Description / الوصف", s_th),
        Paragraph("Qty / الكمية", s_th),
        Paragraph("Unit Price / السعر", s_th),
        Paragraph("Total / المجموع", s_th),
    ]]

    # Item rows — English + Arabic stacked in description cell
    item_desc = Paragraph(
        f"{product_desc_en}<br/><font color='#6b7280' size='8'>{product_desc_ar}</font>",
        style("item_desc", size=9, color=GRAY_DARK),
    )

    tbody = [[
        item_desc,
        Paragraph(str(count), s_td),
        Paragraph(f"SAR {price_each:,.2f}", s_td),
        Paragraph(f"SAR {count * price_each:,.2f}", s_td),
    ]]

    items_table = Table(thead + tbody, colWidths=col_w)
    items_table.setStyle(TableStyle([
        # Header
        ("BACKGROUND",    (0, 0), (-1, 0), VIOLET),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("TOPPADDING",    (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        # Body
        ("BACKGROUND",    (0, 1), (-1, -1), WHITE),
        ("TOPPADDING",    (0, 1), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # ══════════════════════════════════════════════════════════════════════════
    # TOTALS BLOCK
    # ══════════════════════════════════════════════════════════════════════════
    totals_data = [
        [
            Paragraph("Subtotal / المجموع الفرعي", s_label),
            Paragraph(f"SAR {total:,.2f}", style("sub_val", size=10, align="RIGHT")),
        ],
        [
            Paragraph("VAT / ضريبة القيمة المضافة", s_label),
            Paragraph("SAR 0.00", style("vat_val", size=10, color=GRAY_MID, align="RIGHT")),
        ],
        [
            Paragraph("TOTAL DUE / إجمالي المستحق", s_total_en),
            Paragraph(f"SAR {total:,.2f}", style("total_val", size=14, color=VIOLET, bold=True, align="RIGHT")),
        ],
    ]
    totals_table = Table(totals_data, colWidths=[W * 0.65, W * 0.35])
    totals_table.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEABOVE",     (0, 2), (-1, 2), 1.5, VIOLET),
        ("BACKGROUND",    (0, 2), (-1, 2), VIOLET_LIGHT),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))

    # Right-align the totals block
    outer = Table([[None, totals_table]], colWidths=[W * 0.35, W * 0.65])
    outer.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(outer)
    elements.append(Spacer(1, 6 * mm))

    # ══════════════════════════════════════════════════════════════════════════
    # PAYMENT NOTE
    # ══════════════════════════════════════════════════════════════════════════
    elements.append(HRFlowable(width=W, thickness=0.5, color=colors.HexColor("#e5e7eb")))
    elements.append(Spacer(1, 3 * mm))

    note_en = (
        "Payment was processed securely via Stripe. "
        "This invoice serves as an official receipt for your records."
    )
    note_ar = ar(
        "تمت معالجة الدفع بشكل آمن عبر Stripe. "
        "تُعدّ هذه الفاتورة إيصالاً رسمياً لسجلاتكم."
    )
    note_data = [[
        Paragraph(note_en, s_note),
        Paragraph(note_ar, style("note_ar", size=8, color=GRAY_MID, align="RIGHT")),
    ]]
    note_table = Table(note_data, colWidths=[W * 0.5, W * 0.5])
    note_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(note_table)

    elements.append(Spacer(1, 4 * mm))

    # ══════════════════════════════════════════════════════════════════════════
    # FOOTER
    # ══════════════════════════════════════════════════════════════════════════
    elements.append(HRFlowable(width=W, thickness=1, color=VIOLET))
    elements.append(Spacer(1, 2 * mm))
    elements.append(Paragraph(
        f"{c['name_en']} · {c['website']} · {c['email']}",
        s_footer,
    ))

    doc.build(elements)
    return buf.getvalue()
