import re

with open('/Users/apple/Meza/frontend/src/pages/admin/Dashboard.jsx', 'r') as f:
    content = f.read()

# Remove the Yearly option
content = content.replace('<option value="yearly">Yearly View</option>', '')

# Fix stat logic
content = content.replace("timeframe === 'monthly' ? \"This Month's Sales\" : \"This Year's Sales\"", "timeframe === 'monthly' ? \"This Month's Sales\" : \"Sales\"")

# Fix trend chart logic
content = content.replace("timeframe === 'monthly' ? '6-Month' : '5-Year'", "'6-Month'")

# Fix top items logic
content = content.replace("timeframe === 'monthly' ? '6 Months' : '5 Years'", "'6 Months'")

with open('/Users/apple/Meza/frontend/src/pages/admin/Dashboard.jsx', 'w') as f:
    f.write(content)
