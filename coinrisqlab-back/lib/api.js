import './console-stamp.js';
import express from 'express';
import { readFileSync } from 'fs';
import Config from '../utils/config.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const { COINRISQLAB_FRONT_HOSTNAME, COINRISQLAB_FRONT_HTTPSECURE, COINRISQLAB_FRONT_PORT } = Config;
const { version, description } = JSON.parse(readFileSync('package.json'));

const api = express();
api.use(express.json());
api.use(express.urlencoded({ extended: true }));
api.use(cookieParser());
api.use(
  cors({
    origin: `http${COINRISQLAB_FRONT_HTTPSECURE ? 's' : ''}://${COINRISQLAB_FRONT_HOSTNAME}${COINRISQLAB_FRONT_HTTPSECURE ? '' : `:${COINRISQLAB_FRONT_PORT}`}`,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type'],
    maxAge: 3600,
  })
);
api.disable('x-powered-by');

api.get('/', function (req, res) {
  res.status(200).send({
    data: { description: description, version: version },
    msg: 'The API is up!',
  });
});

export default api;
