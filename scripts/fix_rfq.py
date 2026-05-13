"""Fix loadAllBids in rfq/page.tsx"""
import re

path = "frontend/app/rfq/page.tsx"
with open(path, encoding="utf-8") as f:
    c = f.read()

# Find and replace the loadAllBids function body
# Match from the function declaration to the closing brace
old_pattern = re.compile(
    r'  // Load all bids across all RFQs for the Bids tab\n'
    r'  async function loadAllBids\(\) \{.*?'
    r'  \}(?=\n\n  // When switching)',
    re.DOTALL
)

new_func = (
    '  // Load all bids across all RFQs for the Bids tab\n'
    '  async function loadAllBids() {\n'
    '    if (rfqs.length === 0) return;\n'
    '    try {\n'
    '      setBidsLoading(true);\n'
    '      const [results, vendorMap] = await Promise.all([\n'
    '        Promise.allSettled(rfqs.map(r => bidApi.getByRfq(r.id))),\n'
    '        getVendorNameMap(),\n'
    '      ]);\n'
    '      const merged: Bid[] = [];\n'
    '      results.forEach((result, idx) => {\n'
    '        if (result.status === "fulfilled") {\n'
    '          (result.value as any[]).forEach((bid: any) => {\n'
    '            merged.push({\n'
    '              ...bid,\n'
    '              id: String(bid.id || bid.bidId),\n'
    '              vendorName: bid.vendorName || vendorMap.get(String(bid.vendorId || "")) || (bid.vendorId ? `Vendor #${bid.vendorId}` : "Unknown Vendor"),\n'
    '              deliveryTime: bid.deliveryTime || (bid.deliveryDays ? `${bid.deliveryDays} days` : "--"),\n'
    '              score: bid.score ?? (bid.totalScore ? Math.round(Number(bid.totalScore)) : 0),\n'
    '              rfqId: rfqs[idx].id,\n'
    '              rfqTitle: rfqs[idx].title,\n'
    '            });\n'
    '          });\n'
    '        }\n'
    '      });\n'
    '      setAllBids(merged);\n'
    '    } catch {\n'
    '      // silently fail\n'
    '    } finally {\n'
    '      setBidsLoading(false);\n'
    '    }\n'
    '  }'
)

m = old_pattern.search(c)
if m:
    c = c[:m.start()] + new_func + c[m.end():]
    print("loadAllBids replaced")
else:
    print("WARNING: pattern not found, trying line-based replacement")
    # Fallback: replace just the two bad lines
    c = re.sub(
        r'vendorName: bid\.vendorName \|\| `Vendor #\$\{bid\.vendorId\}`,',
        'vendorName: bid.vendorName || vendorMap.get(String(bid.vendorId || "")) || (bid.vendorId ? `Vendor #${bid.vendorId}` : "Unknown Vendor"),',
        c
    )
    # Fix garbled deliveryTime
    c = re.sub(
        r'deliveryTime: bid\.deliveryTime \|\| \(bid\.deliveryDays \? `\$\{bid\.deliveryDays\} days` : "[^"]*"\),',
        'deliveryTime: bid.deliveryTime || (bid.deliveryDays ? `${bid.deliveryDays} days` : "--"),',
        c
    )
    # Add vendorMap to the Promise.allSettled call
    c = c.replace(
        '      const results = await Promise.allSettled(rfqs.map(r => bidApi.getByRfq(r.id)));',
        '      const [results, vendorMap] = await Promise.all([\n'
        '        Promise.allSettled(rfqs.map(r => bidApi.getByRfq(r.id))),\n'
        '        getVendorNameMap(),\n'
        '      ]);'
    )
    print("fallback replacements applied")

with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(c)

print("Done:", path)
