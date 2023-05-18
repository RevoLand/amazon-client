const webSocket = {
  address: process.env.WEB_SOCKET_ADDRESS ?? 'ws://localhost:8080',
  secret: process.env.WEB_SOCKET_SECRET,
};

export default webSocket;