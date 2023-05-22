import 'dotenv/config';
import logUpdate from 'log-update';
import Client from './components/Client.js';

export let client: Client;

const main = async () => {
  client = new Client();
  client.initialize();

  setInterval(() => {
    logUpdate(`
    Socket Server: ${client.socket.url}
    Socket Status: ${client.socket.readyState}
    Product Tracking Queue: ${client.products.length}
    Captcha Queue: ${client.captcha.size}

    Last Response: ${client.lastResponse?.toString()}
    `);
  }, 500);
};

main();
