
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Serve static files from /public
app.use(express.static("public"))

/* ---------- STATE ---------- */

let teams = []
let nflTeams = []
let players = []
let drafted = []

let currentPick = 0
let draftOrder = []

let timer = 60
let interval = null

/* ---------- SNAKE ORDER ---------- */

function snakeOrder(teamCount, rounds) {
  let order = []

  for (let r = 0; r < rounds; r++) {
    if (r % 2 === 0) {
      for (let i = 0; i < teamCount; i++) order.push(i)
    } else {
      for (let i = teamCount - 1; i >= 0; i--) order.push(i)
    }
  }

  return order
}

/* ---------- TIMER ---------- */

function startTimer() {
  if (interval) clearInterval(interval)

  timer = 60

  interval = setInterval(() => {
    timer--
    io.emit("timer", timer)

    if (timer <= 0) {
      autoPick()
    }
  }, 1000)
}

/* ---------- AUTO PICK ---------- */

function autoPick() {
  let available = players.filter(p => !drafted.includes(p.name))

  if (!available.length) {
    console.log("No players left for auto pick")
    return
  }

  let pick = available[0]

  console.log("Auto picking:", pick.name)

  drafted.push(pick.name)
  currentPick++

  emitState()
  startTimer()
}

/* ---------- EMIT STATE ---------- */

function emitState() {
  io.emit("state", {
    teams,
    nflTeams,
    players,
    drafted,
    currentPick,
    draftOrder
  })
}

/* ---------- SOCKET ---------- */

io.on("connection", socket => {
  console.log("✅ Client connected")

  emitState()

  socket.on("setup", data => {
    if (!data) return

    teams = data.teams || []
    nflTeams = data.nflTeams || []
    players = data.players || []

    drafted = []
    currentPick = 0

    draftOrder = snakeOrder(teams.length, 20)

    console.log("Teams:", teams)
    console.log("Players loaded:", players.length)

    startTimer()
    emitState()
  })

  socket.on("loadState", data => {
    if (!data) return

    try {
      teams = data.teams || []
      nflTeams = data.nflTeams || []
      players = data.players || []
      drafted = data.drafted || []
      currentPick = data.currentPick || 0
      draftOrder = data.draftOrder || []

      startTimer()
      emitState()
    } catch (err) {
      console.log("Error loading state:", err)
    }
  })

  socket.on("draft", name => {
    if (!name) return
    if (drafted.includes(name)) return

    drafted.push(name)
    currentPick++

    startTimer()
    emitState()
  })

  socket.on("undo", () => {
    if (!drafted.length) return

    drafted.pop()
    currentPick--

    emitState()
  })

  socket.on("pause", () => {
    clearInterval(interval)
    interval = null
  })
})

/* ---------- START SERVER ---------- */

// ✅ REQUIRED FOR RENDER
const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT)
})

