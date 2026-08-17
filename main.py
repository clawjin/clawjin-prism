import argparse
import logging
import subprocess
from connectors.shopify_connector import ShopifyConnector
from connectors.meta_ads_connector import MetaAdsConnector
from connectors.universal_importer import UniversalProductionImporter
from engine.pipeline_engine import ClawjinPipelineEngine
from engine.anomaly_sentinel import ClawjinAnomalySentinel
from engine.slack_dispatcher import ClawjinSlackDispatcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [CLAWJIN-CLI] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("clawjin.cli")

def main():
    parser = argparse.ArgumentParser(description="Clawjin Prism Enterprise Engine Orchestrator")
    parser.add_argument("--sync-shopify", action="store_true", help="Sync real live orders from Shopify Admin API")
    parser.add_argument("--sync-meta", action="store_true", help="Sync real ad spend from Meta Marketing Graph API")
    parser.add_argument("--import-csv", type=str, help="Import official Shopify or Amazon CSV export file")
    parser.add_argument("--run-dbt", action="store_true", help="Compile and execute all dbt analytics marts")
    parser.add_argument("--run-sentinel", action="store_true", help="Run 7-day statistical anomaly & profit leak scan")
    parser.add_argument("--dispatch-slack", action="store_true", help="Format and dispatch 8:00 AM executive briefing to Slack")

    args = parser.parse_args()
    pipeline = ClawjinPipelineEngine()

    if args.sync_shopify:
        shopify = ShopifyConnector()
        df = shopify.fetch_all_orders()
        if not df.empty:
            pipeline.ingest_orders_idempotent(df, source="Shopify_REST_API")

    elif args.sync_meta:
        meta = MetaAdsConnector()
        df_ads = meta.fetch_daily_insights()
        if not df_ads.empty:
            logger.info(f"Ingested {len(df_ads)} daily Meta ad spend records.")

    elif args.import_csv:
        df_csv = UniversalProductionImporter.import_shopify_export_csv(args.import_csv)
        pipeline.ingest_orders_idempotent(df_csv, source="Official_CSV_Export")

    elif args.run_dbt:
        logger.info("Compiling and executing dbt production analytics marts...")
        subprocess.run(["dbt", "run"], cwd="ecommerce_analytics")

    elif args.run_sentinel:
        sentinel = ClawjinAnomalySentinel()
        alerts = sentinel.scan_all_anomalies()
        logger.info(f"Sentinel scan complete. Active alerts: {len(alerts)}.")

    elif args.dispatch-slack:
        dispatcher = ClawjinSlackDispatcher()
        dispatcher.generate_and_dispatch_briefing()

    else:
        parser.print_help()

if __name__ == "__main__":
    main()