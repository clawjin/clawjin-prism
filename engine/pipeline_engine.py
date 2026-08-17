import os
import time
import random
import pandas as pd
from sqlalchemy import create_engine, text
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

class ClawjinPipelineEngine:
    """
    Enterprise Ingestion Engine:
    - Guaranteed Unique Indexes on order_id
    - Idempotent UPSERT & Deduplication
    - Dead-Letter Queue (DLQ) with Transaction Isolation
    """
    def __init__(self):
        self.engine = engine
        self._ensure_infrastructure()

    def _ensure_infrastructure(self):
        """Creates unique constraints & DLQ quarantine table."""
        with self.engine.begin() as conn:
            # 1. Create DLQ Table
            conn.execute(text("""
                create table if not exists public.error_quarantine_dlq (
                    id serial primary key,
                    failed_at timestamp default now(),
                    source_system varchar(50),
                    raw_payload text,
                    error_reason text
                );
            """))

            # 2. Ensure Unique Index on raw_orders(order_id) for ON CONFLICT
            conn.execute(text("""
                create unique index if not exists idx_raw_orders_order_id 
                on public.raw_orders (order_id);
            """))

            # 3. Ensure Unique Index on raw_ad_spend(date, channel)
            conn.execute(text("""
                create unique index if not exists idx_raw_ad_spend_date_channel 
                on public.raw_ad_spend (date, channel);
            """))

    def ingest_orders_idempotent(self, df_orders: pd.DataFrame, source="Shopify"):
        """
        Idempotent Batch Upsert with per-row isolation:
        Corrupt rows go to DLQ without aborting the main database transaction.
        """
        print(f"📦 [INGESTION] Processing {len(df_orders)} records from {source}...")
        successful = 0
        quarantined = 0

        upsert_sql = text("""
            insert into public.raw_orders (
                order_id, customer_id, order_date, gross_revenue, 
                cogs, shipping_cost, acquisition_channel, status
            ) values (
                :order_id, :customer_id, :order_date, :gross_revenue, 
                :cogs, :shipping_cost, :acquisition_channel, :status
            )
            on conflict (order_id) do update set
                status = excluded.status,
                gross_revenue = excluded.gross_revenue,
                cogs = excluded.cogs,
                shipping_cost = excluded.shipping_cost;
        """)

        for _, row in df_orders.iterrows():
            try:
                order_id = str(row['order_id']).strip()
                cust_id = str(row['customer_id']).strip()
                rev = float(row['gross_revenue'])
                cogs = float(row.get('cogs', rev * 0.35))
                ship = float(row.get('shipping_cost', 5.0))
                chan = str(row.get('acquisition_channel', 'Organic / Direct'))
                status = str(row.get('status', 'Completed'))
                dt = str(row['order_date'])

                with self.engine.begin() as conn:
                    conn.execute(upsert_sql, {
                        "order_id": order_id,
                        "customer_id": cust_id,
                        "order_date": dt,
                        "gross_revenue": rev,
                        "cogs": cogs,
                        "shipping_cost": ship,
                        "acquisition_channel": chan,
                        "status": status
                    })
                successful += 1

            except Exception as e:
                quarantined += 1
                try:
                    with self.engine.begin() as err_conn:
                        err_conn.execute(text("""
                            insert into public.error_quarantine_dlq (source_system, raw_payload, error_reason)
                            values (:source, :payload, :err);
                        """), {
                            "source": source,
                            "payload": str(row.to_dict()),
                            "err": str(e)
                        })
                except Exception:
                    pass

        print(f"✓ [INGESTION COMPLETE] {successful} Processed Successfully | {quarantined} Quarantined to DLQ.")
        return {"successful": successful, "quarantined": quarantined}

if __name__ == "__main__":
    pipeline = ClawjinPipelineEngine()
    print("✓ Clawjin Pipeline Engine initialized with unique indexes.")