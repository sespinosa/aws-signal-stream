require('dotenv').config();
const express = require('express');
const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const AWS = require('aws-sdk');
const morgan = require('morgan');
const ElasticsearchTransport = require('winston-elasticsearch');
const { Client } = require('@opensearch-project/opensearch');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(morgan('combined'));

AWS.config.update({ region: 'us-west-2' });

const esClient = new Client({
  node: process.env.ES_ENDPOINT,
  auth: {
    username: process.env.ES_USERNAME,
    password: process.env.ES_PASSWORD,
  },
});

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new WinstonCloudWatch({
      logGroupName: 'signals-analytics',
      logStreamName: 'signals-analytics-log',
      awsRegion: 'us-west-2',
    }),

    new ElasticsearchTransport({
      level: 'info',
      client: esClient,
      indexPrefix: 'signal-logs',
      transformer: (logData) => ({
        message: logData.message,
        level: logData.level,
        timestamp: logData.timestamp,
      }),
    }),
  ],
});

app.get('/', (req, res) => {
  res.status(200).json({ message: 'POST to /log' });
});

app.post('/log', (req, res) => {
  const logData = req.body;

  if (!logData || !logData.message || !logData.level) {
    return res.status(400).json({ error: 'Invalid log data format' });
  }

  logger.log(logData.level, logData.message);

  res.status(200).json({ message: 'Log entry received and published to CloudWatch and OpenSearch' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
