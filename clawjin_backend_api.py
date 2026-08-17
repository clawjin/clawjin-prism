import os
import urllib.parse
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import json

load_dotenv()

# Database Connection
user = os.getenv("DB_USER")
raw_password = os.getenv("DB_PASSWORD")
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT", "6543")
dbname = os.getenv("DB_NAME", "postgres")

if not raw_password:
    raise ValueError("Missing DB_PASSWORD in .env!")

password = urllib.parse.quote_plus(raw_password)
DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
engine = create_engine(DATABASE_URL)

app = FastAPI(title="Clawjin Prism Real-Time Engine", version="2.4.0")

# Enable CORS so our frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health():
    return {"status": "online", "system": "Clawjin Prism™ Real-Time API Engine"}

# -------------------------------------------------------------
# 1. REAL ENDPOINT: GET LIVE METRICS DIRECTLY FROM DATABASE
# -------------------------------------------------------------
@app.get("/api/dashboard/metrics")
def get_live_metrics(days: int = 7):
    query = f"""
        select 
            date::text, 
            total_orders, 
            total_revenue, 
            total_ad_spend, 
            net_profit, 
            blended_roas, 
            blended_cac
        from analytics.fct_daily_unit_economics 
        where total_revenue > 0
        order by date desc 
        limit {days};
    """
    df = pd.read_sql(query, engine)
    
    total_rev = float(df['total_revenue'].sum())
    total_spend = float(df['total_ad_spend'].sum())
    total_profit = float(df['net_profit'].sum())
    total_orders = int(df['total_orders'].sum())
    
    return {
        "summary": {
            "gross_revenue": round(total_rev, 2),
            "total_ad_spend": round(total_spend, 2),
            "net_profit": round(total_profit, 2),
            "total_orders": total_orders,
            "blended_roas": round(total_rev / total_spend, 2) if total_spend > 0 else 0,
            "blended_cac": round(total_spend / total_orders, 2) if total_orders > 0 else 0
        },
        "daily_records": df.to_dict(orient="records")
    }

# -------------------------------------------------------------
# 2. REAL ENDPOINT: RECEIVE LIVE SHOPIFY WEBHOOK ORDERS
# -------------------------------------------------------------
@app.post("/api/webhooks/shopify/orders")
async def receive_live_shopify_order(request: Request):
    payload = await request.json()
    
    order_id = str(payload.get("order_id", f"ORD_{int(pd.Timestamp.now().timestamp())}"))
    customer_id = str(payload.get("customer_id", "CUST_LIVE_01"))
    revenue = float(payload.get("gross_revenue", 120.00))
    cogs = round(revenue * 0.35, 2)
    shipping = 5.50
    channel = payload.get("acquisition_channel", "Meta Ads")
    
    # Real SQL Insert into Supabase
    insert_query = text("""
        insert into public.raw_orders (order_id, customer_id, order_date, gross_revenue, cogs, shipping_cost, acquisition_channel, status)
        values (:order_id, :customer_id, now(), :gross_revenue, :cogs, :shipping_cost, :channel, 'Completed');
    """)
    
    with engine.begin() as conn:
        conn.execute(insert_query, {
            "order_id": order_id,
            "customer_id": customer_id,
            "gross_revenue": revenue,
            "cogs": cogs,
            "shipping_cost": shipping,
            "channel": channel
        })
        
    print(f"⚡ LIVE ORDER INGESTED: {order_id} | ${revenue:,.2f} | Customer: {customer_id}")
    return {"status": "success", "message": "Real order ingested into Supabase PostgreSQL", "order_id": order_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)