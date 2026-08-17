import os
import pandas as pd
from sqlalchemy import create_engine
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

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

class ClawjinAnomalySentinel:
    def __init__(self):
        self.engine = engine

    def scan_all_anomalies(self):
        alerts = []
        query_econ = """
            select date, total_orders, total_revenue, total_ad_spend, net_profit, blended_roas, blended_cac
            from analytics.fct_daily_unit_economics 
            where total_revenue > 0
            order by date desc 
            limit 30;
        """
        df_econ = pd.read_sql(query_econ, self.engine)
        
        if len(df_econ) >= 7:
            latest = df_econ.iloc[0]
            trailing = df_econ.iloc[1:8]
            avg_cac = trailing['blended_cac'].mean()
            
            if latest['blended_cac'] > (avg_cac * 1.20) and latest['total_orders'] > 5:
                diff_pct = ((latest['blended_cac'] - avg_cac) / avg_cac) * 100
                alerts.append({
                    "severity": "CRITICAL",
                    "title": f"Blended CAC surged +{diff_pct:.1f}% yesterday",
                    "action": "Audit underperforming ad sets on Meta & TikTok. Trim budget by 20%."
                })

            if latest['net_profit'] < 0:
                alerts.append({
                    "severity": "CRITICAL",
                    "title": f"Negative Net Cash Margin on {latest['date']}",
                    "action": "Immediate ad spend capping required to prevent working capital drain."
                })

        return alerts