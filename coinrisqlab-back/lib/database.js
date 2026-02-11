import mysql from 'mysql2';
import Config from '../utils/config.js';

const {
  COINRISQLAB_DB_HOST,
  COINRISQLAB_DB_PORT,
  COINRISQLAB_DB_USER,
  COINRISQLAB_DB_PASSWORD,
  COINRISQLAB_DB_DATABASE,
} = Config;

const pool = mysql.createPool({
  host: COINRISQLAB_DB_HOST,
  port: COINRISQLAB_DB_PORT,
  user: COINRISQLAB_DB_USER,
  password: COINRISQLAB_DB_PASSWORD,
  database: COINRISQLAB_DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});

export default pool.promise();
