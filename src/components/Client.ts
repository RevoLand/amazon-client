import { CloseEvent, ErrorEvent, RawData, WebSocket } from 'ws';
import webSocket from '../config/webSocket';
import { wait } from '../helpers/common';
import productParser from './product/productParser';

class Client {
  socket: WebSocket;

  private heartbeatTimeout: NodeJS.Timeout;

  private heartbeat = () => {
    clearTimeout(this.heartbeatTimeout);

    this.heartbeatTimeout = setTimeout(() => {
      this.socket?.terminate();
    }, 15000 + 2000);
  };

  private handleServerMessage = async (data: RawData) => {
    try {
      const messageObject: {
        type: string;
        value: string;
        channelId: string;
      } = JSON.parse(data.toString());

      if (messageObject.type === 'begin-tracking') {
        const beginTrackingObject: {
          productId: number,
          url: string
        } = JSON.parse(messageObject.value);

        this.socket.send(JSON.stringify({
          type: 'begin-tracking-handshake',
          value: beginTrackingObject.productId
        }), async () => {
          const productParserResult = await productParser(beginTrackingObject.url);

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
        const productParserResult = await productParser(messageObject.value);

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
