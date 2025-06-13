import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import "./App.css"
const socket = io("http://192.168.0.189:5000");

function App() {
  const [stream, setStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const myVideo = useRef();
  const peersRef = useRef([]);

  useEffect(() => {
    // Get media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(mediaStream => {
      setStream(mediaStream);
      if (myVideo.current) {
        myVideo.current.srcObject = mediaStream;
      }

      // Connect to socket
      socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
      });

      // Another user joined after us
      socket.on("user-joined", userId => {
        if (peersRef.current.find(p => p.peerId === userId)) return;

        const peer = createPeer(userId, socket.id, mediaStream);
        peersRef.current.push({ peerId: userId, peer });
        setPeers(peers => [...peers, { peerId: userId, peer }]);
      });

      // Another user sent us their signal
      socket.on("receive-signal", ({ signal, callerId }) => {
        if (peersRef.current.find(p => p.peerId === callerId)) return;

        const peer = addPeer(signal, callerId, mediaStream);
        peersRef.current.push({ peerId: callerId, peer });
        setPeers(peers => [...peers, { peerId: callerId, peer }]);
      });

      socket.on("receive-return-signal", ({ signal, callerId }) => {
        const item = peersRef.current.find(p => p.peerId === callerId);
        if (item) {
          item.peer.signal(signal);
        }
      });
    });
    
    return () => {
      socket.disconnect();
      stream?.getTracks().forEach(track => track.stop());
      peersRef.current.forEach(({ peer }) => peer.destroy());
    };
  }, []);

  function joinCall() {
    socket.emit("join-call", "test-room");
  }

  function createPeer(userToSignal, callerId, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", signal => {
      socket.emit("send-signal", { userToSignal, signal, callerId });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerId, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", signal => {
      socket.emit("return-signal", { signal, callerId });
    });

    peer.signal(incomingSignal);
    return peer;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Video Chat</h2>
      <button onClick={joinCall}>Join Call</button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
        <video
          playsInline
          muted
          ref={myVideo}
          autoPlay
          style={{ width: "300px", border: "1px solid gray" }}
        />
        {peers.map(({ peerId, peer }) => (
          <Video key={peerId} peer={peer} />
        ))}
      </div>
    </div>
  );
}

function Video({ peer }) {
  const ref = useRef();

  useEffect(() => {
    peer.on("stream", stream => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });

    return () => {
      peer.removeAllListeners("stream");
    };
  }, [peer]);

  return (
    <video
      playsInline
      autoPlay
      ref={ref}
      style={{ width: "300px", border: "1px solid blue" }}
    />
  );
}

export default App;

