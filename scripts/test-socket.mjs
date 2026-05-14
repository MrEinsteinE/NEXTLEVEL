import axios from 'axios';
import { io } from 'socket.io-client';

const API = 'http://localhost:5000';

async function main() {
  try {
    console.log('Requesting mentor login...');
    const res = await axios.post(`${API}/api/auth/mentor-login`, {
      email: 'mentor-test@example.com',
      password: process.env.MENTOR_MASTER_PASSWORD || 'changeme'
    });

    const token = res.data.token;
    console.log('Received token:', token ? `${token.slice(0, 20)}...` : 'none');

    const socket = io(API, { transports: ['websocket'], auth: { token } });

    socket.on('connect', () => {
      console.log('Socket connected', socket.id);
      socket.emit('join-mentor-room');
      console.log('Emitted join-mentor-room');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect_error', err.message);
      process.exit(1);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected', reason);
    });

    socket.onAny((event, ...args) => {
      console.log('Socket event:', event, args);
    });

    // Keep alive for 10s to observe server-side logs
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log('Closing socket');
    socket.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error during test:', err.response?.data || err.message || err);
    process.exit(1);
  }
}

await main();
