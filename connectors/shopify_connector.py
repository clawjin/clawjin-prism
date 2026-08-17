import os
import requests
import logging
import pandas as pd
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [CLAWJIN-SHOPIFY] %(message)s")
logger = logging.getLogger("clawjin.shopify")

class ShopifyConnector:
    def __init__(self, shop_domain: Optional[str] = None, access_token: Optional[str] = None):
        self.shop_domain = shop_domain or os.getenv("SHOPIFY_SHOP_DOMAIN", "")
        self.access_token = access_token or os.getenv("SHOPIFY_ACCESS_TOKEN", "")
        self.api_version = "2024-01"
        if self.shop_domain and not self.shop_domain.endswith(".myshopify.com"):
            self.shop_domain = f"{self.shop_domain}.myshopify.com"

    def fetch_orders(self, limit: int = 250) -> pd.DataFrame:
        if not self.shop_domain or not self.access_token:
            logger.warning("Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ACCESS_TOKEN. Running in webhook mode.")
            return pd.DataFrame()

        url = f"https://{self.shop_domain}/admin/api/{self.api_version}/orders.json"
        headers = {"X-Shopify-Access-Token": self.access_token, "Content-Type": "application/json"}
        response = requests.get(url, headers=headers, params={"status": "any", "limit": limit}, timeout=30)
        
        if response.status_code != 200:
            raise Exception(f"Shopify API Error {response.status_code}: {response.text}")

        orders_raw = response.json().get("orders", [])
        records = []
        for o in orders_raw:
            cust = o.get("customer") or {}
            price = float(o.get("total_price", 0.0))
            records.append({
                "order_id": str(o.get("id")),
                "customer_id": f"CUST_{cust.get('id', 'GUEST')}",
                "order_date": o.get("created_at"),
                "gross_revenue": price,
                "cogs": round(price * 0.35, 2),
                "shipping_cost": float(o.get("total_shipping_price_set", {}).get("shop_money", {}).get("amount", 5.0)),
                "acquisition_channel": str(o.get("source_name", "Shopify Web")),
                "status": "Refunded" if o.get("financial_status") == "refunded" else "Completed"
            })
        return pd.DataFrame(records)