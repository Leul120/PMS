"""
Fix all places where raw vendor/PO IDs are shown instead of human-readable names.
Run from workspace root: python scripts/fix_ids.py
"""
import re, sys

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print(f"  fixed: {path}")

# ─── invoices/page.tsx ────────────────────────────────────────────────────────
path = "frontend/app/invoices/page.tsx"
c = read(path)

# 1. Add getVendorNameMap import
c = c.replace(
    "import { invoiceApi, poApi, threeWayMatchApi, deliveryApi, getVendorNameMap } from \"@/lib/api\";",
    "import { invoiceApi, poApi, threeWayMatchApi, deliveryApi, getVendorNameMap } from \"@/lib/api\";"
)
# (already done in previous session — idempotent)
if "getVendorNameMap" not in c:
    c = c.replace(
        "import { invoiceApi, poApi, threeWayMatchApi, deliveryApi } from \"@/lib/api\";",
        "import { invoiceApi, poApi, threeWayMatchApi, deliveryApi, getVendorNameMap } from \"@/lib/api\";"
    )

# 2. Replace the VENDOR comment line (has garbled chars) and add vendorMap fetch
old_vendor_comment = re.search(
    r"if \(isVendor\) \{\s+// VENDOR[^\n]+\n",
    c
)
if old_vendor_comment:
    c = c[:old_vendor_comment.start()] + \
        "      // Pre-load vendor names so we never show raw IDs\n" \
        "      const vendorMap = await getVendorNameMap();\n\n" \
        "      if (isVendor) {\n" \
        "        // VENDOR -- fetch invoices per PO instead of GET /invoices\n" + \
        c[old_vendor_comment.end():]

# 3. Replace the normalised mapping block
old_map = re.search(
    r"const normalised = \(data as any\[\]\)\.map\(\(inv: any\) => \(\{.*?createdAt: inv\.createdAt,\s*\}\)\);",
    c, re.DOTALL
)
if old_map:
    new_map = (
        "const normalised = (data as any[]).map((inv: any) => {\n"
        "        const vendorId = String(inv.vendorId || \"\");\n"
        "        const vendorName = inv.vendorName || vendorMap.get(vendorId) || (vendorId ? `Vendor #${vendorId}` : \"Unknown Vendor\");\n"
        "        return {\n"
        "          id: String(inv.id || inv.invoiceId),\n"
        "          invoiceNumber: inv.invoiceNumber || `INV-${String(inv.id || inv.invoiceId).padStart(6, \"0\")}`,\n"
        "          poId: String(inv.poId || inv.purchaseOrderId || \"\"),\n"
        "          poNumber: inv.poNumber || (inv.poId ? `PO-${String(inv.poId).padStart(6, \"0\")}` : \"--\"),\n"
        "          vendorId,\n"
        "          vendorName,\n"
        "          invoiceAmount: Number(inv.invoiceAmount || inv.amount || 0),\n"
        "          status: inv.status || \"PENDING\",\n"
        "          discrepancyFlag: inv.discrepancyFlag ?? false,\n"
        "          createdAt: inv.createdAt,\n"
        "        };\n"
        "      });"
    )
    c = c[:old_map.start()] + new_map + c[old_map.end():]

write(path, c)

# ─── rfq/page.tsx ─────────────────────────────────────────────────────────────
path = "frontend/app/rfq/page.tsx"
c = read(path)

# Fix raw rfq.id shown in RFQ table — replace with rfq.rfqNumber
# The table cell shows: <TableCell className="font-medium">{rfq.id}</TableCell>
c = c.replace(
    '<TableCell className="font-medium">{rfq.id}</TableCell>',
    '<TableCell className="font-medium">{rfq.rfqNumber}</TableCell>'
)

# Fix maxBudget shown without $ formatting
c = c.replace(
    "<TableCell className=\"font-medium\">{rfq.maxBudget}</TableCell>",
    "<TableCell className=\"font-medium\">${rfq.maxBudget?.toLocaleString()}</TableCell>"
)

# Fix raw deadline shown without formatting
c = c.replace(
    "            <Calendar className=\"h-4 w-4\" />\n                            {rfq.deadline}",
    "            <Calendar className=\"h-4 w-4\" />\n                            {rfq.deadline ? new Date(rfq.deadline).toLocaleDateString() : \"--\"}"
)

# Fix vendorName fallback in openAwardDialog and loadBids
# Already uses: vendorName: b.vendorName || `Vendor #${b.vendorId}`
# Replace with vendorMap lookup — add import and vendorMap fetch
if "getVendorNameMap" not in c:
    c = c.replace(
        "import { rfqApi, bidApi, poApi, vendorApi } from \"@/lib/api\";",
        "import { rfqApi, bidApi, poApi, vendorApi, getVendorNameMap } from \"@/lib/api\";"
    )

# Fix bid vendorName fallback in openAwardDialog
c = c.replace(
    "vendorName: b.vendorName || `Vendor #${b.vendorId}`,\n        deliveryTime: b.deliveryTime || (b.deliveryDays ? `${b.deliveryDays} days` : \"â€â€\"),",
    "vendorName: b.vendorName || `Vendor #${b.vendorId}`,\n        deliveryTime: b.deliveryTime || (b.deliveryDays ? `${b.deliveryDays} days` : \"--\"),"
)

# Fix garbled em-dashes in loadBids and loadAllBids
c = re.sub(r'deliveryTime: b\.deliveryTime \|\| \(b\.deliveryDays \? `\$\{b\.deliveryDays\} days` : "[^"]*"\),',
           'deliveryTime: b.deliveryTime || (b.deliveryDays ? `${b.deliveryDays} days` : "--"),', c)

write(path, c)

# ─── dashboard/officer/page.tsx ───────────────────────────────────────────────
path = "frontend/app/dashboard/officer/page.tsx"
c = read(path)

if "getVendorNameMap" not in c:
    c = c.replace(
        "import { rfqApi, vendorApi, poApi, bidApi } from \"@/lib/api\";",
        "import { rfqApi, vendorApi, poApi, bidApi, getVendorNameMap } from \"@/lib/api\";"
    )

# Replace the vendorName fallback in setPendingPOs mapping
c = c.replace(
    "vendorName: po.vendorName || `Vendor #${po.vendorId}`,",
    "vendorName: po.vendorName || vendorMap?.get(String(po.vendorId || \"\")) || (po.vendorId ? `Vendor #${po.vendorId}` : \"N/A\"),"
)

# Add vendorMap fetch inside the load() function — after the Promise.all
old_load_block = "        const [rfqs, vendors, pos] = await Promise.all(["
new_load_block = (
    "        const [rfqs, vendors, pos, vendorMap] = await Promise.all([\n"
    if "const [rfqs, vendors, pos] = await Promise.all([" in c
    else "        const [rfqs, vendors, pos] = await Promise.all(["
)
if "const [rfqs, vendors, pos] = await Promise.all([" in c:
    # Find the closing ]);  of the Promise.all and add getVendorNameMap()
    c = c.replace(
        "        const [rfqs, vendors, pos] = await Promise.all([\n"
        "          rfqApi.getAllList().catch(() => []),\n"
        "          vendorApi.getAllList().catch(() => []),\n"
        "          poApi.getAllList().catch(() => []),\n"
        "        ]);",
        "        const [rfqs, vendors, pos, vendorMap] = await Promise.all([\n"
        "          rfqApi.getAllList().catch(() => []),\n"
        "          vendorApi.getAllList().catch(() => []),\n"
        "          poApi.getAllList().catch(() => []),\n"
        "          getVendorNameMap(),\n"
        "        ]);"
    )

write(path, c)

# ─── dashboard/manager/page.tsx ───────────────────────────────────────────────
path = "frontend/app/dashboard/manager/page.tsx"
c = read(path)

if "getVendorNameMap" not in c:
    c = c.replace(
        "import { poApi, rfqApi, analyticsApi } from \"@/lib/api\";",
        "import { poApi, rfqApi, analyticsApi, getVendorNameMap } from \"@/lib/api\";"
    )

# Replace vendorName fallback
c = c.replace(
    "vendorName: po.vendorName || `Vendor #${po.vendorId}`,",
    "vendorName: po.vendorName || vendorMap?.get(String(po.vendorId || \"\")) || (po.vendorId ? `Vendor #${po.vendorId}` : \"N/A\"),"
)

# Add vendorMap to Promise.all
if "const [pos, rfqs] = await Promise.all([" in c:
    c = c.replace(
        "      const [pos, rfqs] = await Promise.all([\n"
        "        poApi.getAllList().catch(() => []),\n"
        "        rfqApi.getAllList().catch(() => []),\n"
        "      ]);",
        "      const [pos, rfqs, vendorMap] = await Promise.all([\n"
        "        poApi.getAllList().catch(() => []),\n"
        "        rfqApi.getAllList().catch(() => []),\n"
        "        getVendorNameMap(),\n"
        "      ]);"
    )

write(path, c)

print("\nAll fixes applied.")
