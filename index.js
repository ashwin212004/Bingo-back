require('dotenv').config(); // Load environment variables

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { login, signup, getcoins, getLeaderboard } = require("./models/usercontroller");
const { handlemovepwc, gamewc, history, handlecomputermovepwc } = require("./models/gamecontroller");
const { Server } = require("socket.io");
const http = require("http");
const Gamef = require("./models/game");
const { checkBingo } = require("./models/muti");
const User = require("./models/usercontroller");

const port = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.post("/signup", signup);
app.post("/login", login);
app.get("/get-coins/:userId", getcoins);
app.get("/get-leaderboard", getLeaderboard);

// Play with Computer
app.post("/api/games", gamewc);
app.post("/api/games/:id/call-number", handlemovepwc);
app.post("/api/games/:id/computer-move",handlecomputermovepwc);


// History of a specific player
app.get("/history/:playerId/:username", history);
app.post("/deduct-coins", async (req, res) => {
    const { userId, amount } = req.body;
    
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.coins < amount) return res.status(400).json({ message: "Not enough coins" });

        user.coins -= amount;
        await user.save();
        
        res.json({ message: "Coins deducted successfully", newCoins: user.coins });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

let rooms = {};

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("createRoom", ({ roomId, username }) => {
        rooms[roomId] = {
            players: [{ username, board: generateBingoNumbers(), ready: false }],
            host: username,
            turn: username
        };
        socket.join(roomId);
        io.to(roomId).emit("updatePlayers", rooms[roomId]);
    });

    socket.on("joinRoom", ({ roomId, username }) => {
        if (!rooms[roomId]) return socket.emit("errorMessage", "Room does not exist!");

        const newPlayer = { username, board: generateBingoNumbers(), ready: false };
        rooms[roomId].players.push(newPlayer);
        socket.join(roomId);

        io.to(roomId).emit("updatePlayers", rooms[roomId]);

        socket.emit("gameUpdate", {
            updatedBoards: rooms[roomId].players.map(p => ({ username: p.username, board: p.board })),
            nextTurn: rooms[roomId].turn
        });
    });

   
    socket.on("playerReady", ({ roomId, username }) => {
        if (!rooms[roomId]) return;

        const player = rooms[roomId].players.find(p => p.username === username);
        if (player) {
            player.ready = true;
            io.to(roomId).emit("updatePlayers", rooms[roomId]);
        }
    });

    
    socket.on("startGame", async ({ roomId }) => {
        if (!rooms[roomId]) return;

        const game = new Gamef({ roomId, players: rooms[roomId].players });
        await game.save();
        io.to(roomId).emit("navigateToGame", { roomId });
    });

    
    socket.on("markNumber", async ({ roomId, index }) => {
        if (rooms[roomId]) {
            const currentTurn = rooms[roomId].turn;
            const player = rooms[roomId].players.find(p => p.username === currentTurn);
    
            if (!player) return;
    
            const numberToMark = player.board[index];
    
            
            rooms[roomId].players.forEach(p => {
                const numberIndex = p.board.findIndex(num => num === numberToMark);
                if (numberIndex !== -1) p.board[numberIndex] = "X";
            });
    
           
            const isBingo = checkBingo(player.board);
            if (isBingo) {
                io.to(roomId).emit("winner", player.username);
                await Gamef.updateOne({ roomId }, { $set: { winner: player.username, status: "finished" } });
                return;
            }
    
            
            const nextTurnIndex = (rooms[roomId].players.findIndex(p => p.username === currentTurn) + 1) % rooms[roomId].players.length;
            rooms[roomId].turn = rooms[roomId].players[nextTurnIndex].username;
    
            io.to(roomId).emit("gameUpdate", {
                updatedBoards: rooms[roomId].players.map(p => ({ username: p.username, board: p.board })),
                nextTurn: rooms[roomId].turn,
            });
        }
    });
    socket.on("sendEmoji", ({ roomId, username, emoji }) => {
        if (!rooms[roomId]) return;
        io.to(roomId).emit("emoji", { username, emoji });
    });
    socket.on("emoji", ({ username, emoji }) => {
        setEmojiMessages(prev => [...prev, { username, emoji }]);
    
        setTimeout(() => {
            setEmojiMessages(prev => prev.slice(1));
        }, 3000);
    });
   
socket.on("sendChatMessage", ({ roomId, username, message }) => {
    io.to(roomId).emit("chatMessage", { username, message });
});

    

    
    socket.on("disconnect", async () => {
        console.log("A user disconnected");
    
        for (const roomId in rooms) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.socketId !== socket.id);
    
            if (rooms[roomId].players.length === 0) {
                await Gamef.updateOne({ roomId }, { $set: { status: "incomplete" } });
                delete rooms[roomId]; 
            } else {
                io.to(roomId).emit("updatePlayers", rooms[roomId]);
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


const generateBingoNumbers = () => {
    const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
};
