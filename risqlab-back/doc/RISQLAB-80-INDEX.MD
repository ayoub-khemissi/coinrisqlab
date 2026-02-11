# RisqLab 80 Index - Calculation Methodology

## Overview

The RisqLab 80 is a market-capitalization weighted cryptocurrency index that tracks the performance of the top 80 cryptocurrencies, excluding stablecoins, wrapped tokens, and staked tokens.

## Base Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Index Name** | RisqLab 80 | Official name of the index |
| **Base Level** | 100 | Starting index level |
| **Max Constituents** | 80 | Maximum number of cryptocurrencies in the index |
| **Update Frequency** | 15 minutes | Configurable recalculation interval |

## Calculation Methodology

### 1. Divisor Initialization

**Reference:** `calculateRisqLab80.js:74-148`

The divisor is calculated only during the first execution or when its value is still at the default of 1.0:

```
Divisor = Initial_Total_Market_Cap / Base_Level
Divisor = Initial_Market_Cap / 100
```

**Properties:**
- The divisor remains **constant** unless manually adjusted
- It serves as a normalization factor to anchor the index to the base level of 100
- Stored in the `index_config` table with the `base_date` timestamp

---

### 2. Constituent Selection

**Reference:** `calculateRisqLab80.js:153-212`

#### Step 2a: Market Data Retrieval
**Reference:** Lines 154-182

The system retrieves the most recent market data for all cryptocurrencies:

```sql
SELECT
  md.price_usd,
  md.circulating_supply,
  md.timestamp,
  cm.categories
FROM market_data md
WHERE (price_usd × circulating_supply) > 0
ORDER BY (price_usd × circulating_supply) DESC
```

**Filters applied:**
- Only cryptocurrencies with `Market Cap > 0`
- Latest timestamp per cryptocurrency
- Sorted by market capitalization (descending)

#### Step 2b: Exclusion Filtering
**Reference:** Lines 188-211

Cryptocurrencies are filtered through the `isExcluded()` function which excludes:

| Exclusion Type | Metadata Flag | Examples |
|----------------|---------------|----------|
| **Stablecoins** | categories includes "stablecoin" | USDT, USDC, DAI |
| **Wrapped Tokens** | categories includes "wrapped" | WBTC, WETH |
| **Staked** | categories includes "staking" or "staked" | stETH, rETH |

#### Step 2c: Final Selection

The top **80 cryptocurrencies** by market capitalization are selected after applying exclusion filters.

---

### 3. Total Market Capitalization

**Reference:** `calculateRisqLab80.js:35`

The total market capitalization of the index is calculated as:

```
Total_Market_Cap = Σ(i=1 to 80) [Price_USD[i] × Circulating_Supply[i]]
```

Where:
- `Price_USD[i]` = Current USD price of cryptocurrency i
- `Circulating_Supply[i]` = Number of tokens in circulation for cryptocurrency i

---

### 4. Index Level Calculation

**Reference:** `calculateRisqLab80.js:39`

The index level is calculated by dividing the total market capitalization by the divisor:

```
Index_Level = Total_Market_Cap / Divisor
```

**Complete formula:**

```
                    n=80
                    Σ  (P[i] × Q[i])
                   i=1
Index_Level = ─────────────────────────
                       D

Where:
  P[i] = USD price of cryptocurrency i
  Q[i] = Circulating supply of cryptocurrency i
  D    = Divisor (constant, calculated at initialization)
  n    = 80 constituents (after filtering)
```

---

### 5. Constituent Weights

**Reference:** `calculateRisqLab80.js:266-267`

Each constituent's weight in the index is calculated as its proportion of the total market cap:

```
Weight[i] = (Market_Cap[i] / Total_Market_Cap) × 100

Where:
  Market_Cap[i] = Price_USD[i] × Circulating_Supply[i]
```

Weights are expressed as **percentages** and sum to 100%.

---

## Data Storage

### Index History
**Table:** `index_history`

Stores each calculation with:
- Timestamp (from market data)
- Total market capitalization
- Index level
- Divisor used
- Number of constituents
- Calculation duration (milliseconds)

**Duplicate handling:** Uses `ON DUPLICATE KEY UPDATE` to avoid duplicate entries for the same timestamp.

### Index Constituents
**Table:** `index_constituents`

Stores for each constituent:
- Cryptocurrency ID
- Market data ID
- Rank position (1-80)
- Price USD
- Circulating supply
- Weight in index (%)

---

## Key Characteristics

### Index Type
**Market-Capitalization Weighted Index**

Similar to traditional indices like the S&P 500, where larger companies (cryptocurrencies) have proportionally greater influence on the index value.

### Advantages
- Reflects actual market size and liquidity
- Automatically adjusts to market movements
- No arbitrary weighting decisions

### Exclusions Rationale
- **Stablecoins:** Pegged to fiat currencies, don't reflect crypto market dynamics
- **Wrapped Tokens:** Derivative representations of existing assets
- **Staked:** Derivative tokens that would create double-counting

---

## Calculation Example

### Initial Setup
```
Assume 80 selected cryptocurrencies with:
Total_Market_Cap = $2,500,000,000,000 ($2.5T)
Base_Level = 100

Divisor = 2,500,000,000,000 / 100 = 25,000,000,000
```

### Subsequent Calculation
```
New Total_Market_Cap = $2,750,000,000,000 ($2.75T)
Divisor = 25,000,000,000 (constant)

Index_Level = 2,750,000,000,000 / 25,000,000,000 = 110
```

This represents a **10% increase** from the base level.

---

## Implementation Details

### Code Location
`risqlab-back/commands/calculateRisqLab80.js`

### Main Functions
- `calculateRisqLab80()` - Main orchestration function
- `getOrCreateIndexConfig()` - Manages divisor initialization
- `getMostRecentMarketData()` - Retrieves latest market data
- `selectConstituents()` - Applies filtering and selection logic
- `storeIndexHistory()` - Persists index calculation results
- `storeConstituents()` - Persists constituent data

### Dependencies
- Database connection (`../lib/database.js`)
- Logging utility (`../lib/log.js`)
- Exclusion logic (`../utils/exclusions.js`)

---

## Maintenance & Updates

### Rebalancing
The index automatically rebalances on each calculation:
- Constituents may enter/exit based on market cap ranking
- Weights adjust based on price movements
- No manual intervention required

### Divisor Adjustments
The divisor should only be manually adjusted for:
- Corporate actions (splits, mergers)
- Methodology changes
- Index reconstitution events

---

## References

- Index calculation implementation: `risqlab-back/commands/calculateRisqLab80.js`
- Exclusion logic: `risqlab-back/utils/exclusions.js`
- Database schema: `index_config`, `index_history`, `index_constituents` tables