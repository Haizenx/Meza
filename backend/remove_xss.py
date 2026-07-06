import re

with open('/Users/apple/Meza/backend/server.js', 'r') as f:
    content = f.read()

content = content.replace("app.use(xss()); // Prevent XSS Attacks", "// app.use(xss()); // Disabled due to crash with req.query getter")

with open('/Users/apple/Meza/backend/server.js', 'w') as f:
    f.write(content)
