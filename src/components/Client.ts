import { randomInt } from 'crypto';
import { CloseEvent, ErrorEvent, RawData, WebSocket } from 'ws';
import webSocket from '../config/webSocket.js';
import { wait } from '../helpers/common.js';
import productParser from './product/productParser.js';

class Client {
  socket: WebSocket;

  captcha: Map<string, string> = new Map();

  products: {
    productId: number,
    url: string
  }[] = [];

  lastResponse?: Date;

  private heartbeatTimeout: NodeJS.Timeout;

  private heartbeat = () => {
    clearTimeout(this.heartbeatTimeout);

    this.heartbeatTimeout = setTimeout(() => {
      this.socket?.terminate();
    }, 15000 + 2000);
  };

  private handleServerMessage = async (serverMessage: RawData) => {
    this.lastResponse = new Date();

    try {
      const messageObject: {
        type: string;
        value: string;
        data: string;
        channelId: string;
      } = JSON.parse(serverMessage.toString());

      if (messageObject.type === 'begin-tracking') {
        const beginTrackingObject: {
          productId: number,
          url: string
        } = JSON.parse(messageObject.value);

        this.products.push(beginTrackingObject);

        this.socket.send(JSON.stringify({
          type: 'begin-tracking-handshake',
          value: beginTrackingObject.productId
        }), async () => {
          const productParserResult = await productParser(beginTrackingObject.url);

          this.products = this.products.filter(product => product.productId !== beginTrackingObject.productId);

          if (!productParserResult) {
            return;
          }

          this.socket.send(JSON.stringify({
            type: 'track-result',
            value: beginTrackingObject.productId,
            data: JSON.stringify(productParserResult)
          }));
        });
      }

      if (messageObject.type === 'create-tracking') {
        const beginTrackingObject: {
          productId: number,
          url: string
        } = {
          url: messageObject.value,
          productId: randomInt(Number.MAX_SAFE_INTEGER - 1000, Number.MAX_SAFE_INTEGER)
        };

        this.products.push(beginTrackingObject);

        const productParserResult = await productParser(messageObject.value);

        this.products = this.products.filter(product => product.productId !== beginTrackingObject.productId);

        if (!productParserResult) {
          return;
        }

        this.socket.send(JSON.stringify({
          type: 'create-result',
          value: messageObject.value,
          data: JSON.stringify(productParserResult),
          channelId: messageObject.channelId
        }));
      }

      if (messageObject.type === 'captcha-answer') {
        this.captcha.set(messageObject.data, messageObject.value);
      }
    } catch (error) {
      console.error('Error parsing message from Server: ', error);
    }
  };

  initialize = () => {
    this.socket = new WebSocket(webSocket.address, {
      headers: {
        'authorization': webSocket.secret
      }
    });

    this.socket.on('error', async (error: CloseEvent | ErrorEvent) => {
      console.error('hata', error);
    });

    this.socket.on('open', this.heartbeat);
    this.socket.on('ping', this.heartbeat);

    this.socket.on('message', this.handleServerMessage);

    this.socket.on('close', async () => {
      clearTimeout(this.heartbeatTimeout);

      this.socket.removeAllListeners();

      await wait(5000);

      this.initialize();
    });
  };
}

export default Client;
