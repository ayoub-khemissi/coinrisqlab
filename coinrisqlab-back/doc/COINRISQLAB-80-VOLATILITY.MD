# CoinRisqLab 80 Volatility - Calculation Methodology

## Overview

The CoinRisqLab 80 Volatility system calculates risk metrics for both individual cryptocurrencies and the CoinRisqLab 80 Index portfolio. The methodology uses logarithmic returns and implements a rolling window approach to measure historical volatility with proper market-cap weighting and full covariance matrix calculations for portfolio-level risk.

## Base Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Window Period** | 90 days | Rolling window for volatility calculations |
| **Return Type** | Logarithmic | Natural logarithm of price ratios |
| **Annualization Factor** | √365 ≈ 19.10 | Assumes 365 trading days per year (crypto markets 24/7) |
| **Minimum Data Points** | 90 observations | Required for volatility calculation |
| **Index Name** | CoinRisqLab 80 | Target index for portfolio volatility |

## Calculation Pipeline

The volatility calculation follows a three-stage pipeline:

```
Stage 1: Log Returns Calculation
    ↓
Stage 2: Individual Crypto Volatility
    ↓
Stage 3: Portfolio Volatility (Index Level)
```

---

## Stage 1: Logarithmic Returns Calculation

**Reference:** `calculateLogReturns.js`

### Purpose
Calculate daily logarithmic returns for all cryptocurrencies to enable volatility and correlation analysis.

### Methodology

#### Step 1.1: Data Selection
**Reference:** Lines 61-72

For each cryptocurrency, retrieve daily closing prices:

```sql
SELECT
  price_date as date,
  price_usd,
  timestamp
FROM market_data
WHERE crypto_id = ?
  AND price_usd > 0
GROUP BY price_date
HAVING timestamp = MAX(timestamp)
ORDER BY price_date ASC
```

**Selection criteria:**
- Latest price for each day (end-of-day snapshot)
- Only positive prices (`price_usd > 0`)
- Ordered chronologically

#### Step 1.2: Log Return Calculation
**Reference:** Lines 83-100

For each consecutive pair of days:

```
Log_Return[t] = ln(Price[t] / Price[t-1])
             = ln(Price[t]) - ln(Price[t-1])
```

**Where:**
- `Price[t]` = Current day's closing price
- `Price[t-1]` = Previous day's closing price
- `ln()` = Natural logarithm function

**Properties of logarithmic returns:**
- Time-additive: Returns over multiple periods sum algebraically
- Approximately equal to percentage changes for small movements
- Symmetric: A gain and loss of the same magnitude produce equal absolute log returns
- Better statistical properties for normal distribution assumptions

#### Step 1.3: Data Storage
**Reference:** Lines 103-107

Stored in `crypto_log_returns` table:
- `crypto_id` - Cryptocurrency identifier
- `date` - Date of the return observation
- `log_return` - Calculated logarithmic return
- `price_current` - Current day's price
- `price_previous` - Previous day's price

---

## Stage 2: Individual Cryptocurrency Volatility

**Reference:** `calculateCryptoVolatility.js`

### Purpose
Calculate rolling volatility for individual cryptocurrencies using historical log returns.

### Methodology

#### Step 2.1: Rolling Window Setup
**Reference:** Lines 61-81

For each cryptocurrency with sufficient data (≥90 log returns):

```
Window[i] = [Return[i-89], Return[i-88], ..., Return[i]]
```

The calculation uses a sliding window of exactly 90 consecutive daily log returns.

#### Step 2.2: Statistical Calculations
**Reference:** Lines 96-104

For each window:

**a) Mean Return:**
```
μ = (1/n) × Σ(i=1 to n) r[i]

Where:
  n = 90 (window size)
  r[i] = log return for day i
```

**b) Daily Volatility (Standard Deviation):**
```
σ_daily = √[(1/(n-1)) × Σ(i=1 to n) (r[i] - μ)²]
```

This is the sample standard deviation of log returns over the window period. The division by `n-1` is known as **Bessel's Correction**, providing an unbiased estimate from a data sample.

**c) Annualized Volatility:**
```
σ_annual = σ_daily × √365

Where:
  365 = assumed trading days per year (crypto markets open 24/7)
```

The square root of time rule applies under the assumption of independent and identically distributed returns.

#### Step 2.3: Data Storage
**Reference:** Lines 107-111

Stored in `crypto_volatility` table:
- `crypto_id` - Cryptocurrency identifier
- `date` - End date of the rolling window
- `window_days` - Size of the rolling window (90)
- `daily_volatility` - Daily volatility (σ_daily)
- `annualized_volatility` - Annualized volatility (σ_annual)
- `num_observations` - Number of returns in window
- `mean_return` - Mean return over the window

---

## Stage 3: Portfolio Volatility (Index Level)

**Reference:** `calculatePortfolioVolatility.js`

### Purpose
Calculate the volatility of the CoinRisqLab 80 Index portfolio using market-cap weights and the full covariance matrix to account for correlations between constituents.

### Methodology

#### Step 3.1: Constituent Selection
**Reference:** Lines 183-206

For each index calculation date, retrieve the constituents:

```sql
SELECT
  ic.crypto_id,
  ic.price_usd,
  ic.circulating_supply,
  (ic.price_usd * ic.circulating_supply) as market_cap_usd
FROM index_constituents ic
INNER JOIN index_history ih ON ic.index_history_id = ih.id
WHERE ih.index_config_id = ?
  AND ih.timestamp = ?
```

This ensures volatility is calculated using the exact constituents that were in the index at that specific date.

#### Step 3.2: Log Returns Retrieval
**Reference:** Lines 211-237

For each constituent, retrieve the most recent 90 log returns (up to the calculation date):

```sql
SELECT log_return
FROM crypto_log_returns
WHERE crypto_id = ?
  AND date <= ?
ORDER BY date DESC
LIMIT 90
```

**Validation:**
- Only constituents with ≥90 log returns are included
- At least 10 constituents must have sufficient data

#### Step 3.3: Weight Calculation
**Reference:** Lines 131-137

Weights are based on market capitalization:

```
w[i] = MarketCap[i] / Σ(j=1 to n) MarketCap[j]

Where:
  MarketCap[i] = Price[i] × CirculatingSupply[i]
  n = number of valid constituents
```

**Weight validation:**
```
Σ(i=1 to n) w[i] = 1.0 (should sum to 100%)
```

#### Step 3.4: Covariance Matrix Construction
**Reference:** Lines 139-145

Build the covariance matrix for all constituent pairs:

```
Cov(i,j) = (1/(T-1)) × Σ(t=1 to T) [(r[i,t] - μ[i]) × (r[j,t] - μ[j])]

Where:
  r[i,t] = log return of asset i at time t
  μ[i] = mean log return of asset i
  T = 90 (window size)
```

The use of `T-1` is Bessel's correction for sample covariance, ensuring an unbiased estimate.

The covariance matrix is an n×n symmetric matrix where:
- Diagonal elements: variances of individual assets
- Off-diagonal elements: covariances between asset pairs
- Captures correlation structure of the portfolio

#### Step 3.5: Portfolio Volatility Calculation
**Reference:** Lines 147-149

Using modern portfolio theory:

```
σ²_portfolio = w' × Σ × w

Where:
  w = column vector of weights [w₁, w₂, ..., wₙ]'
  Σ = covariance matrix (n×n)
  w' = transpose of weight vector
```

**Expanded form:**
```
σ²_portfolio = Σ(i=1 to n) Σ(j=1 to n) w[i] × w[j] × Cov(i,j)
```

**Daily Portfolio Volatility:**
```
σ_portfolio_daily = √(σ²_portfolio)
```

**Annualized Portfolio Volatility:**
```
σ_portfolio_annual = σ_portfolio_daily × √365
```

#### Step 3.6: Individual Constituent Volatilities
**Reference:** Lines 242-271

For each constituent, calculate standalone volatility from its returns:

```
Variance[i] = (1/T) × Σ(t=1 to T) (r[i,t] - μ[i])²

σ_daily[i] = √Variance[i]

σ_annual[i] = σ_daily[i] × √365
```

#### Step 3.7: Data Storage
**Reference:** Lines 154-173

**Main portfolio volatility** stored in `portfolio_volatility` table:
- `index_config_id` - Index configuration ID
- `date` - Calculation date
- `window_days` - Rolling window size (90)
- `daily_volatility` - Daily portfolio volatility
- `annualized_volatility` - Annualized portfolio volatility
- `num_constituents` - Number of constituents included
- `total_market_cap_usd` - Total market cap of included constituents
- `calculation_duration_ms` - Processing time

**Constituent details** stored in `portfolio_volatility_constituents` table:
- `portfolio_volatility_id` - Link to main portfolio record
- `crypto_id` - Cryptocurrency identifier
- `weight` - Market cap weight in portfolio (0-1)
- `daily_volatility` - Constituent's daily volatility
- `annualized_volatility` - Constituent's annualized volatility
- `market_cap_usd` - Constituent's market capitalization

---

## Mathematical Formulas Summary

### Logarithmic Return
```
r[t] = ln(P[t] / P[t-1])
```

### Mean Return
```
μ = (1/n) × Σr[i]
```

### Variance
```
σ² = (1/(n-1)) × Σ(r[i] - μ)²
```

### Standard Deviation (Volatility)
```
σ = √σ²
```

### Annualization
```
σ_annual = σ_daily × √365
```

### Covariance
```
Cov(X,Y) = (1/(n-1)) × Σ[(x[i] - μ_x) × (y[i] - μ_y)]
```

### Portfolio Variance (Matrix Form)
```
σ²_p = w' × Σ × w = Σ Σ w[i] × w[j] × Cov(i,j)
              i j
```

### Correlation Coefficient
```
ρ(X,Y) = Cov(X,Y) / (σ_X × σ_Y)
```

**Note on Formulas:** The formulas for variance and covariance use a divisor of `n-1`. This is **Bessel's Correction**, applied because the calculations are based on a sample of data, not the entire population. This provides an unbiased estimate.

---

## Diversification Benefit

The portfolio volatility calculation accounts for diversification:

```
σ_portfolio ≤ Σw[i] × σ[i]
```

The portfolio volatility is typically **less than** the weighted average of individual volatilities due to imperfect correlations between assets. This diversification benefit is captured through the covariance matrix.

---

## Data Flow Diagram

```
Market Data (Prices)
        ↓
[calculateLogReturns.js]
        ↓
crypto_log_returns table
        ↓
        ├─→ [calculateCryptoVolatility.js]
        │           ↓
        │   crypto_volatility table
        │
        └─→ [calculatePortfolioVolatility.js]
                    ↓
            ┌───────┴────────┐
            ↓                ↓
  portfolio_volatility   portfolio_volatility_constituents
```

---

## Calculation Example

### Example 1: Individual Crypto Volatility

**Given:** Bitcoin (BTC) with 90-day log returns

```
Day 1: Price = $40,000 → $42,000, r₁ = ln(42000/40000) = 0.0488
Day 2: Price = $42,000 → $41,000, r₂ = ln(41000/42000) = -0.0241
...
Day 90: Price = $45,000 → $46,000, r₉₀ = ln(46000/45000) = 0.0220

Mean return: μ = 0.0015
Standard deviation: σ_daily = 0.03 (3% per day)
Annualized volatility: σ_annual = 0.03 × √365 = 0.573 (57.3%)
```

### Example 2: Portfolio Volatility

**Given:** 2-asset portfolio for simplicity

```
Asset 1 (BTC): weight = 0.60, σ₁ = 0.03
Asset 2 (ETH): weight = 0.40, σ₂ = 0.04
Correlation: ρ = 0.70

Covariance matrix:
Σ = [σ₁²           ρ×σ₁×σ₂  ]
    [ρ×σ₁×σ₂       σ₂²      ]

  = [0.0009         0.00084  ]
    [0.00084        0.0016   ]

Portfolio variance:
σ²_p = [0.6  0.4] × [0.0009    0.00084] × [0.6]
                     [0.00084   0.0016 ]   [0.4]

     = [0.6  0.4] × [0.000876]
                     [0.001144]

     = 0.000983

Daily portfolio volatility:
σ_p = √0.000983 = 0.0313 (3.13% per day)

Annualized portfolio volatility:
σ_p_annual = 0.0313 × √365 = 0.598 (59.8%)
```

**Note:** The portfolio volatility (59.8%) is less than the weighted average of individual volatilities (60% × 57.3% + 40% × 76.4% = 64.9%), demonstrating diversification benefit.

---

## Implementation Details

### Execution Order

The commands must be executed in sequence:

1. **First:** `calculateLogReturns.js`
   - Processes all cryptocurrencies
   - Generates foundational return data

2. **Second:** `calculateCryptoVolatility.js`
   - Depends on log returns
   - Can run independently for individual metrics

3. **Third:** `calculatePortfolioVolatility.js`
   - Depends on log returns
   - Requires index constituents data
   - Most computationally intensive

### Scheduling

**Recommended schedule:**
```
Daily (after market data fetch):
  1. calculateLogReturns.js      (5-10 minutes)
  2. calculateCryptoVolatility.js (10-20 minutes)
  3. calculatePortfolioVolatility.js (20-40 minutes)
```

### Performance Considerations

**calculateLogReturns.js:**
- O(n × m) where n = cryptos, m = days
- One query per crypto
- Relatively fast (~100 cryptos in < 1 minute)

**calculateCryptoVolatility.js:**
- O(n × m × w) where w = window size (90)
- Rolling window calculations
- Moderate speed (~100 cryptos in 5-10 minutes)

**calculatePortfolioVolatility.js:**
- O(d × c²) where d = dates, c = constituents (80)
- Covariance matrix: O(c²) per date
- Most intensive (~100 dates in 20-40 minutes)
- Bottleneck: Matrix operations on 80×80 covariance matrices

---

## Key Assumptions

### Statistical Assumptions

1. **Returns Distribution:** Log returns are approximately normally distributed
2. **Independence:** Daily returns are independent (no autocorrelation)
3. **Stationarity:** Volatility is stationary within the 90-day window
4. **Market Efficiency:** Prices reflect all available information
5. **Calendar Convention:** 365 trading days per year for annualization (crypto markets operate 24/7)

### Limitations

1. **Historical Volatility:** Based on past data, not predictive of future volatility
2. **Fixed Window:** 90-day window may not capture regime changes
3. **Normal Distribution:** Fat tails and skewness in crypto returns may violate normality
4. **Linear Correlations:** Covariance captures only linear relationships
5. **No Intraday Data:** Uses daily closes, misses intraday volatility

---

## Validation Checks

### Data Quality

**Log Returns:**
- Check for extreme values (|r| > 0.5 suggests data issues)
- Verify no missing dates in sequences
- Ensure prices are positive

**Volatility:**
- Daily volatility typically: 0.01 - 0.10 (1-10%)
- Annualized volatility typically: 15% - 150%
- Values outside these ranges warrant investigation

**Risk Level Classification:**
Based on rigorous analytical standards calibrated for cryptocurrency markets:

| Risk Level | Annualized Volatility | Daily Volatility | Color Code | Description |
|------------|---------------------|------------------|------------|-------------|
| **Low** | < 10% | < 0.5% | 🟢 Green | Stable mature cryptos, low risk |
| **Medium** | 10% - 30% | 0.5% - 1.5% | 🟡 Yellow | Moderate volatility, established assets with fluctuations |
| **High** | 30% - 60% | 1.5% - 3.0% | 🟠 Orange | High volatility, speculative assets or unstable phases |
| **Extreme** | ≥ 60% | ≥ 3.0% | 🔴 Red | Extreme volatility, high-risk altcoins or strong market turbulence |

**Mathematical Relationship:**
The daily/annualized conversion follows the formula: σ_annual = σ_daily × √365
(for markets active 7 days/week)

**Market Context:**
- Major cryptocurrencies like Bitcoin and Ethereum typically oscillate between Medium and High
- Less liquid altcoins often exceed 60% annualized, justifying the Extreme category
- Thresholds are calibrated to recent analytical studies and empirical market reality

**Implementation note:** This classification is used throughout the application for:
- Portfolio risk level indicators
- Individual cryptocurrency volatility badges
- Risk contribution analysis
- Dashboard volatility gauge (with mode switching between annualized and daily)

**Portfolio Metrics:**
- Weights must sum to 1.0
- Portfolio volatility < max(individual volatilities)
- Portfolio volatility > min(individual volatilities) × highest_weight

### Sanity Checks

```javascript
// Weight validation (calculatePortfolioVolatility.js:135-137)
const weightSum = weights.reduce((a, b) => a + b, 0);
assert(Math.abs(weightSum - 1.0) < 0.0001, 'Weights must sum to 1.0');

// Volatility bounds
assert(portfolioVol > 0 && portfolioVol < 1, 'Daily volatility out of bounds');
```

---

## References

### Code Locations
- Log returns: `coinrisqlab-back/commands/calculateLogReturns.js`
- Crypto volatility: `coinrisqlab-back/commands/calculateCryptoVolatility.js`
- Portfolio volatility: `coinrisqlab-back/commands/calculatePortfolioVolatility.js`

### Utility Functions
- Statistics library: `coinrisqlab-back/utils/statistics.js`
  - `logReturn()` - Calculate logarithmic return
  - `mean()` - Calculate arithmetic mean
  - `standardDeviation()` - Calculate standard deviation
  - `annualizeVolatility()` - Multiply by √365
  - `buildCovarianceMatrix()` - Construct covariance matrix
  - `portfolioVolatility()` - Matrix multiplication for portfolio variance
  - `validateWeights()` - Ensure weights sum to 1.0

### Database Schema
- `crypto_log_returns` - Daily log returns per cryptocurrency
- `crypto_volatility` - Rolling volatility per cryptocurrency
- `portfolio_volatility` - Index-level portfolio volatility
- `portfolio_volatility_constituents` - Constituent-level details

### Academic References
- Modern Portfolio Theory (Markowitz, 1952)
- Efficient Market Hypothesis
- ARCH/GARCH models for volatility clustering
- Risk metrics in cryptocurrency markets

---

## Future Enhancements

### Potential Improvements

1. **Multiple Window Sizes:** 30, 60, 180-day windows for different time horizons
2. **EWMA Volatility:** Exponentially weighted moving average for recency bias
3. **GARCH Models:** Capture volatility clustering and mean reversion
4. **Realized Volatility:** Use intraday data when available
5. **VaR/CVaR:** Value at Risk and Conditional Value at Risk metrics
6. **Downside Volatility:** Focus on negative returns only
7. **Beta Calculation:** Systematic risk relative to market/index
8. **Correlation Matrices:** Store and track correlation changes over time

### Advanced Analytics

1. **Volatility Forecasting:** Predictive models for future volatility
2. **Regime Detection:** Identify high/low volatility periods
3. **Stress Testing:** Scenario analysis for extreme market conditions
4. **Attribution Analysis:** Decompose portfolio risk by constituent
5. **Factor Models:** Multi-factor risk decomposition
