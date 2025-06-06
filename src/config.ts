import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';

const app = express();
const port = 9302;

app.use(bodyParser.json());

app.post('/postconfig', (req, res) => {
  const configData = req.body.config;
  if (configData) {
    const configDir = path.resolve('./config');
    const configPath = path.join(configDir, 'received_config.json');

    // Check if the config directory exists, and create it if it doesn't
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log('Config directory created.');
    }

    // Write the config data to the file
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    console.log('Config file created and data saved.');
    res.status(200).send('Config received and saved.');
  } else {
    res.status(400).send('Invalid config data.');
  }
});

export function configServer() {
  app.listen(port, () => {
    console.log(`API Config Server running at http://localhost:${port}`);
  });
}
