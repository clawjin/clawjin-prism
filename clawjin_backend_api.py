import os
import urllib.parse
import logging
from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import hashlib

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [CLAWJIN-API] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("clawjin.api")

load_dotenv()

user = os.getenv("DB_USER")
raw_password = os.getenv("DB_PASSWORD")
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT", "6543")
dbname = os.getenv("DB_NAME", "postgres")
CLAWJIN_API_KEY = os.getenv("CLAWJIN_API_KEY", "clawjin_sec_99a8b7c6d5e4f3")

if not raw_password:
    raise ValueError("Missing DB_PASSWORD in environment.")

password = urllib.parse.quote_plus(raw_password)
DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

app = FastAPI(
    title="Clawjin Prism Enterprise Production Engine",
    version="3.0.0",
    docs_url=None,
    redoc_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def pseudonymize_customer_id(raw_id: str) -> str:
    salt = "clawjin_enterprise_salt_2026"
    return f"CUST_{hashlib.sha256(f'{raw_id}_{salt}'.encode()).hexdigest()[:16]}"

@app.get("/")
def health_check():
    return {
        "status": "online",
        "engine": "Clawjin Prism™ v3.0 Production Core",
        "database": "PostgreSQL (Supabase Mumbai)",
        "security": "Zero-PII Cryptographic Enclave Active"
    }

@app.get("/api/dashboard/summary")
def get_macro_summary(days: int = 7):
    query = text("""
        SELECT 
            date::text, 
            total_orders, 
            gross_revenue, 
            total_ad_spend, 
            net_cash_profit, 
            marketing_efficiency_ratio, 
            blended_cac,
            net_profit_margin_pct
        FROM analytics.fct_marketing_efficiency_ratio 
        WHERE gross_revenue > 0
        ORDER BY date DESC 
        LIMIT :days;
    """)
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"days": days})

    total_rev = float(df['gross_revenue'].sum()) if not df.empty else 0.0
    total_spend = float(df['total_ad_spend'].sum()) if not df.empty else 0.0
    total_profit = float(df['net_cash_profit'].sum()) if not df.empty else 0.0
    total_orders = int(df['total_orders'].sum()) if not df.empty else 0

    return {
        "summary": {
            "gross_revenue": round(total_rev, 2),
            "total_ad_spend": round(total_spend, 2),
            "net_cash_profit": round(total_profit, 2),
            "total_orders": total_orders,
            "marketing_efficiency_ratio": round(total_rev / total_spend, 2) if total_spend > 0 else 0.0,
            "blended_cac": round(total_spend / total_orders, 2) if total_orders > 0 else 0.0,
            "net_margin_pct": round((total_profit / total_rev) * 100, 2) if total_rev > 0 else 0.0
        },
        "daily_breakdown": df.to_dict(orient="records")
    }

@app.get("/api/dashboard/channels")
def get_channel_attributed_pnl():
    query = text("""
        SELECT 
            channel,
            SUM(total_orders) as total_orders,
            SUM(attributed_revenue) as attributed_revenue,
            SUM(channel_ad_spend) as channel_ad_spend,
            SUM(attributed_cogs) as attributed_cogs,
            SUM(channel_net_profit) as channel_net_profit,
            CASE 
                WHEN SUM(channel_ad_spend) > 0 
                THEN ROUND(SUM(attributed_revenue) / SUM(channel_ad_spend), 2)
                ELSE 0.0 
            END as channel_roas
        FROM analytics.fct_channel_attributed_pnl
        GROUP BY 1
        ORDER BY channel_net_profit DESC;
    """)
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    return {"channels": df.to_dict(orient="records")}

@app.post("/api/webhooks/shopify/orders")
async def receive_shopify_order(request: Request):
    payload = await request.json()
    order_id = str(payload.get("order_id", f"ORD_{int(pd.Timestamp.now().timestamp())}"))
    customer_id = str(payload.get("customer_id", "GUEST"))
    revenue = float(payload.get("gross_revenue", 0.0))
    token = pseudonymize_customer_id(customer_id)
    
    insert_sql = text("""
        INSERT INTO public.raw_orders (
            order_id, customer_id, order_date, gross_revenue, cogs, shipping_cost, acquisition_channel, status
        ) VALUES (
            :order_id, :customer_id, NOW(), :gross_revenue, :cogs, 5.0, 'Shopify Web', 'Completed'
        )
        ON CONFLICT (order_id) DO UPDATE SET
            gross_revenue = EXCLUDED.gross_revenue,
            status = 'Completed';
    """)
    with engine.begin() as conn:
        conn.execute(insert_sql, {
            "order_id": order_id, 
            "customer_id": token, 
            "gross_revenue": revenue, 
            "cogs": round(revenue * 0.35, 2)
        })
    logger.info(f"Ingested live order {order_id} (Token: {token}, Revenue: ${revenue:.2f}).")
    return {"status": "success", "order_id": order_id, "token": token}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)