# CoinRisqLab Crypto Dashboard

## Overview

CoinRisqLab is a web application designed to provide advanced analysis of the cryptocurrency market. It fetches real-time market data, calculates various financial metrics such as volatility and logarithmic returns, and presents them through an intuitive and clean user interface. The primary goal of the project is to offer users a tool to better understand and manage the risk associated with their crypto-assets.

The project is built as a monorepo, containing a Node.js backend for data processing and a Next.js frontend for the user interface.

## Architecture

The application is split into two main parts:

-   `coinrisqlab-back`: A Node.js/Express.js backend that serves as an API and runs scheduled jobs. It is responsible for:
    -   Fetching data from external cryptocurrency APIs.
    -   Performing financial calculations (volatility, returns, etc.).
    -   Storing and retrieving data from a MySQL database.
    -   Providing a REST API for the frontend.
-   `coinrisqlab-front`: A Next.js (React) application that provides the user interface. It is responsible for:
    -   Displaying cryptocurrency data in tables and charts.
    -   Providing a responsive and interactive user experience.
    -   Communicating with the backend API to get the data.

## Features

-   **Real-time Crypto Data:** Fetches and displays up-to-date market data for a wide range of cryptocurrencies.
-   **Advanced Metrics:** Calculates and displays:
    -   Logarithmic Returns
    -   Historical Volatility (daily, weekly, monthly)
    -   Portfolio Volatility
    -   A custom "CoinRisqLab 80" index.
-   **Market Sentiment:** Fetches and displays the Fear & Greed Index.
-   **Global Metrics:** Shows global cryptocurrency market metrics.
-   **Interactive UI:** A modern and responsive interface with tables, charts, and dark mode support.

## Technology Stack

### Backend (`coinrisqlab-back`)

-   **Runtime:** Node.js v20+ (using ES Modules)
-   **Framework:** Express.js
-   **Database:** MySQL
-   **Authentication:** JSON Web Tokens (JWT)
-   **Main Libraries:** `mysql2`, `jsonwebtoken`, `cors`, `dotenv`

### Frontend (`coinrisqlab-front`)

-   **Framework:** Next.js (v15+) / React (v18+)
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS with HeroUI components
-   **Charting:** Recharts
-   **Linting/Formatting:** ESLint, Prettier

## Prerequisites

-   Node.js (v20 or later recommended)
-   NPM or a compatible package manager
-   A running MySQL server

## Installation and Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd rql
    ```

2.  **Backend Setup:**
    -   Navigate to the backend directory: `cd coinrisqlab-back`
    -   Install dependencies: `npm install`
    -   Create a `.env` file by copying `.env.example`.
    -   Fill in the `.env` file with your database credentials, API keys, and JWT secret.
    -   Initialize the database by running the `sql/init.sql` script on your MySQL server.

3.  **Frontend Setup:**
    -   Navigate to the frontend directory: `cd ../coinrisqlab-front`
    -   Install dependencies: `npm install`
    -   Create a `.env` file by copying `.env.example`.
    -   Configure the `NEXT_PUBLIC_API_BASE_URL` to point to your backend server (e.g., `http://localhost:3001/api`).

## Running the Application

1.  **Start the Backend Server:**
    -   In the `coinrisqlab-back` directory, run:
    ```bash
    npm run dev
    ```
    This will start the server in development mode with `nodemon`, which automatically restarts on file changes. The server will typically run on the port specified in your `.env` file (e.g., 3001).

2.  **Start the Frontend Application:**
    -   In the `coinrisqlab-front` directory, run:
    ```bash
    npm run dev
    ```
    This will start the Next.js development server, usually on `http://localhost:3000`.

## Backend Commands

The backend includes a set of commands to perform data fetching and calculations. These can be run manually via `npm` scripts from the `coinrisqlab-back` directory. They are intended to be run as scheduled tasks (e.g., cron jobs) in a production environment.

-   `npm run fetch-crypto-data`: Fetches market data.
-   `npm run fetch-crypto-metadata`: Fetches cryptocurrency metadata.
-   `npm run fetch-global-metrics`: Fetches global market metrics.
-   `npm run fetch-fear-and-greed`: Fetches the Fear & Greed Index.
-   `npm run calculate-log-returns`: Calculates log returns.
-   `npm run calculate-crypto-volatility`: Calculates volatility for individual assets.
-   `npm run calculate-portfolio-volatility`: Calculates portfolio volatility.
-   `npm run calculate-index`: Calculates the CoinRisqLab 80 index.
-   `npm run update-volatility`: A combined script to update all volatility-related data.
-   `npm run update-all`: A comprehensive script to run all update tasks.
