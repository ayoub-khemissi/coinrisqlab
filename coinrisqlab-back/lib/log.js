import './console-stamp.js';
import Config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from './database.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const { COINRISQLAB_LOG_LEVEL, COINRISQLAB_LOG_DIRECTORY_PATH } = Config;
const { APP_ID, LOG_LEVEL_DEBUG, LOG_LEVEL_INFO, LOG_LEVEL_WARN, LOG_LEVEL_ERROR } = Constants;
const { name, version } = JSON.parse(readFileSync('package.json'));

class Log {
  /**
   * Constructor for the Log class.
   *
   * Initializes the app instance ID and sets up the log directory.
   */
  constructor() {
    this.appInstanceId = null;
    this.setupLogDirectory();
  }

  /**
   * Sets up the log directory if it doesn't exist.
   */
  setupLogDirectory() {
    if (!existsSync(COINRISQLAB_LOG_DIRECTORY_PATH)) {
      mkdirSync(COINRISQLAB_LOG_DIRECTORY_PATH, { recursive: true });
    }
  }

  /**
   * Logs a debug message
   * @param {string} text - The message to log
   */
  async debug(text) {
    if (!this.appInstanceId) {
      await this.setupAppInstanceId();
    }

    if (COINRISQLAB_LOG_LEVEL > LOG_LEVEL_DEBUG) {
      return;
    }

    console.debug(`%c${text}`, 'color:gray');
    this.saveLog(LOG_LEVEL_DEBUG, text);
  }

  /**
   * Logs an informational message
   * @param {string} text - The message to log
   */
  async info(text) {
    if (!this.appInstanceId) {
      await this.setupAppInstanceId();
    }

    if (COINRISQLAB_LOG_LEVEL > LOG_LEVEL_INFO) {
      return;
    }

    console.info(`%c${text}`, 'color:white');
    this.saveLog(LOG_LEVEL_INFO, text);
  }

  /**
   * Logs a warning message
   * @param {string} text - The message to log
   */
  async warn(text) {
    if (!this.appInstanceId) {
      await this.setupAppInstanceId();
    }

    if (COINRISQLAB_LOG_LEVEL > LOG_LEVEL_WARN) {
      return;
    }

    console.warn(`%c${text}`, 'color:yellow');
    this.saveLog(LOG_LEVEL_WARN, text);
  }

  /**
   * Logs an error message
   * @param {string} text - The message to log
   */
  async error(text) {
    if (!this.appInstanceId) {
      await this.setupAppInstanceId();
    }

    if (COINRISQLAB_LOG_LEVEL > LOG_LEVEL_ERROR) {
      return;
    }

    console.error(`%c${text}`, 'color:red');
    this.saveLog(LOG_LEVEL_ERROR, text);
  }

  /**
   * Saves a log entry to the database with the specified level and text.
   * @param {number} level - The severity level of the log message.
   * @param {string} text - The message to be logged.
   */
  saveLog(level, text) {
    try {
      const values = [this.appInstanceId, level, String(text), Date.now()];
      const query =
        'INSERT INTO log (app_instance_id, level, text, created_at) VALUES (?, ?, ?, ?)';
      Database.execute(query, values);
    } catch (error) {
      console.error('@Log:saveLog - an error occurred: ' + error);
    }

    try {
      const now = new Date();

      const date = now.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);

      switch (level) {
        case LOG_LEVEL_DEBUG:
          level = 'DEBUG';
          break;
        case LOG_LEVEL_INFO:
          level = 'INFO';
          break;
        case LOG_LEVEL_WARN:
          level = 'WARN';
          break;
        case LOG_LEVEL_ERROR:
          level = 'ERROR';
          break;
        default:
          level = 'UNKNOWN';
          break;
      }

      const logFile = `${COINRISQLAB_LOG_DIRECTORY_PATH}/${name}-${version}-${date.split(' ')[0]}.log`;
      const logEntry = `[${date}][${level}] ${text}\n`;

      writeFileSync(logFile, logEntry, { flag: 'a' });
    } catch (error) {
      console.error('@Log:saveLog - an error occurred: ' + error);
    }
  }

  /**
   * Sets the ID of the app instance to associate with log entries.
   */
  async setupAppInstanceId() {
    const values = [APP_ID, version, Date.now()];
    const query = 'INSERT INTO app_instance (app_id, version, created_at) VALUES (?, ?, ?)';
    const [result] = await Database.execute(query, values);

    if (result.affectedRows > 0) {
      this.appInstanceId = result.insertId;
    } else {
      const error = new Error('Failed to setup app instance for logging.');
      console.error('@Log:setupAppInstanceId - an error occurred: ' + error);
      throw error;
    }
  }
}

export default new Log();
