"""
Verify that all ID-to-name fixes are in place.
A file is OK if:
  - Every vendorId fallback goes through vendorMap first, OR
  - The file has no vendorId references at all
A file FAILS if it shows a raw `Vendor #${x.vendorId}` WITHOUT a vendorMap lookup nearby.
"""
import re

files = [
    ("frontend/app/invoices/page.tsx",              "invoices"),
    ("frontend/app/rfq/page.tsx",                   "rfq"),
    ("frontend/app/dashboard/officer/page.tsx",     "officer"),
    ("frontend/app/dashboard/manager/page.tsx",     "manager"),
    ("frontend/app/orders/page.tsx",                "orders"),
    ("frontend/app/procurement/page.tsx",           "procurement"),
    ("frontend/app/deliveries/page.tsx",            "deliveries"),
]

all_ok = True
for path, label in files:
    with open(path, encoding="utf-8") as fh:
        c = fh.read()
    issues = []

    # 1. Check that vendorMap is used (if the file deals with vendorIds)
    has_vendor_id_ref = "vendorId" in c
    has_vendor_map    = "vendorMap" in c or "getVendorNameMap" in c

    if has_vendor_id_ref and not has_vendor_map:
        issues.append("has vendorId refs but no vendorMap lookup")

    # 2. Check for raw `Vendor #${x.vendorId}` WITHOUT vendorMap on the same line
    for lineno, line in enumerate(c.splitlines(), 1):
        if re.search(r'Vendor #\$\{[a-z]+\.vendorId\}`', line):
            # It's OK if vendorMap.get is also on the same line (last-resort fallback)
            if "vendorMap" not in line and "vendorMap.get" not in line:
                issues.append(f"line {lineno}: raw Vendor #ID without vendorMap: {line.strip()[:80]}")

    # 3. RFQ-specific: table should show rfqNumber not rfq.id
    if label == "rfq":
        # The main table cell should use rfqNumber
        if re.search(r'<TableCell[^>]*>\{rfq\.id\}</TableCell>', c):
            issues.append("rfq.id shown raw in table cell (should be rfqNumber)")

    # 4. Deliveries: poId column should show poNumber
    if label == "deliveries":
        if re.search(r'<TableCell[^>]*>\{delivery\.poId\}</TableCell>', c):
            issues.append("delivery.poId shown raw (should be poNumber)")

    status = "✓ OK" if not issues else "✗ ISSUES:\n    " + "\n    ".join(issues)
    print(f"{label:15s}: {status}")
    if issues:
        all_ok = False

print()
print("All checks passed!" if all_ok else "Some issues remain — see above.")
