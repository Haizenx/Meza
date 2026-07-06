import re

with open('/Users/apple/Meza/backend/routes/analytics.js', 'r') as f:
    content = f.read()

# Replace the yearly block in GET /api/analytics/dashboard
old_yearly = """    if (timeframe === 'yearly') {
      currentStart = new Date(now.getFullYear(), 0, 1);
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      trendStart = new Date(now.getFullYear() - 4, 0, 1); // 5 years trend
      trendDays = 5;
      trendFormat = '%Y';
      trendGroupBy = { year: { $year: '$createdAt' } };
    } else if (timeframe === 'monthly') {"""

new_yearly = """    if (timeframe === 'monthly' || timeframe === 'yearly') {"""

content = content.replace(old_yearly, new_yearly, 1)

old_yearly2 = """    if (timeframe === 'yearly') {
      trendGroupByTx.month = undefined;
      trendGroupByTx.week = undefined;
      trendGroupByTx.day = undefined;
    } else if (timeframe === 'monthly') {"""

new_yearly2 = """    if (timeframe === 'monthly' || timeframe === 'yearly') {"""

content = content.replace(old_yearly2, new_yearly2, 1)

old_yearly3 = """      if (timeframe === 'yearly') {
        label = `${t._id.year}`;
      } else if (timeframe === 'monthly') {"""

new_yearly3 = """      if (timeframe === 'monthly' || timeframe === 'yearly') {"""

content = content.replace(old_yearly3, new_yearly3, 1)

with open('/Users/apple/Meza/backend/routes/analytics.js', 'w') as f:
    f.write(content)
