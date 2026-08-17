import argparse
import logging
import subprocess
from connectors.shopify_connector import ShopifyConnector
from connectors.meta_ads_connector import MetaAdsConnector
from engine.pipeline_engine import ClawjinPipelineEngine
from engine.anomaly_sentinel import ClawjinAnomalySentinel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [CLAWJIN-CLI] %(message)s")
logger = logging.getLogger("clawjin.cli")

def main():
    parser = argparse.ArgumentParser(description="Clawjin Prism Enterprise Engine Orchestrator")
    parser.add_argument("--sync-shopify", action="store_true", help="Sync real live orders from Shopify API")
    parser.add_argument("--sync-meta", action="store_true", help="Sync ad spend from Meta Graph API")
    parser.add_argument("--run-dbt", action="store_true", help="Compile and execute dbt analytics marts")
    parser.add_argument("--run-sentinel", action="store_true", help="Run 7-day anomaly & profit leak scan")

    args = parser.parse_args()
    pipeline = ClawjinPipelineEngine()

    if args.sync_shopify:
        shopify = ShopifyConnector()
        df = shopify.fetch_orders()
        if not df.empty:
            pipeline.ingest_orders_idempotent(df, source="Shopify_API")

    elif args.sync_meta:
        meta = MetaAdsConnector()
        df_ads = meta.fetch_daily_insights()
        if not df_ads.empty:
            logger.info(f"Ingested {len(df_ads)} daily Meta ad spend records.")

    elif args.run_dbt:
        logger.info("Compiling and executing dbt production marts...")
        subprocess.run(["dbt", "run"], cwd="ecommerce_analytics")

    elif args.run_sentinel:
        sentinel = ClawjinAnomalySentinel()
        alerts = sentinel.scan_all_anomalies()
        logger.info(f"Sentinel scan finished. Active alerts: {len(alerts)}.")

    else:
        parser.print_help()

if __name__ == "__main__":
    main()