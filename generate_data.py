import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

print("🚀 Generating 5,000 realistic e-commerce orders & ad spend...")

# Set random seed for reproducibility
np.random.seed(42)
n_orders = 5000
start_date = datetime(2025, 1, 1)

# Generate realistic customer data and orders
order_dates = [start_date + timedelta(days=random.randint(0, 180), minutes=random.randint(0, 1440)) for _ in range(n_orders)]
customer_ids = [f"CUST_{random.randint(1000, 2500)}" for _ in range(n_orders)]
channels = random.choices(
    ["Meta Ads", "Google Ads", "TikTok Ads", "Organic Search", "Email Retention"],
    weights=[0.40, 0.25, 0.15, 0.10, 0.10],
    k=n_orders
)

# Realistic order values ($35 to $250)
order_values = np.random.gamma(shape=5.0, scale=18.0, size=n_orders).round(2)
refund_status = random.choices(["Completed", "Refunded"], weights=[0.93, 0.07], k=n_orders)

df_orders = pd.DataFrame({
    "order_id": [f"ORD_{10000 + i}" for i in range(n_orders)],
    "customer_id": customer_ids,
    "order_date": order_dates,
    "gross_revenue": order_values,
    "cogs": (order_values * 0.32).round(2), # 32% Product Cost
    "shipping_cost": np.random.uniform(4.5, 9.5, n_orders).round(2),
    "acquisition_channel": channels,
    "status": refund_status
})

# Save to CSV
df_orders.to_csv("raw_shopify_orders.csv", index=False)
print("✅ SUCCESS: Saved 'raw_shopify_orders.csv' with 5,000 rows!")
print(f"📊 Total Revenue Simulated: ${df_orders['gross_revenue'].sum():,.2f}")