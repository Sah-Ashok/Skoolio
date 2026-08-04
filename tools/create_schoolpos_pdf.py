from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    NextPageTemplate,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT = OUT_DIR / "school-pos-school-overview.pdf"
LOGO = ROOT / "frontend" / "public" / "Logo.png"


PAGE_W, PAGE_H = A4
MARGIN_X = 17 * mm
MARGIN_TOP = 16 * mm
MARGIN_BOTTOM = 15 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

NAVY = colors.HexColor("#21313C")
TEAL = colors.HexColor("#159A91")
ORANGE = colors.HexColor("#F08A3C")
BLUE = colors.HexColor("#3E6EA8")
MUTED = colors.HexColor("#5E6B75")
LIGHT = colors.HexColor("#F4F7F8")
LINE = colors.HexColor("#DCE5E8")
GREEN_BG = colors.HexColor("#E8F6F2")
ORANGE_BG = colors.HexColor("#FFF0E4")
BLUE_BG = colors.HexColor("#EAF1FA")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=34,
        leading=38,
        textColor=NAVY,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="CoverSub",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=13,
        leading=19,
        textColor=MUTED,
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        name="H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=24,
        textColor=NAVY,
        spaceBefore=8,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=NAVY,
        spaceBefore=8,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.6,
        leading=14,
        textColor=colors.HexColor("#2F3B44"),
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11,
        textColor=MUTED,
    )
)
styles.add(
    ParagraphStyle(
        name="Callout",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=10.2,
        leading=14,
        textColor=NAVY,
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        name="TableHead",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=8.6,
        leading=11,
        textColor=colors.white,
    )
)
styles.add(
    ParagraphStyle(
        name="TableBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11,
        textColor=colors.HexColor("#2F3B44"),
    )
)


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def bullet_list(items):
    return ListFlowable(
        [ListItem(p(item), leftIndent=10, bulletColor=TEAL) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=14,
        bulletFontName="Helvetica",
        bulletFontSize=6,
    )


def section(title, body=None, bullets=None):
    story = [p(title, "H2")]
    if body:
        story.append(p(body))
    if bullets:
        story.append(bullet_list(bullets))
    return KeepTogether(story)


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN_X, PAGE_H - 12 * mm, PAGE_W - MARGIN_X, PAGE_H - 12 * mm)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(NAVY)
    canvas.drawString(MARGIN_X, PAGE_H - 9 * mm, "SchoolPOS")
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 9 * mm, "School management overview")
    canvas.line(MARGIN_X, 11 * mm, PAGE_W - MARGIN_X, 11 * mm)
    canvas.drawString(MARGIN_X, 7 * mm, "Prepared for schools")
    canvas.drawRightString(PAGE_W - MARGIN_X, 7 * mm, f"Page {doc.page}")
    canvas.restoreState()


def cover_canvas(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#F7FAFA"))
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, PAGE_H - 22 * mm, PAGE_W, 22 * mm, fill=1, stroke=0)
    canvas.setFillColor(ORANGE)
    canvas.rect(0, 0, PAGE_W, 12 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor("#D6E4E5"))
    canvas.setLineWidth(1)
    canvas.roundRect(18 * mm, 35 * mm, PAGE_W - 36 * mm, PAGE_H - 76 * mm, 8 * mm, stroke=1, fill=0)
    canvas.restoreState()


def feature_table(rows, col_widths=None):
    data = [[p("Area", "TableHead"), p("What the school can do", "TableHead"), p("Why it matters", "TableHead")]]
    for area, action, value in rows:
        data.append([p(area, "TableBody"), p(action, "TableBody"), p(value, "TableBody")])
    table = Table(data, colWidths=col_widths or [40 * mm, 70 * mm, 65 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFCFC")]),
            ]
        )
    )
    return table


def callout_grid(items):
    cards = []
    for title, text, bg in items:
        cards.append([p(f"<b>{title}</b><br/>{text}", "TableBody")])
    table = Table([cards], colWidths=[CONTENT_W / len(items)] * len(items))
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), GREEN_BG),
                ("BACKGROUND", (1, 0), (1, 0), BLUE_BG),
                ("BACKGROUND", (2, 0), (2, 0), ORANGE_BG),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.white),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return table


def build():
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=MARGIN_X,
        leftMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
    )
    frame = Frame(MARGIN_X, MARGIN_BOTTOM, CONTENT_W, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM, id="normal")
    doc.addPageTemplates(
        [
            PageTemplate(id="Cover", frames=[frame], onPage=cover_canvas),
            PageTemplate(id="Body", frames=[frame], onPage=header_footer),
        ]
    )

    story = []
    story.append(Spacer(1, 38 * mm))
    if LOGO.exists():
        story.append(Image(str(LOGO), width=34 * mm, height=34 * mm, kind="proportional", hAlign="CENTER"))
        story.append(Spacer(1, 8 * mm))
    story.append(p("SchoolPOS", "CoverTitle"))
    story.append(p("A complete school management and point-of-service platform", "CoverSub"))
    story.append(Spacer(1, 10 * mm))
    story.append(
        Table(
            [[p("Built to help schools manage admissions, classes, attendance, fees, exams, notices, staff work, transport, hostel records and daily reporting from one organized system.", "Callout")]],
            colWidths=[CONTENT_W - 22 * mm],
            hAlign="CENTER",
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                    ("LEFTPADDING", (0, 0), (-1, -1), 14),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                    ("TOPPADDING", (0, 0), (-1, -1), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ]
            ),
        )
    )
    story.append(Spacer(1, 45 * mm))
    story.append(p("Prepared as a school-facing app overview", "Small"))
    story.append(NextPageTemplate("Body"))
    story.append(PageBreak())

    story.append(p("1. What SchoolPOS Does", "H1"))
    story.append(
        p(
            "SchoolPOS brings the main school office, teachers and students into one connected system. It keeps student records, academic years, classes, sections, fees, attendance, exams, notices and operational records organized so the school can reduce manual registers and repeated data entry."
        )
    )
    story.append(
        callout_grid(
            [
                ("For the office", "Central records, fee collection, receipts, reports and daily administration.", GREEN_BG),
                ("For teachers", "Class lists, attendance, student detail, marks entry and notice access.", BLUE_BG),
                ("For students", "Personal dashboard, fees, results, attendance, calendar and notices.", ORANGE_BG),
            ]
        )
    )
    story.append(Spacer(1, 7))
    story.append(
        p(
            "The app is structured around role-based portals, so each person sees the tools relevant to their work. School data is kept separated by school, and academic-year filtering helps reports stay accurate across sessions."
        )
    )

    story.append(p("2. Main Features Included", "H1"))
    story.append(
        feature_table(
            [
                ("Student records", "Add students, maintain profiles, upload photos, record guardian details, scholarship information and enrollment history.", "Keeps student information searchable, updated and linked to class, fee, attendance and exam records."),
                ("Academic setup", "Create academic years, classes, sections, subjects and teacher-subject assignments.", "Gives the school a structured foundation for attendance, exams, promotions and reporting."),
                ("Teacher management", "Manage teacher profiles, assignments and section responsibilities.", "Helps the school know who teaches what and which teacher coordinates each section."),
                ("Attendance", "Teachers mark class attendance; students and office staff can view summaries and monthly records.", "Improves daily tracking and gives families clearer visibility into attendance."),
                ("Fees and receipts", "Create fee structures, collect payments, view student fee history and generate downloadable receipts.", "Supports faster fee collection, cleaner records and easier follow-up on dues."),
                ("Exams and results", "Create exams, schedule subjects, enter marks, calculate grades and publish student results.", "Connects assessment planning, marks entry and result viewing in one flow."),
                ("Calendar", "Maintain school events, holidays, exam days and attendance-affecting days.", "Keeps working days and school events consistent across portals."),
                ("Notice board", "Publish school-wide or section-specific notices with expiry dates.", "Keeps communication organized and visible to the right people."),
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("3. Operations and Finance Features", "H1"))
    story.append(
        feature_table(
            [
                ("Transport", "Manage vehicles, routes, stops, student assignments and route-based fee billing.", "Makes bus/route administration easier and links transport charges to student records."),
                ("Hostel", "Manage hostel buildings, rooms, assignments and occupancy.", "Helps schools track boarding facilities and student accommodation."),
                ("Staff records", "Maintain non-teaching staff records and attendance.", "Keeps the broader school workforce organized beyond only teaching staff."),
                ("Salary", "Record salary payments, deductions, payment methods and payroll policy.", "Provides a clearer monthly salary workflow for teachers and staff."),
                ("Expenses", "Track school expenses by category and view summaries.", "Gives the school a simple view of operational spending."),
                ("Payment requests", "Students can submit payment information for office verification through supported payment workflows.", "Reduces confusion around pending fee payments and gives staff a verification queue."),
                ("Receipts", "Fee payments can create receipt records and PDF receipts.", "Improves parent communication and preserves payment proof."),
                ("History log", "Important create, update and delete actions are recorded.", "Helps the school review changes and maintain accountability."),
            ]
        )
    )

    story.append(Spacer(1, 7))
    story.append(
        section(
            "Office Benefits",
            bullets=[
                "One place to view student profiles, fee status, attendance, service assignments and academic history.",
                "Cleaner academic-year management for classes, enrollments, exams and fee structures.",
                "Less paperwork for receipts, notices, fee records and student promotion.",
                "Better visibility into daily operations such as expenses, transport, hostel and staff salary.",
            ],
        )
    )

    story.append(p("4. Teacher Portal", "H1"))
    story.append(
        p(
            "The teacher portal focuses on classroom work. Teachers can see their dashboard, students, assigned sections, attendance pages, profile information, salary records, results pages and notice board."
        )
    )
    story.append(
        bullet_list(
            [
                "Section-aware dashboard with class and student context.",
                "Attendance marking for assigned sections, including student-level records.",
                "Student detail pages with attendance overview and academic information.",
                "Exam result entry connected to assigned subjects and schedules.",
                "Notice board access for school and section communication.",
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("5. Student Portal", "H1"))
    story.append(
        p(
            "The student portal gives each student a simple place to check personal school information. It includes a dashboard, attendance, fees, results, profile, calendar, notices and payment-related pages."
        )
    )
    story.append(
        bullet_list(
            [
                "Personal dashboard with quick attendance, fee and notice information.",
                "Attendance summaries and monthly attendance records.",
                "Fee collections, payment history and downloadable receipts.",
                "Exam results and academic performance records.",
                "Calendar and notice access so students can stay updated.",
            ]
        )
    )

    story.append(p("6. School Office Portal", "H1"))
    story.append(
        p(
            "The school office portal is the main control area for day-to-day administration. It covers students, teachers, classes, sections, subjects, fees, attendance views, exams, notices, calendar, salary, staff, expenses, transport, hostel and settings."
        )
    )
    story.append(
        bullet_list(
            [
                "Manage admissions, enrollments, profiles and promotions.",
                "Set up academic years, classes, sections and subjects.",
                "Collect fees, review payment requests, maintain bank/payment settings and issue receipts.",
                "Review attendance information and student histories.",
                "Coordinate exams, schedules, marks and results.",
                "Track notices, calendar events, expenses, payroll and facility assignments.",
            ]
        )
    )

    story.append(p("7. Reliability, Access and Deployment", "H1"))
    story.append(
        feature_table(
            [
                ("Role-based access", "Different portals and permissions for office users, teachers and students.", "Users only work with the information meant for their role."),
                ("School data separation", "Records are scoped by school and academic year where needed.", "Protects one school's data from mixing with another school's records."),
                ("Cloud-ready stack", "Next.js frontend, Node/Express backend, PostgreSQL database, Redis and Docker support.", "The system can be hosted as a modern web application."),
                ("File support", "Profile images and generated receipts can be stored through cloud storage.", "Useful for student photos, teacher photos and receipt delivery."),
                ("Offline awareness", "The frontend includes connection status handling.", "Users get clearer feedback when connectivity is unstable."),
                ("Audit trail", "Important data changes can be logged through the history module.", "Supports accountability for school records."),
            ],
            col_widths=[42 * mm, 72 * mm, 61 * mm],
        )
    )

    story.append(Spacer(1, 8))
    story.append(
        Table(
            [[p("<b>In short:</b> SchoolPOS is designed to help a school run academic, fee, attendance and operational workflows in one connected application, while giving teachers and students their own focused portals.", "Callout")]],
            colWidths=[CONTENT_W],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), GREEN_BG),
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#B9DCD6")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            ),
        )
    )
    story.append(Spacer(1, 8))
    story.append(p("Source basis: project files and documentation available in the SchoolPOS workspace.", "Small"))

    doc.build(story)


if __name__ == "__main__":
    build()
    print(OUTPUT)
