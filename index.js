require('dotenv').config();
const express = require('express');
const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const AWS = require('aws-sdk');
const morgan = require('morgan');
const { ElasticsearchTransport } = require('winston-elasticsearch'); // Correct import for Elasticsearch transport
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
      logGroupName: process.env.CW_LOG_GROUP_NAME || 'signals-analytics',
      logStreamName: process.env.CW_LOG_STREAM_NAME || 'signals-analytics-log',
      awsRegion: process.env.AWS_REGION || 'us-west-2',
      jsonMessage: true,
    }),

    // OpenSearch Transport (winston-elasticsearch is a function)
    new ElasticsearchTransport({
      level: 'info',
      client: esClient,
      indexPrefix: process.env.ES_INDEX_PREFIX || 'signal-logs',
      transformer: (logData) => ({
        message: logData.message,
        level: logData.level,
        timestamp: logData.timestamp, // Directly passing timestamp
        meta: logData.meta, // Meta information
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

  // Validate the incoming log structure
  if (!logData || !logData.level || !logData.message || !logData.timestamp) {
    return res.status(400).json({ error: 'Invalid log data format' });
  }

  // Ensure that the timestamp is a valid Unix timestamp (in milliseconds)
  const timestamp = logData.timestamp ? new Date(logData.timestamp) : new Date();

  // Send the log data to both CloudWatch and OpenSearch
  logger.log(logData.level, logData.message, {
    timestamp: timestamp.toISOString(), // Convert timestamp to ISO format
    meta: logData.meta, // Pass meta data
  });

  res.status(200).json({ message: 'Log entry received and published to CloudWatch and OpenSearch' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
