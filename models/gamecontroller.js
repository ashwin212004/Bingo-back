const mongoose = require("mongoose");
const User = require("./usercontroller");
const Gamef = require("./game");
const gameSchema = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    opponent: { type: String, default: "computer" },
    board: [{
        number: { type: Number, required: true },
        markedBy: { type: String, enum: ["player", "computer", null], default: null }
    }],
    status: { type: String, default: "in-progress" },
    gameResult: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('game', gameSchema);


const generateBingoNumbers = () => {
    const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    // Return objects with number and markedBy field
    return numbers.map(number => ({ number, markedBy: null }));
};
  
const checkBingo = (board) => {
    const winningCombinations = [
        [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14],
        [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
        [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22],
        [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
        [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
    ];

    let bingoCount = 0;

    winningCombinations.forEach(combination => {
        if (combination.every(index => board[index].markedBy !== null)) {
            bingoCount++;
        }
    });

    return bingoCount;
};


  
  module.exports.gamewc= async (req, res) => {
    try {
        const { playerId } = req.body;
        const newGame = new Game({
            playerId,
            board: generateBingoNumbers(),
            status: "in-progress"
        });
        await newGame.save();
        res.status(201).json(newGame);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
  };

  module.exports.handlemovepwc = async (req, res) => {
    try {
        const { id } = req.params;
        const { number } = req.body;

        const game = await Game.findById(id);
        if (!game || game.status !== "in-progress") {
            return res.status(400).json({ error: "Game not found or already finished" });
        }

        const index = game.board.findIndex(cell => cell.number === number);
        if (index !== -1 && game.board[index].markedBy === null) {
            game.board[index].markedBy = "player";
        }

        const bingoCount = checkBingo(game.board);

        if (bingoCount >= 5) {
            game.status = "finished";
            game.gameResult = "you won!";
            await User.findByIdAndUpdate(game.playerId, { $inc: { coins: 10 } });
        }

        await game.save();
        res.json({ ...game.toObject(), bingoCount });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


module.exports.handlecomputermovepwc = async (req, res) => {
    try {
        const { id } = req.params;

        const game = await Game.findById(id);
        if (!game || game.status !== "in-progress") {
            return res.status(400).json({ error: "Game not found or already finished" });
        }

        const availableCells = game.board.filter(cell => cell.markedBy === null);
        if (availableCells.length > 0) {
            const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
            const index = game.board.findIndex(cell => cell.number === randomCell.number);
            if (index !== -1) {
                game.board[index].markedBy = "computer";
            }
        }

        const bingoCount = checkBingo(game.board);

        if (bingoCount >= 5) {
            game.status = "finished";
            game.gameResult = "Computer won!";
        }

        await game.save();
        res.json({ ...game.toObject(), bingoCount });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



  module.exports.history = async (req, res) => {
    try {
        const { playerId, username } = req.params;

        // Delete unfinished games for Play with Computer for this player
        await Game.deleteMany({ playerId, status: { $ne: "finished" } });

        // Fetch Play with Computer game history
        const computerGames = await Game.find({ playerId, status: "finished" })
            .sort({ createdAt: -1 })
            .lean();

        // Fetch Play with Friends game history
        const friendGames = await Gamef.find({
            "players.username": username,
            status: "finished"
        }).sort({ createdAt: -1 }).lean();

        // Format Computer game history ✅ FIXED HERE
        const formattedComputerGames = computerGames.map(game => ({
            createdAt: game.createdAt,
            opponent: "Computer",
            gameResult: game.gameResult === "you won!" ? "You Won" : "Computer Won",  // ✅ FIXED
            gameType: "Play with Computer"
        }));

        // Format Friends game history
        const formattedFriendGames = friendGames.map(game => {
            const opponent = game.players.find(p => p.username !== username)?.username || "Unknown";
            return {
                createdAt: game.createdAt,
                opponent,
                gameResult: game.winner === username ? "You Won" : `${game.winner} Won`,
                gameType: "Play with Friends"
            };
        });

        const combinedHistory = [...formattedComputerGames, ...formattedFriendGames];

        combinedHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(combinedHistory);
    } catch (error) {
        console.error("Error fetching game history:", error);
        res.status(500).json({ error: error.message });
    }
};