# replace_sidebar.py
import re

# Read source sidebar from ncategory2.html
with open('public2/ncategory2.html', 'r', encoding='utf-8') as f:
    ncategory2_content = f.read()

# Extract sidebar (from <aside to </aside>)
sidebar_match = re.search(r'(<aside class="col-span-3 neo-card.*?</aside>)', ncategory2_content, re.DOTALL)
if not sidebar_match:
    print("❌ Could not find sidebar in ncategory2.html")
    exit(1)

new_sidebar = sidebar_match.group(1)
print(f"✅ Extracted sidebar from ncategory2.html ({len(new_sidebar)} chars)")

# Read target file
with open('public2/admin/ncategory2manager.html', 'r', encoding='utf-8') as f:
    manager_content = f.read()

# Replace sidebar in manager file
manager_replaced = re.sub(
    r'<aside class="col-span-3 neo-card.*?</aside>',
    new_sidebar,
    manager_content,
    count=1,
    flags=re.DOTALL
)

if manager_replaced == manager_content:
    print("❌ No replacement made - pattern not found")
    exit(1)

# Write back
with open('public2/admin/ncategory2manager.html', 'w', encoding='utf-8') as f:
    f.write(manager_replaced)

print("✅ Successfully replaced sidebar in ncategory2manager.html")
