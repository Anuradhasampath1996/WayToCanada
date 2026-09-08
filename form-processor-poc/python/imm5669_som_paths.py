#!/usr/bin/env python3
from pathlib import Path
import re

text = Path(
    r"f:\WayToCanada\WayToCanada\backend\storage\app\private"
    r"\government-forms-poc\reports\xfa-imm5669\template.xml"
).read_text(encoding="utf-8", errors="replace")

# stack of open named containers
stack: list[str] = []
hits: list[str] = []
targets = {
    "familyName",
    "givenName",
    "birthDate3",
    "nameOfApplicant",
    "fathersFamilyName",
    "fathersGivenName",
    "mothersGivenName",
    "mothersBirthFamilyName",
}

for m in re.finditer(
    r"<(?P<close>/)?(?P<tag>subform|field|exclGroup|pageSet|pageArea|area)(?P<attrs>[^>]*)>",
    text,
):
    close = m.group("close")
    tag = m.group("tag")
    attrs = m.group("attrs")
    name_m = re.search(r'\bname="([^"]+)"', attrs)
    name = name_m.group(1) if name_m else None
    self_close = attrs.rstrip().endswith("/")

    if close:
        if stack:
            stack.pop()
        continue

    if name:
        stack.append(f"{name}[0]")
        if tag == "field" and name in targets:
            hits.append(".".join(stack))
        if self_close or tag == "field":
            # fields are leaves; pop immediately unless container
            if tag == "field" or self_close:
                stack.pop()
    elif self_close:
        pass

for h in hits:
    print(h)
