import re
import pathlib

dbml = pathlib.Path(__file__).resolve().parents[1] / "docs/diagrams/waytocanada-full-er.dbml"
text = dbml.read_text(encoding="utf-8")
tables = re.findall(r"^Table (\w+) \{(.*?)^\}", text, re.M | re.S)
refs = re.findall(r"^Ref: (.+)$", text, re.M)

prompt = """CHATGPT PROMPT (copy everything below this line to ChatGPT):
================================================================================
Create a complete Entity Relationship Diagram (ERD) for the WayToCanada immigration consultant platform.

Requirements:
- Use Chen notation OR Crow's Foot notation (your choice, but be consistent)
- Show ALL tables listed below
- Mark Primary Keys (PK) and Foreign Keys (FK) clearly
- Show cardinality: 1:1, 1:N, M:N
- Group tables by domain with colored sections:
  1) Users & Auth
  2) Clients & Cases
  3) IRCC
  4) Legislation
  5) Payments & Trust
  6) Consultant Tools
  7) Notifications & Support
  8) RCIC Community
  9) LMS (db_lms - separate database)
- Note: lms_course_assignments.client_user_id references users.id across databases (no DB FK)
- Output as Mermaid erDiagram code OR draw.io XML OR a visual diagram

DATABASE SCHEMA:
================================================================================

"""

lines = [prompt]
lines += ["Database: PostgreSQL", "db_cws = main application database", "db_lms = LMS database (separate)", ""]

for name, body in tables:
    pk, uk, fk, cols = [], [], [], []
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("//") or line.startswith("Note:") or line.startswith("indexes"):
            continue
        m = re.match(r"^(\w+)\s+(\S+)", line)
        if not m:
            continue
        col, typ = m.group(1), m.group(2)
        cols.append(f"{col} ({typ})")
        if "[pk" in line:
            pk.append(col)
        if "[unique" in line and "[pk" not in line:
            uk.append(col)
        rm = re.search(r"ref:\s*>\s*([\w.]+)", line)
        if rm:
            target = rm.group(1).rstrip(",]")
            fk.append(f"{col} -> {target}")

    lines.append(f"TABLE: {name}")
    lines.append(f"  PRIMARY KEY: {', '.join(pk) if pk else 'id'}")
    if uk:
        lines.append(f"  UNIQUE: {', '.join(uk)}")
    if fk:
        lines.append(f"  FOREIGN KEYS: {'; '.join(fk)}")
    lines.append(f"  COLUMNS: {', '.join(cols)}")
    lines.append("")

lines += ["=" * 80, "RELATIONSHIP SUMMARY (all foreign keys):", "=" * 80, ""]
for r in refs:
    lines.append(r)

# inline FKs from table definitions
inline_fks = []
for name, body in tables:
    for line in body.splitlines():
        rm = re.search(r"^(\w+)\s+\S+.*ref:\s*>\s*([\w.]+)", line.strip())
        if rm:
            target = rm.group(2).rstrip(",]")
            inline_fks.append(f"{name}.{rm.group(1)} > {target}")

lines += ["", "=" * 80, "INLINE FK LIST:", "=" * 80, ""]
for fk in sorted(set(inline_fks)):
    lines.append(fk)

out = pathlib.Path(__file__).resolve().parents[1] / "docs/diagrams/waytocanada-er-chatgpt-schema.txt"
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Written: {out}")
print(f"Tables: {len(tables)}, Explicit Refs: {len(refs)}, Inline FKs: {len(set(inline_fks))}")
