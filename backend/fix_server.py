import re

with open('/Users/apple/Meza/backend/server.js', 'r') as f:
    content = f.read()

old_mw = """app.use(express.json({ limit: '10kb' })); // Body parser with size limit
app.use(cookieParser());

// SECURITY MIDDLEWARE
app.use(helmet()); // Set security HTTP headers
app.use(hpp()); // Prevent parameter pollution
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(xss()); // Prevent XSS Attacks"""

new_mw = """app.use(express.json({ limit: '10kb' })); // Body parser with size limit
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // URL encoded parser
app.use(cookieParser());

// SECURITY MIDDLEWARE
app.use(helmet()); // Set security HTTP headers
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(xss()); // Prevent XSS Attacks
app.use(hpp()); // Prevent parameter pollution"""

content = content.replace(old_mw, new_mw)

with open('/Users/apple/Meza/backend/server.js', 'w') as f:
    f.write(content)
