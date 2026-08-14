import os
import pandas as pd
from sqlalchemy import create_engine, text
import urllib.parse
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

user = os.getenv("DB_USER")
raw_password = os.getenv("DB_PASSWORD")
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT", "6543")
dbname = os.getenv("DB_NAME", "postgres")

if not raw_password:
    raise ValueError("❌ Missing DB_PASSWORD in .env file!")

password = urllib.parse.quote_plus(raw_password)
DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"

print("⏳ Connecting to Supabase Cloud PostgreSQL in Mumbai...")
engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    print("🧹 Truncating raw tables (preserving dbt dependent views)...")
    conn.execute(text("TRUNCATE TABLE raw_orders, raw_ad_spend;"))

print("📦 Ingesting 5,000 orders into Supabase...")
df_orders = pd.read_csv("raw_shopify_orders.csv")
df_orders.to_sql("raw_orders", engine, if_exists="append", index=False)

print("📊 Ingesting daily ad spend into Supabase...")
df_ads = pd.read_csv("raw_ad_spend.csv")
df_ads.to_sql("raw_ad_spend", engine, if_exists="append", index=False)

print("✅ SUCCESS: All 5,000 orders and ad spend are live in Supabase PostgreSQL!")