import 'dotenv/config';
import logUpdate from 'log-update';
import Client from './components/Client.js';

export let client: Client;

const main = async () => {
  client = new Client();
  client.initialize();

  setInterval(() => {
    logUpdate(`
    Server: ${client.socket.url}
    Status: ${client.socket.readyState}
    Products: ${client.products.length}
    Captcha: ${client.captcha.size}
    `);
  }, 500);
};

main();
