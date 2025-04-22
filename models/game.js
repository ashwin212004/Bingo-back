const mongoose = require("mongoose");

const GameSchema = new mongoose.Schema({
    roomId: { type: String, required: true },
    players: [{ username: String, board: [String] }],
    winner: { type: String, default: null },
    status: { type: String, enum: ["in-progress", "finished", "incomplete"], default: "in-progress" },
    createdAt: { type: Date, default: Date.now }
});

// Middleware to check if game is incomplete when no players are left
GameSchema.pre("save", function (next) {
    if (this.players.length === 0) {
        this.status = "incomplete";
    }
    next();
});

// Method to update game status when a winner is found
GameSchema.methods.completeGame = async function (winnerUsername) {
    this.winner = winnerUsername;
    this.status = "finished";
    await this.save();
};

module.exports = mongoose.model("Gamef", GameSchema);