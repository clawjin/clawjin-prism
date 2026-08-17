import os
import requests
import logging
import pandas as pd
from typing import Optional
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [CLAWJIN-META] %(message)s")
logger = logging.getLogger("clawjin.meta")

class MetaAdsConnector:
    def __init__(self, ad_account_id: Optional[str] = None, access_token: Optional[str] = None):
        self.ad_account_id = ad_account_id or os.getenv("META_AD_ACCOUNT_ID", "")
        self.access_token = access_token or os.getenv("META_ACCESS_TOKEN", "")
        self.api_version = "v19.0"
        if self.ad_account_id and not self.ad_account_id.startswith("act_"):
            self.ad_account_id = f"act_{self.ad_account_id}"

    def fetch_daily_insights(self, days_back: int = 30) -> pd.DataFrame:
        if not self.ad_account_id or not self.access_token:
            logger.warning("Missing META_AD_ACCOUNT_ID or META_ACCESS_TOKEN. Running in offline mode.")
            return pd.DataFrame()

        start = (datetime.today() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        end = datetime.today().strftime('%Y-%m-%d')
        url = f"https://graph.facebook.com/{self.api_version}/{self.ad_account_id}/insights"
        params = {
            "access_token": self.access_token,
            "time_range": f'{{"since":"{start}","until":"{end}"}}',
            "time_increment": 1,
            "fields": "date_start,spend,impressions,clicks"
        }
        response = requests.get(url, params=params, timeout=30)
        if response.status_code != 200:
            raise Exception(f"Meta Graph API Error: {response.text}")

        records = []
        for i in response.json().get("data", []):
            records.append({
                "date": i.get("date_start"),
                "channel": "Meta Ads",
                "spend": float(i.get("spend", 0.0)),
                "clicks": int(i.get("clicks", 0)),
                "impressions": int(i.get("impressions", 0))
            })
        return pd.DataFrame(records)