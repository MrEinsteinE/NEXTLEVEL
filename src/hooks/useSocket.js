import { useEffect } from 'react';
import { socket, connectSocket, disconnectSocket } from '../utils/socket';

export const useSocket = () => {
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    let user = null;
    try { user = JSON.parse(userStr); } catch (e) {}

    if (user && (user.id || user._id)) {
      connectSocket(user);
      // Join the correct room by role so realtime events actually reach this user.
      // (Previously everyone — including mentors — joined a student room, so
      // mentors never received 'mentors' broadcasts like new pending stories.)
      if (user.role === 'mentor') socket.emit('join-mentor-room');
      else socket.emit('join-student-room', user.id || user._id);
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, []);

  return socket;
};
