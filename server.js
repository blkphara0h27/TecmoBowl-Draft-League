const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const PORT = process.env.PORT || 3000

app.use(express.static("."))

// ----------------------------
// LOAD SAVED DRAFT STATE
// ----------------------------
let state = {
  teams: [],
  players: [],
  drafted: [],
  draftOrder: [],
  started: false
}

if (fs.existsSync("draft_state.json")) {
  state = JSON.parse(fs.readFileSync("draft_state.json"))
}

// ----------------------------
// SAVE FUNCTION
// ----------------------------
function saveState() {
  fs.writeFileSync("draft_state.json", JSON.stringify(state, null, 2))
}

// ----------------------------
// CREATE SNAKE DRAFT ORDER
// ----------------------------
function createDraftOrder(teamCount, rounds) {
  let order = []

  for (let r = 0; r < rounds; r++) {
    let round = [...Array(teamCount).keys()]

    if (r % 2 === 1) {
      round.reverse()
    }

    order.push(...round)
  }

  return order
}

// ----------------------------
// SOCKET CONNECTION
// ----------------------------
io.on("connection", socket => {

  // Send current draft state
  socket.emit("state", state)

  // ------------------------
  // SETUP DRAFT
  // ------------------------
  socket.on("setup", data => {

    state.teams = data.teams
    state.players = data.players
    state.drafted = []

    const rounds = 20
    state.draftOrder = createDraftOrder(state.teams.length, rounds)

    saveState()

    io.emit("state", state)
  })

  // ------------------------
  // DRAFT PICK
  // ------------------------
  socket.on("draft", name => {

    if (!state.players) return

    state.drafted.push(name)

    saveState()

    io.emit("state", state)
  })

  // ------------------------
  // UNDO PICK
  // ------------------------
  socket.on("undo", () => {

    state.drafted.pop()

    saveState()

    io.emit("state", state)
  })

  // ------------------------
  // PAUSE TIMER
  // ------------------------
  socket.on("pause", () => {
    io.emit("timer", 0)
  })

})

// ----------------------------
// SERVER START
// ----------------------------
server.listen(PORT, () => {
  console.log("Server running on port " + PORT)
})
