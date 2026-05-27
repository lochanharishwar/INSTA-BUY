import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.units import inch

def generate_pdf():
    # Setup document
    pdf_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "reports"))
    os.makedirs(pdf_dir, exist_ok=True)
    pdf_path = os.path.join(pdf_dir, "instachef_v2_report.pdf")
    
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    # Theme colors
    c_orange = colors.HexColor('#FC8019')
    c_dark = colors.HexColor('#1A1A1A')
    c_grey = colors.HexColor('#4A4A4A')
    c_light = colors.HexColor('#F9F8F6')
    c_green = colors.HexColor('#16A34A')
    c_border = colors.HexColor('#E5E7EB')
    
    # Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=32,
        textColor=c_orange,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_dark,
        spaceAfter=15
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=c_dark,
        spaceBefore=15,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_orange,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=c_grey,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )
    
    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=6
    )

    header_bar_style = ParagraphStyle(
        'HeaderBar',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.white
    )

    story = []
    
    # ── Page 1: Hero & Project Overview ──
    story.append(Spacer(1, 15))
    story.append(Paragraph("InstaChef AI", title_style))
    story.append(Paragraph("Recipe-to-Instamart Agentic Commerce Pipeline • Version 2.0 (Premium Staging)", subtitle_style))
    
    # Swiggy Builders Club Accent Line
    story.append(Table(
        [['']], 
        colWidths=[530], 
        rowHeights=[4], 
        style=TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), c_orange),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ])
    ))
    story.append(Spacer(1, 15))
    
    story.append(Paragraph("Project Overview", h1_style))
    story.append(Paragraph(
        "InstaChef AI is a high-performance agentic commerce engine built specifically for the <b>Swiggy Builders Club Hackathon 2026</b>. "
        "It acts as a digital <i>Mise en Place</i> assistant, allowing users to paste any recipe source (YouTube video, Instagram Reel, food blog, "
        "or unstructured text description) and instantly map the ingredients to real products on <b>Swiggy Instamart</b>. "
        "By utilizing a 10-node orchestrator state machine, vector-based inventory decay math, and proportional group-order bill splitting (HostelSync), "
        "InstaChef V2.0 transitions the platform from a simple hack project to a production-compliant SaaS tool.",
        body_style
    ))
    
    story.append(Paragraph("Key Compliance & Architecture Alignments", h2_style))
    story.append(Paragraph("• <b>Swiggy Builders Club Instamart Schema Compliance:</b> Standardizes the cart lifecycle flow exactly as dictated by the Swiggy Builders Club toolspec (get_addresses &rarr; clear_cart &rarr; update_cart &rarr; get_cart &rarr; checkout &rarr; track_order).", bullet_style))
    story.append(Paragraph("• <b>OAuth 2.1 PKCE Flow:</b> Employs secure PKCE authorization code exchange and automated refresh token rotation via Redis session tokens.", bullet_style))
    story.append(Paragraph("• <b>Non-Idempotent Staging Checkout Guards:</b> Integrates standard 5xx recovery logic. On failure, the backend polls get_orders to check if the transaction succeeded before attempting a retried checkout.", bullet_style))
    story.append(Paragraph("• <b>Precision Unit Penalties:</b> The search normalizer applies a strict packaging ratio penalty (e.g. avoiding 1kg turmeric packs for a 1-tsp recipe) to prevent high-waste carts.", bullet_style))

    story.append(Spacer(1, 10))
    
    # V1.0 vs V2.0 Evolution Table
    story.append(Paragraph("Platform Evolution (V1.0 vs V2.0)", h1_style))
    evolution_data = [
        [Paragraph("Feature / Metric", header_bar_style), Paragraph("V1.0 (Hack Prototype)", header_bar_style), Paragraph("V2.0 (Premium SaaS Compliance)", header_bar_style)],
        [Paragraph("<b>Branding & Theme</b>", body_style), Paragraph("Generic Bootstrap UI, standard dark theme", body_style), Paragraph("Swiggy Orange & warm-light palette, Inter typography, micro-interactions", body_style)],
        [Paragraph("<b>Cart Strategy</b>", body_style), Paragraph("Single unsorted list, ignores pantry stock", body_style), Paragraph("Interactive Categories: Zaroori (Must Buy) vs Kam Zaroori (Optional) vs Pantry", body_style)],
        [Paragraph("<b>Pantry Sync</b>", body_style), Paragraph("Static manual text checklist", body_style), Paragraph("ChromaDB vector store with inventory decay shelf-life heuristics", body_style)],
        [Paragraph("<b>OAuth Session</b>", body_style), Paragraph("Short-lived hardcoded credentials", body_style), Paragraph("OAuth 2.1 PKCE with auto token refresh rotation on Redis", body_style)],
        [Paragraph("<b>HostelSync</b>", body_style), Paragraph("Basic placeholder text", body_style), Paragraph("Proportional fractional bill splitting, live roommate approvals via SSE", body_style)],
        [Paragraph("<b>5xx Recovery</b>", body_style), Paragraph("Fails instantly / blind retries", body_style), Paragraph("Robust polling on get_orders to check order status before retry", body_style)]
    ]
    
    evol_table = Table(evolution_data, colWidths=[130, 190, 210])
    evol_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_orange),
        ('BACKGROUND', (0,1), (-1,-1), c_light),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('BOX', (0,0), (-1,-1), 1, c_orange),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(evol_table)
    
    story.append(PageBreak())
    
    # ── Page 2: Orchestrator Architecture ──
    story.append(Paragraph("LangGraph Orchestration Pipeline", h1_style))
    story.append(Paragraph(
        "The core processing logic is built on <b>LangGraph</b> as a multi-node StateGraph. "
        "It supports execution checkpoints, streaming Server-Sent Events (SSE), and human-in-the-loop approvals.",
        body_style
    ))
    
    # Nodes details table
    nodes_data = [
        [Paragraph("Node Name", header_bar_style), Paragraph("Role in Staging Pipeline", header_bar_style), Paragraph("V2.0 Enhancement", header_bar_style)],
        [Paragraph("<b>Classify</b>", body_style), Paragraph("Categorizes input text or media link (YouTube/Insta/Blog)", body_style), Paragraph("Determines fast-pass bypass routes", body_style)],
        [Paragraph("<b>User Context</b>", body_style), Paragraph("Pulls order history and current pantry states", body_style), Paragraph("Queries vector embeddings in ChromaDB", body_style)],
        [Paragraph("<b>Extract</b>", body_style), Paragraph("Transcribes video transcripts or scrapes recipe body text", body_style), Paragraph("Fast-pass metadata parser bypass (<1s)", body_style)],
        [Paragraph("<b>Understand</b>", body_style), Paragraph("Uses LLM to extract clean ingredient-quantity schema", body_style), Paragraph("Dual NIM Llama 3.1 + Claude fallbacks", body_style)],
        [Paragraph("<b>Validate Recipe</b>", body_style), Paragraph("Fixes invalid ingredients and applies caps", body_style), Paragraph("Sanitizes metric quantities", body_style)],
        [Paragraph("<b>Normalize</b>", body_style), Paragraph("Converts units (e.g. pinch, cup) to standard weight", body_style), Paragraph("Applies standardized weight boundaries", body_style)],
        [Paragraph("<b>Search</b>", body_style), Paragraph("Parallel search on Swiggy Instamart inventory", body_style), Paragraph("Requires addressId header parameter", body_style)],
        [Paragraph("<b>Optimize</b>", body_style), Paragraph("Saves waste and picks optimal pack variants", body_style), Paragraph("Applies waste-score threshold categorization", body_style)],
        [Paragraph("<b>Validate Cart</b>", body_style), Paragraph("Ensures delivery serviceability and checks stock", body_style), Paragraph("Out of stock auto-re-search logic", body_style)],
        [Paragraph("<b>Checkout (MCP)</b>", body_style), Paragraph("Builds cart and submits COD order", body_style), Paragraph("5xx status order status double-checks", body_style)]
    ]
    
    nodes_table = Table(nodes_data, colWidths=[110, 240, 180])
    nodes_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_dark),
        ('BACKGROUND', (0,1), (-1,-1), c_light),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('BOX', (0,0), (-1,-1), 1, c_dark),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(nodes_table)
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("Human-In-The-Loop (HITL) Stepper", h2_style))
    story.append(Paragraph(
        "V2.0 introduces two major Sync Barriers in the LangGraph graph: "
        "<b>1. Cart Split Checkpoint:</b> Pause at the Cart Review stage so users can manually override quantities, "
        "move optional items (Kam Zaroori) out of checkout, and force-buy kitchen stock. "
        "<b>2. HostelSync Approval Gate:</b> Pause when ordering in Group Mode until all roommates sign off via their "
        "respective invite tokens, updating Redis states in real-time.",
        body_style
    ))
    
    # ── Page 3: Deep Technical Details ──
    story.append(Paragraph("Premium Tech Stack Details", h1_style))
    
    tech_data = [
        [Paragraph("Technology Layer", header_bar_style), Paragraph("Specification / Package", header_bar_style), Paragraph("Staging Details", header_bar_style)],
        [Paragraph("<b>Orchestrator</b>", body_style), Paragraph("LangGraph + MemorySaver checkpointer", body_style), Paragraph("Allows session interrupts/resumption", body_style)],
        [Paragraph("<b>Vector Search</b>", body_style), Paragraph("ChromaDB + all-MiniLM-L6-v2 embeddings", body_style), Paragraph("Cosine similarity matching for inventory history", body_style)],
        [Paragraph("<b>Caching / Session</b>", body_style), Paragraph("Redis (redis-py)", body_style), Paragraph("Stores OAuth sessions and live HostelSync status", body_style)],
        [Paragraph("<b>Backend API</b>", body_style), Paragraph("FastAPI + Uvicorn + SSE Starlette", body_style), Paragraph("Handles high throughput and live event streaming", body_style)],
        [Paragraph("<b>Frontend State</b>", body_style), Paragraph("Next.js 14 (App Router) + Zustand", body_style), Paragraph("Modular widgets, responsive viewport adjust", body_style)],
        [Paragraph("<b>Social Scrapers</b>", body_style), Paragraph("yt-dlp + Faster Whisper + instaloader", body_style), Paragraph("Optimized media audio extractor pipeline", body_style)]
    ]
    
    tech_table = Table(tech_data, colWidths=[120, 210, 200])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_orange),
        ('BACKGROUND', (0,1), (-1,-1), c_light),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('BOX', (0,0), (-1,-1), 1, c_orange),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(tech_table)
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("API Endpoint Registry", h1_style))
    
    api_data = [
        [Paragraph("Method", header_bar_style), Paragraph("Endpoint", header_bar_style), Paragraph("Description", header_bar_style)],
        [Paragraph("<b>POST</b>", body_style), Paragraph("/api/process", body_style), Paragraph("Spawns the LangGraph background executor thread", body_style)],
        [Paragraph("<b>GET</b>", body_style), Paragraph("/api/stream", body_style), Paragraph("Streams real-time Server-Sent Events (SSE) progress", body_style)],
        [Paragraph("<b>GET</b>", body_style), Paragraph("/api/session", body_style), Paragraph("Retrieves cart proposal and HostelSync roommate statuses", body_style)],
        [Paragraph("<b>POST</b>", body_style), Paragraph("/api/cart/approve", body_style), Paragraph("Flags roommate approval (HostelSync)", body_style)],
        [Paragraph("<b>POST</b>", body_style), Paragraph("/api/cart/confirm", body_style), Paragraph("Initiates the Swiggy Instamart build + checkout tool calls", body_style)],
        [Paragraph("<b>GET</b>", body_style), Paragraph("/api/track", body_style), Paragraph("Retrieves live order delivery status and rider ETA", body_style)],
        [Paragraph("<b>GET</b>", body_style), Paragraph("/auth/login", body_style), Paragraph("Generates Swiggy OAuth 2.1 Auth URL with PKCE verifier", body_style)],
        [Paragraph("<b>GET</b>", body_style), Paragraph("/auth/callback", body_style), Paragraph("Exchanges auth code for tokens; stores on Redis", body_style)]
    ]
    
    api_table = Table(api_data, colWidths=[70, 150, 310])
    api_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_dark),
        ('BACKGROUND', (0,1), (-1,-1), c_light),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('BOX', (0,0), (-1,-1), 1, c_dark),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(api_table)
    
    # Footer Page numbering
    def add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(c_orange)
        canvas.drawString(40, 20, "INSTACHEF AI — SWIGGY BUILDERS CLUB")
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(c_grey)
        canvas.drawRightString(570, 20, f"Page {doc.page}")
        canvas.restoreState()
        
    # Build Document
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"Report generated successfully: {pdf_path}")

if __name__ == '__main__':
    generate_pdf()
