import os
import time
import random
import logging
import pandas as pd
from sqlalchemy import create_engine, text
import urllib.parse
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [CLAWJIN-PIPELINE] %(message)s")
logger = logging.getLogger("clawjin.pipeline")

load_dotenv()
user = os.getenv("DB_USER")
raw_password = os.getenv("DB_PASSWORD")
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT", "6543")
dbname = os.getenv("DB_NAME", "postgres")

password = urllib.parse.quote_plus(raw_password)
DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20, pool_pre_ping=True)

class ClawjinPipelineEngine:
    def __init__(self):
        self.engine = engine
        self._ensure_infrastructure()

    def _ensure_infrastructure(self):
        with self.engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS public.error_quarantine_dlq (
                    id SERIAL PRIMARY KEY,
                    failed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    source_system VARCHAR(50) NOT NULL,
                    raw_payload TEXT,
                    error_reason TEXT
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS public.raw_orders (
                    order_id VARCHAR(100) PRIMARY KEY,
                    customer_id VARCHAR(100) NOT NULL,
                    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
                    gross_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                    cogs NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                    shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                    taxes NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                    discounts NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                    acquisition_channel VARCHAR(100) NOT NULL DEFAULT 'Organic / Direct',
                    status VARCHAR(50) NOT NULL DEFAULT 'Completed',
                    landing_site TEXT,
                    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS public.raw_ad_spend (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL,
                    channel VARCHAR(50) NOT NULL,
                    campaign_id VARCHAR(100) NOT NULL DEFAULT 'default_campaign',
                    campaign_name VARCHAR(255),
                    spend NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                    impressions BIGINT NOT NULL DEFAULT 0,
                    clicks BIGINT NOT NULL DEFAULT 0,
                    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    CONSTRAINT uq_ad_spend_date_channel_campaign UNIQUE (date, channel, campaign_id)
                );
            """))

    def ingest_orders_idempotent(self, df_orders: pd.DataFrame, source="Shopify", chunk_size=250):
        if df_orders.empty:
            return {"successful": 0, "quarantined": 0}

        logger.info(f"Ingestion started: {len(df_orders)} records from '{source}' (Chunk Size: {chunk_size}).")
        successful = 0
        quarantined = 0

        upsert_sql = text("""
            INSERT INTO public.raw_orders (
                order_id, customer_id, order_date, gross_revenue, 
                cogs, shipping_cost, taxes, discounts, acquisition_channel, 
                status, landing_site, currency
            ) VALUES (
                :order_id, :customer_id, :order_date, :gross_revenue, 
                :cogs, :shipping_cost, :taxes, :discounts, :acquisition_channel, 
                :status, :landing_site, :currency
            )
            ON CONFLICT (order_id) DO UPDATE SET
                status = EXCLUDED.status,
                gross_revenue = EXCLUDED.gross_revenue,
                cogs = EXCLUDED.cogs,
                shipping_cost = EXCLUDED.shipping_cost,
                taxes = EXCLUDED.taxes,
                discounts = EXCLUDED.discounts,
                acquisition_channel = EXCLUDED.acquisition_channel;
        """)

        for start_idx in range(0, len(df_orders), chunk_size):
            chunk = df_orders.iloc[start_idx:start_idx + chunk_size]
            batch_params = []
            
            for _, row in chunk.iterrows():
                try:
                    order_id = str(row['order_id']).strip()
                    cust_id = str(row['customer_id']).strip()
                    rev = float(row['gross_revenue'])
                    cogs = float(row.get('cogs', rev * 0.35))
                    ship = float(row.get('shipping_cost', 0.0))
                    taxes = float(row.get('taxes', 0.0))
                    disc = float(row.get('discounts', 0.0))
                    chan = str(row.get('acquisition_channel', 'Organic / Direct'))
                    status = str(row.get('status', 'Completed'))
                    landing = str(row.get('landing_site', ''))
                    curr = str(row.get('currency', 'USD'))
                    dt = str(row['order_date'])

                    batch_params.append({
                        "order_id": order_id, "customer_id": cust_id, "order_date": dt,
                        "gross_revenue": rev, "cogs": cogs, "shipping_cost": ship,
                        "taxes": taxes, "discounts": disc, "acquisition_channel": chan,
                        "status": status, "landing_site": landing, "currency": curr
                    })
                except Exception as row_err:
                    quarantined += 1
                    with self.engine.begin() as err_conn:
                        err_conn.execute(text("INSERT INTO public.error_quarantine_dlq (source_system, raw_payload, error_reason) VALUES (:s, :p, :e);"), {
                            "s": source, "p": str(row.to_dict()), "e": str(row_err)
                        })

            if batch_params:
                try:
                    with self.engine.begin() as conn:
                        conn.execute(upsert_sql, batch_params)
                    successful += len(batch_params)
                except Exception as batch_err:
                    logger.warning(f"Batch execution failed, falling back to per-row isolation: {batch_err}")
                    for single_item in batch_params:
                        try:
                            with self.engine.begin() as single_conn:
                                single_conn.execute(upsert_sql, single_item)
                            successful += 1
                        except Exception as single_err:
                            quarantined += 1
                            with self.engine.begin() as err_conn:
                                err_conn.execute(text("INSERT INTO public.error_quarantine_dlq (source_system, raw_payload, error_reason) VALUES (:s, :p, :e);"), {
                                    "s": source, "p": str(single_item), "e": str(single_err)
                                })

        logger.info(f"Ingestion finished: {successful} successful, {quarantined} quarantined to DLQ.")
        return {"successful": successful, "quarantined": quarantined}