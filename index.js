const express = require('express');
const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const AWS = require('aws-sdk');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

AWS.config.update({ region: 'us-west-2' });

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new WinstonCloudWatch({
      logGroupName: 'signals-analytics',
      logStreamName: 'signals-analytics-log',
      awsRegion: 'us-west-2',
    }),
  ],
});

app.post('/log', (req, res) => {
  const logData = req.body;

  if (!logData || !logData.message || !logData.level) {
    return res.status(400).json({ error: 'Invalid log data format' });
  }

  logger.log(logData.level, logData.message);

  res.status(200).json({ message: 'Log entry received and published to CloudWatch' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
