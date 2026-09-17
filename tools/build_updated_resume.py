from pathlib import Path

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image as PdfImage,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_RENDER = ROOT / "tmp" / "resume_render_300" / "original-1.png"
PHOTO_PATH = ROOT / "tmp" / "resume_photo.png"
OUTPUT_PATH = Path(
    r"D:\旋风知识库\旋风的双端知识库\常紫棋的基本信息\常紫棋的简历_企业RAG项目更新版.pdf"
)


BLUE = colors.HexColor("#174E7A")
TEXT = colors.HexColor("#202833")
MUTED = colors.HexColor("#5F6B7A")
LIGHT_BLUE = colors.HexColor("#EAF2F8")
LINE = colors.HexColor("#174E7A")


def crop_photo() -> None:
    """Crop the original headshot from the rendered first page."""
    if PHOTO_PATH.exists():
        return
    image = Image.open(ORIGINAL_RENDER)
    width, height = image.size
    # Coordinates are ratios measured from the original PDF rendering.
    left = int(width * 0.792)
    top = int(height * 0.041)
    right = int(width * 0.925)
    bottom = int(height * 0.185)
    image.crop((left, top, right, bottom)).save(PHOTO_PATH)


def register_fonts() -> tuple[str, str]:
    """Register Windows Chinese fonts for reportlab."""
    normal = r"C:\Windows\Fonts\Deng.ttf"
    bold = r"C:\Windows\Fonts\Dengb.ttf"
    pdfmetrics.registerFont(TTFont("DengXian", normal))
    pdfmetrics.registerFont(TTFont("DengXian-Bold", bold))
    return "DengXian", "DengXian-Bold"


FONT, FONT_BOLD = register_fonts()


styles = {
    "name": ParagraphStyle(
        "name",
        fontName=FONT_BOLD,
        fontSize=22,
        leading=26,
        textColor=BLUE,
        spaceAfter=4,
    ),
    "header": ParagraphStyle(
        "header",
        fontName=FONT,
        fontSize=9.5,
        leading=14,
        textColor=TEXT,
    ),
    "summary": ParagraphStyle(
        "summary",
        fontName=FONT_BOLD,
        fontSize=9.3,
        leading=14,
        textColor=BLUE,
        backColor=colors.white,
        spaceBefore=4,
        spaceAfter=4,
    ),
    "section": ParagraphStyle(
        "section",
        fontName=FONT_BOLD,
        fontSize=13,
        leading=16,
        textColor=BLUE,
        spaceBefore=8,
        spaceAfter=5,
    ),
    "subhead": ParagraphStyle(
        "subhead",
        fontName=FONT_BOLD,
        fontSize=9.3,
        leading=12,
        textColor=BLUE,
        spaceBefore=2,
        spaceAfter=2,
    ),
    "body": ParagraphStyle(
        "body",
        fontName=FONT,
        fontSize=8.1,
        leading=12.2,
        textColor=TEXT,
        spaceAfter=2,
    ),
    "body_bold": ParagraphStyle(
        "body_bold",
        fontName=FONT_BOLD,
        fontSize=8.1,
        leading=12.2,
        textColor=TEXT,
        spaceAfter=2,
    ),
    "small": ParagraphStyle(
        "small",
        fontName=FONT,
        fontSize=7.2,
        leading=10,
        textColor=MUTED,
    ),
}


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, styles[style])


def section(title: str) -> list:
    return [
        Paragraph(title, styles["section"]),
        Table([[""]], colWidths=[180 * mm], rowHeights=[0.7], style=[
            ("BACKGROUND", (0, 0), (-1, -1), LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]),
        Spacer(1, 3),
    ]


def bullet(text: str) -> Paragraph:
    return p(f"- {text}", "body")


def skill_item(title: str, content: str) -> Paragraph:
    return p(f"<b>{title}：</b>{content}", "body")


def footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont(FONT, 7)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(
        A4[0] / 2,
        9 * mm,
        f"正式投递版简历 | AI Agent / RAG / 商业分析方向 | 第 {doc.page} 页",
    )
    canvas.restoreState()


def two_col(left_items: list, right_items: list, widths=(88 * mm, 88 * mm)) -> Table:
    table = Table([[left_items, right_items]], colWidths=list(widths), hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def build_story() -> list:
    crop_photo()
    story: list = []

    header_left = [
        Paragraph("常紫棋", styles["name"]),
        p("2027 届本科 | 燕山大学 | 电子信息工程", "header"),
        p("电话：17832324668 | 邮箱：3160630389@qq.com | 籍贯：河北省望都县", "header"),
        p(
            "求职方向：AI 解决方案实习生 / 售前技术支持实习生 / 解决方案工程师实习生 / AI 产品助理",
            "header",
        ),
        p(
            "GitHub：github.com/Evolve-Gem | 核心项目：企业知识库 RAG / 售前 Agent 工作流平台、《吃什么呢》校园饮食推荐小程序",
            "header",
        ),
    ]
    photo = PdfImage(str(PHOTO_PATH), width=27 * mm, height=37 * mm)
    header = Table([[header_left, photo]], colWidths=[145 * mm, 30 * mm])
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header)
    story.append(
        p(
            "个人定位：电子信息工程背景，关注 AI Agent、RAG 知识库与业务工作流落地；具备 Python、Streamlit、DeepSeek API、AI 辅助开发和项目展示能力，能将业务资料整理、需求理解、报告生成和可解释 AI 工具结合起来。",
            "summary",
        )
    )

    story.extend(section("教育背景 / 证书认证"))
    edu = [
        p("<b>燕山大学 | 电子信息工程 | 本科 | 2023.09 - 2027.06</b>", "body"),
        bullet("绩点排名：前 30%；CET-4：581，具备英文技术文档阅读能力。"),
        bullet("主修课程：通信原理、信号与系统、计算机网络、模拟电子技术、数字电子技术、嵌入式/单片机基础等。"),
    ]
    cert = [
        p("<b>证书认证</b>", "body_bold"),
        bullet("PCEP - Certified Entry-Level Python Programmer | Pass，88% | 2026.04。"),
        bullet("CAIE 一级注册人工智能工程师 | 已通过，具备人工智能基础知识与 AI 应用落地意识。"),
        bullet("大学英语四级证书 | CET-4 581 分，可阅读英文认证材料、开发者文档与技术资料。"),
    ]
    story.append(two_col(edu, cert))

    story.extend(section("技能专长"))
    skills_left = [
        skill_item("编程与开发", "Python、Flask、Streamlit、SQLite、Tkinter、C++、Git/GitHub、文件 IO、面向对象编程。"),
        skill_item("产品与项目", "需求分析、功能规划、接口联调、云端部署、README 编写、截图整理、演示视频录制、方案生成。"),
        skill_item("电子与硬件", "Multisim、Verilog/VHDL 基础、嵌入式开发板、串口通信、基础电路仿真。"),
    ]
    skills_right = [
        skill_item("AI 工具与 RAG", "ChatGPT、Codex、Claude Code、DeepSeek API、Prompt 设计、RAG 知识库问答、Agent / Skill / Tool 工作流、Trace 可解释展示。"),
        skill_item("数据与可视化", "NumPy、Pandas、Matplotlib、MATLAB、数字信号处理基础。"),
        skill_item("沟通表达", "公开宣讲、社团管理、跨部门协调、自媒体内容策划、技术内容通俗化表达。"),
    ]
    story.append(two_col(skills_left, skills_right))

    story.extend(section("项目经历"))
    rag_project = [
        p("<b>企业知识库 RAG 智能助手 / 售前 Agent 工作流平台（2026.05 - 2026.08）</b>", "subhead"),
        p("Python + Streamlit + FastAPI + DeepSeek API + Markdown/TXT 知识库 + Agent / Skill / Tool 调度 | 项目负责人 / 核心开发者", "body"),
        bullet("项目定位：面向企业资料问答、客户需求分析、售前方案生成与知识库管理场景，构建一体化 AI 工作台；用户可输入问题、客户需求或项目分析任务，系统自动识别意图、选择 Skill 并展示执行 Trace。"),
        bullet("知识库能力：支持 .md、.txt、.pdf 文档列表、上传、预览、编辑、删除和索引重建；运行时对 Markdown / TXT 资料读取并切分为 chunks，PDF 当前作为文件管理对象展示。"),
        bullet("RAG 问答：基于关键词与中文短语匹配召回相关 chunks，展示来源文档、匹配分数和内容预览，并调用 DeepSeek API 基于检索片段生成结构化回答。"),
        bullet("售前方案：围绕客户需求完成需求解析、方案参考资料检索和售前方案初稿生成，输出客户背景、核心痛点、推荐方案、功能模块、实施步骤、预期价值和参考资料来源。"),
        bullet("Agent 工作台：支持自动判断与手动模式选择，覆盖知识库问答、售前方案、知识库缺口分析、Agent 优化等任务；Trace 展示接收任务、识别意图、选择 Skill、调用 Tool 和生成结果。"),
        bullet("工程实现：使用 Streamlit 搭建前端工作台，FastAPI 提供健康检查接口；rag/ 负责读取、切分、检索与生成链路，kb_tools.py 封装文件管理，agent_core.py 维护 Agent / Skill / Tool 调度，API Key 通过 .env 管理。"),
        p("<b>项目成果：</b>形成具备知识库管理、RAG 问答、售前方案生成、Agent 调度、可解释 Trace 和 Markdown 导出的轻量 AI 应用原型，体现 RAG 基础链路、ToB 资料治理、售前方案理解和工程化拆分能力。", "body"),
    ]
    story.extend(rag_project)
    story.append(PageBreak())

    food_project = [
        p("<b>《吃什么呢》校园饮食推荐小程序 | AI 增强版（2026.04）</b>", "subhead"),
        p("微信小程序原生开发 + Python Flask + DeepSeek API + Railway + GitHub | 项目负责人 / 核心开发者", "body"),
        bullet("项目定位：面向大学校园“每天不知道吃什么”的高频生活场景，围绕口味偏好、心情状态、时间要求设计校园饮食推荐流程，提供轻量化选餐建议。"),
        bullet("产品设计：从校园选餐痛点出发，设计规则推荐与 AI 推荐两条路径，明确用户从进入小程序、填写需求到获得推荐结果的完整流程。"),
        bullet("小程序实现：负责首页、规则推荐页、AI 输入页、AI 推荐结果页等核心页面开发，完成用户输入、结果展示、菜品图片匹配和交互路径优化。"),
        bullet("后端与 AI 接入：基于 Python Flask 搭建推荐接口，将小程序端输入传给后端，并接入 DeepSeek API 生成自然语言饮食推荐结果，使项目从规则推荐升级为 AI 增强 Demo。"),
        bullet("部署与展示：将后端服务部署至 Railway，完善 GitHub README、项目截图和约 1 分钟演示视频，形成“需求分析 - 开发联调 - 云端部署 - 展示复盘”的完整项目闭环。"),
        bullet("项目价值：该项目证明了从生活痛点到产品原型、从基础推荐到 AI 增强、从本地开发到云端展示的完整执行能力。"),
    ]
    story.extend(food_project)

    student_project = [
        p("<b>补充项目：Python 学籍管理系统 | Python + SQLite + Tkinter | 独立完成系统设计与编码</b>", "subhead"),
        bullet("实现学生学籍信息增删改查、数据批量导入导出、权限校验与图形化交互界面；通过 SQLite 实现本地数据持久化。"),
    ]
    story.extend(student_project)

    story.extend(section("实践经历 / 内容表达"))
    practice_left = [
        p("<b>自媒体运营与 AI 内容创作 | 个人账号累计播放量 70W+，总点赞量 2800+</b>", "body_bold"),
        bullet("持续输出大学生成长、学习方法与技术科普类内容，具备选题策划、脚本撰写、视频剪辑和数据反馈意识。"),
        bullet("熟练运用 AI 工具辅助脚本生成、素材整理、标题优化和剪辑构思，提升内容生产效率，并积累面向学生群体的用户理解。"),
    ]
    practice_right = [
        p("<b>校园组织与公开表达经历</b>", "body_bold"),
        bullet("大学生英语之声社团部长：带领 20+ 名成员策划英语晨读、四六级备考讲座、英文演讲比赛等活动，累计覆盖师生 500+ 人次。"),
        bullet("电子信息工程 2 班学习委员：定期整理并推送竞赛、保研、就业等信息 20+ 期，提升班级信息共享效率。"),
        bullet("寒假母校行宣讲：作为燕山大学宣讲团成员，面向 300+ 名高三学生介绍学校专业优势、校园生活与升学路径。"),
    ]
    story.append(two_col(practice_left, practice_right))

    story.extend(section("获奖荣誉"))
    awards_left = [
        p("<b>学科竞赛 / 学业奖项</b>", "body_bold"),
        bullet("2025 年 第 22 届全国大学生信息安全与对抗技术竞赛 二等奖（国家级）。"),
        bullet("2024 年 国家励志奖学金；2023 - 2025 年连续四次获得校级三等奖学金。"),
    ]
    awards_right = [
        p("<b>综合荣誉 / 执行力</b>", "body_bold"),
        bullet("校级“优秀学生干部”、校级“优秀实践个人”。"),
        bullet("2025 年秦皇岛半程马拉松完赛，成绩 2:11:13，体现长期训练、执行力与抗压能力。"),
    ]
    story.append(two_col(awards_left, awards_right))

    story.extend(section("个人描述"))
    story.append(
        p(
            "我是一名电子信息工程专业本科生，重点关注 AI 应用、RAG 知识库、Agent 工作流和业务场景落地。相比单纯技术路线，我更擅长把技术实现、业务场景、用户需求和表达展示连接起来；希望在真实业务中持续积累 ToB 场景理解、客户沟通能力和 AI 应用落地经验。",
            "body",
        )
    )
    story.append(bullet("技术理解：能够理解 Python、API 接入、RAG 知识库、前后端联调、Agent / Skill / Tool 调度和软硬件协同等技术实现逻辑。"))
    story.append(bullet("沟通表达：有社团管理、公开宣讲和自媒体内容表达经历，能够把技术方案转化为用户、业务方或面试官更容易理解的语言。"))
    story.append(bullet("项目执行：核心项目均完成需求分析、功能开发、AI 能力接入、README、截图与演示视频沉淀，具备项目闭环意识。"))

    return story


def build_pdf() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=13 * mm,
        bottomMargin=13 * mm,
    )
    doc.build(build_story(), onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    build_pdf()
