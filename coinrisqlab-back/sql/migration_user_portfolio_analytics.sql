-- Migration: User Portfolio Analytics Historization
-- Date: 2026-04-10
-- Description: Historize the analytics metrics displayed on /dashboard/portfolios/[id]/analytics
--              so that the business team can validate the calculations against the UI.
-- Impact: Additive only (CREATE TABLE IF NOT EXISTS) — zero downtime
--
-- Mirrors the pattern used for crypto/index metrics
-- (crypto_volatility, crypto_var, crypto_beta, portfolio_volatility, ...).
-- Unlike crypto metrics, user portfolios have dynamic composition: each row captures
-- the analytics computed with the holdings present at calculation time ("composition
-- courante") — same philosophy as user_portfolio_snapshots.

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- ============================================================================
-- 1. USER_PORTFOLIO_ANALYTICS — Daily analytics snapshot per portfolio
--    One row per (portfolio_id, date, window_days).
--    Stores the exact values served by /user/portfolios/:id/analytics-bundle
--    so the business can verify that what is displayed matches what is stored.
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_portfolio_analytics` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `portfolio_id` INT UNSIGNED NOT NULL,
    `date` DATE NOT NULL COMMENT 'Date for which analytics are calculated',
    `window_days` INT UNSIGNED NOT NULL DEFAULT 90 COMMENT 'Actual number of aligned data points used (capped at 90)',

    -- Portfolio snapshot at calculation time
    `total_value_usd` DECIMAL(40, 8) NOT NULL COMMENT 'Total portfolio value at calculation time',
    `num_holdings` INT UNSIGNED NOT NULL COMMENT 'Number of holdings in the portfolio at calculation time',
    `data_points` INT UNSIGNED NOT NULL COMMENT 'Number of aligned return observations used in calculations',

    -- Volatility (from covariance matrix)
    `daily_volatility` DECIMAL(20, 12) NULL COMMENT 'Daily portfolio volatility: sqrt(w^T * Σ * w)',
    `annualized_volatility` DECIMAL(20, 12) NULL COMMENT 'Annualized volatility (daily * sqrt(365))',
    `weighted_avg_volatility` DECIMAL(20, 12) NULL COMMENT 'Weighted average of constituent daily volatilities (for diversification benefit)',
    `diversification_benefit` DECIMAL(20, 12) NULL COMMENT '(weighted_avg - portfolio_vol) / weighted_avg (%)',

    -- Synthetic portfolio returns stats (from w^T * r per day)
    `mean_daily_return` DECIMAL(20, 12) NULL COMMENT 'Mean of synthetic portfolio daily log returns',
    `daily_std` DECIMAL(20, 12) NULL COMMENT 'Std dev of synthetic portfolio daily log returns',
    `min_return` DECIMAL(20, 12) NULL,
    `max_return` DECIMAL(20, 12) NULL,
    `annualized_return` DECIMAL(20, 12) NULL COMMENT 'mean_daily_return * 365',

    -- VaR / CVaR (historical, from sorted portfolio returns)
    `var_95` DECIMAL(20, 12) NULL COMMENT 'Historical VaR 95% (positive = loss)',
    `var_99` DECIMAL(20, 12) NULL,
    `cvar_95` DECIMAL(20, 12) NULL COMMENT 'Expected Shortfall 95%',
    `cvar_99` DECIMAL(20, 12) NULL,

    -- Distribution
    `skewness` DECIMAL(20, 12) NULL COMMENT 'Fisher skewness of portfolio returns',
    `kurtosis` DECIMAL(20, 12) NULL COMMENT 'Excess kurtosis (Fisher) of portfolio returns',

    -- Risk-adjusted performance
    `sharpe_ratio` DECIMAL(20, 12) NULL COMMENT 'Annualized Sharpe ratio (Rf = 0)',

    -- Portfolio Beta — two definitions are kept for full traceability
    `portfolio_beta_weighted` DECIMAL(20, 12) NULL COMMENT 'Weighted sum of constituent betas (Σ w_i * β_i)',
    `beta_regression` DECIMAL(20, 12) NULL COMMENT 'Beta from OLS regression of portfolio returns vs CoinRisqLab 80 returns',
    `alpha_regression` DECIMAL(20, 12) NULL COMMENT 'Alpha from the same OLS regression (daily intercept)',
    `r_squared` DECIMAL(20, 12) NULL COMMENT 'R² of the OLS regression',
    `correlation_with_index` DECIMAL(20, 12) NULL COMMENT 'Pearson correlation with CoinRisqLab 80 returns',
    `beta_alpha_observations` INT UNSIGNED NULL COMMENT 'Number of aligned (portfolio, index) observations used for the regression',

    -- Correlation matrix of constituents (stored as JSON for convenience)
    -- Shape: { "symbols": [...], "matrix": [[...], ...] }
    `correlation_matrix` JSON NULL COMMENT 'Pearson correlation matrix of constituent returns',

    -- Metadata
    `calculation_duration_ms` INT UNSIGNED NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY `fk_upa_portfolio_idx` (`portfolio_id`) REFERENCES `user_portfolios`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_portfolio_date_window` (`portfolio_id`, `date`, `window_days`),
    KEY `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. USER_PORTFOLIO_ANALYTICS_CONSTITUENTS — Per-holding breakdown at calc time
--    Stores the exact composition that was used to compute the parent row.
--    Mirrors portfolio_volatility_constituents.
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_portfolio_analytics_constituents` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_portfolio_analytics_id` BIGINT UNSIGNED NOT NULL,
    `crypto_id` INT UNSIGNED NOT NULL,
    `weight` DECIMAL(20, 12) NOT NULL COMMENT 'Weight in portfolio (current_value / totalValue). 0 if price unavailable.',
    `quantity` DECIMAL(30, 18) NOT NULL COMMENT 'Quantity held at calculation time',
    `avg_buy_price` DECIMAL(30, 18) NULL COMMENT 'Average buy price (from user_portfolio_holdings)',
    `current_price` DECIMAL(30, 18) NULL COMMENT 'Latest market price used. NULL if no market_data for this crypto.',
    `current_value_usd` DECIMAL(40, 8) NULL COMMENT 'quantity * current_price. NULL if current_price is NULL.',
    `daily_volatility` DECIMAL(20, 12) NULL COMMENT 'Std dev of this constituent log returns over the window',
    `annualized_volatility` DECIMAL(20, 12) NULL COMMENT 'daily * sqrt(365)',
    `beta` DECIMAL(20, 12) NULL COMMENT 'Latest beta pulled from crypto_beta at calculation time',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_upac_analytics_idx` (`user_portfolio_analytics_id`) REFERENCES `user_portfolio_analytics`(`id`) ON DELETE CASCADE,
    FOREIGN KEY `fk_upac_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_analytics_crypto` (`user_portfolio_analytics_id`, `crypto_id`),
    KEY `idx_crypto_id` (`crypto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
