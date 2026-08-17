import logging
from typing import Dict

logger = logging.getLogger("clawjin.currency")
DEFAULT_FX_RATES: Dict[str, float] = {
    "USD": 1.0, 
    "EUR": 1.08, 
    "GBP": 1.28, 
    "CAD": 0.74, 
    "AUD": 0.65, 
    "INR": 0.0119
}

class ClawjinCurrencyNormalizer:
    def __init__(self, base_currency: str = "USD"):
        self.base_currency = base_currency.upper()
        self.fx_rates = DEFAULT_FX_RATES

    def normalize_amount(self, amount: float, from_currency: str) -> float:
        curr = str(from_currency).upper().strip()
        if curr == self.base_currency:
            return round(amount, 2)
        return round(amount * self.fx_rates.get(curr, 1.0), 2)