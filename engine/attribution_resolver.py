import re
from typing import Dict, Any

class ClawjinAttributionResolver:
    @staticmethod
    def resolve_order_attribution(landing_url: str = "", utm_source: str = "", order_tags: str = "") -> Dict[str, Any]:
        url = str(landing_url).lower() if landing_url else ""
        source = str(utm_source).lower() if utm_source else ""
        tags = str(order_tags).lower() if order_tags else ""

        if "amazon" in tags or "fba" in tags or "amz" in source:
            return {"channel": "Amazon Marketplace", "attribution_tier": "TIER_3_MARKETPLACE", "confidence_score": 1.0}

        if "fbclid=" in url:
            match = re.search(r'fbclid=([a-zA-Z0-9_-]+)', url)
            return {"channel": "Meta Ads", "attribution_tier": "TIER_1_CLICK_ID", "confidence_score": 0.95, "click_id": match.group(1) if match else None}

        if "gclid=" in url or "wbraid=" in url or "gbraid=" in url:
            match = re.search(r'gclid=([a-zA-Z0-9_-]+)', url)
            return {"channel": "Google Ads", "attribution_tier": "TIER_1_CLICK_ID", "confidence_score": 0.95, "click_id": match.group(1) if match else None}

        if "ttclid=" in url:
            match = re.search(r'ttclid=([a-zA-Z0-9_-]+)', url)
            return {"channel": "TikTok Ads", "attribution_tier": "TIER_1_CLICK_ID", "confidence_score": 0.95, "click_id": match.group(1) if match else None}

        if "facebook" in source or "fb" in source or "instagram" in source or "ig" in source:
            return {"channel": "Meta Ads", "attribution_tier": "TIER_2_UTM", "confidence_score": 0.80}

        if "google" in source or "pmax" in source or "youtube" in source:
            return {"channel": "Google Ads", "attribution_tier": "TIER_2_UTM", "confidence_score": 0.80}

        if "tiktok" in source:
            return {"channel": "TikTok Ads", "attribution_tier": "TIER_2_UTM", "confidence_score": 0.80}

        if "klaviyo" in source or "email" in source:
            return {"channel": "Organic, Direct & Klaviyo Email", "attribution_tier": "TIER_2_UTM_RETENTION", "confidence_score": 0.90}

        return {"channel": "Organic, Direct & Klaviyo Email", "attribution_tier": "TIER_4_DIRECT_ORGANIC", "confidence_score": 0.70}