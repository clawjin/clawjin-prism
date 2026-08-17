import os
import logging
import requests
import pandas as pd
from sqlalchemy import create_engine, text
import urllib.parse
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [CLAWJIN-SLACK] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("clawjin.slack")

load_dotenv()
user = os.getenv("DB_USER")
raw_password = os.getenv("DB_PASSWORD")
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT", "6543")
dbname = os.getenv("DB_NAME", "postgres")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

if not raw_password:
    raise ValueError("Missing DB_PASSWORD in environment.")

password = urllib.parse.quote_plus(raw_password)
DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
engine = create_engine(DATABASE_URL)

class ClawjinSlackDispatcher:
    def __init__(self, webhook_url: str = None):
        self.webhook_url = webhook_url or SLACK_WEBHOOK_URL
        self.engine = engine

    def generate_and_dispatch_briefing(self) -> dict:
        logger.info("Generating verified 8:00 AM Executive Intelligence Briefing...")
        query = text("""
            SELECT date::text, total_orders, gross_revenue, total_ad_spend, net_cash_profit, marketing_efficiency_ratio, blended_cac
            FROM analytics.fct_marketing_efficiency_ratio 
            WHERE gross_revenue > 0 ORDER BY date DESC LIMIT 1;
        """)
        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn)

        if df.empty:
            logger.warning("No transactional data found for briefing.")
            return {"status": "skipped"}

        latest = df.iloc[0]
        logger.info(f"Briefing: Sales: ${latest['gross_revenue']:,.2f} | Net Profit: +${latest['net_cash_profit']:,.2f} | MER: {latest['marketing_efficiency_ratio']}x")
        return {"status": "success", "data": latest.to_dict()}

if __name__ == "__main__":
    ClawjinSlackDispatcher().generate_and_dispatch_briefing()