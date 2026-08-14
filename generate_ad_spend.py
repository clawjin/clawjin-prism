import pandas as pd
import numpy as np
from datetime import datetime, timedelta

print("🚀 Generating Daily Meta & Google Ad Spend...")

start_date = datetime(2025, 1, 1)
days = 181
channels = ["Meta Ads", "Google Ads", "TikTok Ads"]

records = []
for day in range(days):
    current_date = (start_date + timedelta(days=day)).strftime('%Y-%m-%d')
    for channel in channels:
        if channel == "Meta Ads":
            spend = round(np.random.uniform(400, 1200), 2)
            clicks = int(spend * np.random.uniform(1.2, 2.5))
        elif channel == "Google Ads":
            spend = round(np.random.uniform(250, 700), 2)
            clicks = int(spend * np.random.uniform(0.8, 1.8))
        else: # TikTok Ads
            spend = round(np.random.uniform(150, 450), 2)
            clicks = int(spend * np.random.uniform(2.0, 4.0))
            
        impressions = int(clicks * np.random.uniform(15, 35))
        records.append({
            "date": current_date,
            "channel": channel,
            "spend": spend,
            "clicks": clicks,
            "impressions": impressions
        })

df_ads = pd.DataFrame(records)
df_ads.to_csv("raw_ad_spend.csv", index=False)

print("✅ SUCCESS: Saved 'raw_ad_spend.csv'!")
print(f"💰 Total Ad Spend Simulated: ${df_ads['spend'].sum():,.2f}")