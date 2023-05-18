import 'dotenv/config';
import Client from './components/Client';
import { WebSocket } from 'ws';
import { wait } from './helpers/common';

export let client: Client;

const main = async () => {
  client = new Client();
  client.initialize();

  while (client.socket.readyState !== WebSocket.OPEN) {
    console.log('Socket bağlantısı gerçekleştirilene kadar bekliyoruz!');
    await wait(5000);
  }

  console.log('Socket bağlantısı başarılı bir şekilde gerçekleşti!', client.socket.readyState);
};

main();
