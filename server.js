const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Serve public folder
app.use(express.static(path.join(__dirname, "public")))

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

/* -------------------------
   LOAD / SAVE DRAFT STATE
--------------------------*/

let state = {
  teams: [],
  players: [],
  drafted: [],
  draftOrder: []
}

function saveState() {
  fs.writeFileSync("draft_state.json", JSON.stringify(state, null, 2))
}

function loadState() {
  if (fs.existsSync("draft_state.json")) {
    state = JSON.parse(fs.readFileSync("draft_state.json"))
    console.log("Draft state loaded")
  }
}

loadState()

/* -------------------------
   BUILD SNAKE DRAFT ORDER
--------------------------*/

function buildDraftOrder(teams, rounds = 20) {

  let order = []

  for (let r = 0; r < rounds; r++) {

    let round = [...Array(teams.length).keys()]

    if (r % 2 === 1) {
      round.reverse()
    }

    order = order.concat(round)

  }

  return order
}

/* -------------------------
   SOCKET.IO
--------------------------*/

io.on("connection", socket => {

  console.log("User connected")

  socket.emit("state", state)

  /* Setup Draft */
  socket.on("setup", data => {

    state.teams = data.teams
    state.players = data.players
    state.drafted = []
    state.draftOrder = buildDraftOrder(data.teams)

    saveState()

    io.emit("state", state)

  })

  /* Draft Player */
  socket.on("draft", player => {

    if (state.drafted.includes(player)) return

    state.drafted.push(player)

    saveState()

    io.emit("state", state)

  })

  /* Undo Pick */
  socket.on("undo", () => {

    state.drafted.pop()

    saveState()

    io.emit("state", state)

  })

  /* Pause Timer */
  socket.on("pause", () => {
    io.emit("timer", 0)
  })

})

/* -------------------------
   START SERVER
--------------------------*/

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log("Server running on port " + PORT)
})
