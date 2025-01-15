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

// Configure AWS SDK for CloudWatch
AWS.config.update({ region: process.env.AWS_REGION || 'us-west-2' });

// Initialize OpenSearch client with credentials from environment variables
const esClient = new Client({
  node: process.env.ES_ENDPOINT,  // OpenSearch endpoint
  auth: {
    username: process.env.ES_USERNAME,  // OpenSearch username
    password: process.env.ES_PASSWORD,  // OpenSearch password
  },
});

// Setup Winston logger with CloudWatch and OpenSearch
const logger = winston.createLogger({
  level: 'info',
  transports: [
    // CloudWatch Transport
    new WinstonCloudWatch({
      logGroupName: process.env.CW_LOG_GROUP_NAME || 'signals-analytics',  // CloudWatch log group
      logStreamName: process.env.CW_LOG_STREAM_NAME || 'signals-analytics-log',  // CloudWatch log stream
      awsRegion: process.env.AWS_REGION || 'us-west-2',  // AWS region for CloudWatch
    }),

    // OpenSearch Transport
    ElasticsearchTransport({
      level: 'info',
      client: esClient,
      indexPrefix: process.env.ES_INDEX_PREFIX || 'signal-logs',  // OpenSearch index prefix
      transformer: (logData) => ({
        message: logData.message,
        level: logData.level,
        timestamp: logData.timestamp,
      }),
    }),
  ],
});

// Route to display a message
app.get('/', (req, res) => {
  res.status(200).json({ message: 'POST to /log' });
});

// Route to receive logs and send them to CloudWatch and OpenSearch
app.post('/log', (req, res) => {
  const logData = req.body;

  if (!logData || !logData.message || !logData.level) {
    return res.status(400).json({ error: 'Invalid log data format' });
  }

  // Log entry to both CloudWatch and OpenSearch
  logger.log(logData.level, logData.message);

  res.status(200).json({ message: 'Log entry received and published to CloudWatch and OpenSearch' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
