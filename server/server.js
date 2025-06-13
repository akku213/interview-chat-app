const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // allow all origins for testing
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on("connection", socket => {
  console.log("New client connected:", socket.id);

  socket.on("join-call", roomId => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    rooms[roomId].push(socket.id);

    const otherUsers = rooms[roomId].filter(id => id !== socket.id);
    otherUsers.forEach(userId => {
      socket.to(userId).emit("user-joined", socket.id);
    });

    socket.on("send-signal", payload => {
      io.to(payload.userToSignal).emit("receive-signal", {
        signal: payload.signal,
        callerId: payload.callerId
      });
    });

    socket.on("return-signal", payload => {
      io.to(payload.callerId).emit("receive-return-signal", {
        signal: payload.signal,
        callerId: socket.id
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        }
      }
    });
  });
});

server.listen(5000, '0.0.0.0', ()  => {
  console.log("Server is running on port 5000");
});
