import pandas as pd

print("🚀 Initializing Clawjin US/UK E-Commerce Prospect Database...")

# High-growth US/UK DTC Shopify Verticals
target_categories = [
    {
        "niche": "Apparel & Activewear",
        "brands": [
            ("Vuori", "vuoriclothing.com"),
            ("Cuts Clothing", "cutsclothing.com"),
            ("True Classic", "trueclassictees.com"),
            ("Ten Thousand", "tenthousand.cc"),
            ("Rhone", "rhone.com"),
            ("Western Rise", "westernrise.com"),
            ("Chubbies", "chubbiesshorts.com"),
            ("Bylt Basics", "byltbasics.com"),
            ("Gymshark", "gymshark.com"),
            ("Alo Yoga", "aloyoga.com")
        ]
    },
    {
        "niche": "Health & Functional Nutrition",
        "brands": [
            ("Athletic Greens", "drinkag1.com"),
            ("Liquid I.V.", "liquid-iv.com"),
            ("Magic Spoon", "magicspoon.com"),
            ("Olipop", "drinkolipop.com"),
            ("Huel", "huel.com"),
            ("Mud/Wtr", "mudwtr.com"),
            ("Beam TLC", "shopbeam.com"),
            ("Seed Health", "seed.com"),
            ("Gainful", "gainful.com"),
            ("Barebells", "barebells.com")
        ]
    },
    {
        "niche": "Beauty, Skincare & Grooming",
        "brands": [
            ("Glossier", "glossier.com"),
            ("Drunk Elephant", "drunkelephant.com"),
            ("KraveBeauty", "kravebeauty.com"),
            ("Hero Cosmetics", "herocosmetics.us"),
            ("Ilia Beauty", "iliabeauty.com"),
            ("Tower 28", "tower28beauty.com"),
            ("Merit Beauty", "meritbeauty.com"),
            ("Youth To The People", "youthtothepeople.com"),
            ("Summer Fridays", "summerfridays.com"),
            ("Oak Essentials", "oakessentials.com")
        ]
    },
    {
        "niche": "Modern Home & Consumer Tech",
        "brands": [
            ("Our Place", "fromourplace.com"),
            ("Caraway Home", "carawayhome.com"),
            ("Ridge Wallet", "ridge.com"),
            ("Fellow Products", "fellowproducts.com"),
            ("Nomad Goods", "nomadgoods.com"),
            ("Boll & Branch", "bollandbranch.com"),
            ("Brooklinen", "brooklinen.com"),
            ("Ruggable", "ruggable.com"),
            ("Cozy Earth", "cozyearth.com"),
            ("Branch Furniture", "branchfurniture.com")
        ]
    }
]

rows = []
for category in target_categories:
    niche_name = category["niche"]
    for brand_name, domain in category["brands"]:
        linkedin_search = f"site:linkedin.com/in/ \"{brand_name}\" (\"Founder\" OR \"CEO\" OR \"Head of Growth\" OR \"VP Marketing\")"
        rows.append({
            "Company Name": brand_name,
            "Niche": niche_name,
            "Website": f"https://www.{domain}",
            "Target Title": "Founder / CEO / Head of Growth",
            "Decision Maker Name": "",
            "Verified Email": "",
            "LinkedIn Search Link": f"https://www.google.com/search?q={linkedin_search.replace(' ', '+').replace('\"', '%22')}",
            "Clawjin Pitch Angle": "Automated cohort retention & daily Slack unit economics vs. manual spreadsheets",
            "Status": "Not Contacted",
            "Custom Notes": ""
        })

df = pd.DataFrame(rows)
df.to_csv("clawjin_us_prospects.csv", index=False)

print(f"✅ SUCCESS: Created 'clawjin_us_prospects.csv' with {len(df)} initial high-ticket US/UK target brands!")
print("📊 Each record includes direct 1-click Google/LinkedIn decision-maker search links.")