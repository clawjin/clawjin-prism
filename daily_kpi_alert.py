import os
import pandas as pd
from sqlalchemy import create_engine
import urllib.parse
from datetime import datetime
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

user = os.getenv("DB_USER")
raw_password = os.getenv("DB_PASSWORD")
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT", "6543")
dbname = os.getenv("DB_NAME", "postgres")

password = urllib.parse.quote_plus(raw_password)
DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"

engine = create_engine(DATABASE_URL)

query = """
    select * 
    from analytics.fct_daily_unit_economics 
    where total_revenue > 0
    order by date desc 
    limit 7;
"""

df = pd.read_sql(query, engine)

print("="*60)
print(f"🤖 CLAWJIN EXECUTIVE KPI BRIEFING - {datetime.today().strftime('%Y-%m-%d')}")
print("="*60)

latest = df.iloc[0]
print(f"📅 Date: {latest['date']}")
print(f"📦 Total Orders: {int(latest['total_orders']):,}")
print(f"💵 Total Revenue: ${latest['total_revenue']:,.2f}")
print(f"📢 Total Ad Spend: ${latest['total_ad_spend']:,.2f}")
print(f"🎯 Blended ROAS: {latest['blended_roas']}x")
print(f"👤 Blended CAC: ${latest['blended_cac']}")
print(f"📈 Net Profit: ${latest['net_profit']:,.2f}")
print("="*60)
print("✅ Automated daily briefing generated successfully from dbt marts!")