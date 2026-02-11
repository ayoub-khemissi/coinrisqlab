import api from './lib/api.js';
import log from './lib/log.js';
import config from './utils/config.js';

import './routes/cryptocurrencies.js';
import './routes/metrics.js';
import './routes/indexDetails.js';
import './routes/cryptoDetail.js';
import './routes/volatility.js';
import './routes/correlation.js';
import './routes/riskMetrics.js';

// eslint-disable-next-line
api.use((err, req, res, next) => {
  const originalUrl = req?.originalUrl || '';
  const errorMessage = err?.message || '';
  const stack = err?.stack || '';
  const msg = `Internal server error - Route ${originalUrl} - ${errorMessage}`;

  log.error(`${msg} - ${stack}`);

  res.status(err.status || 500).json({
    data: null,
    msg: msg,
  });
});

const { COINRISQLAB_API_HTTPSECURE, COINRISQLAB_API_HOSTNAME, COINRISQLAB_API_PORT } = config;

api.listen(COINRISQLAB_API_PORT, COINRISQLAB_API_HOSTNAME, async function () {
  log.info(
    `API listening on http${COINRISQLAB_API_HTTPSECURE ? 's' : ''}://${COINRISQLAB_API_HOSTNAME}:${COINRISQLAB_API_PORT}/.`
  );
});
