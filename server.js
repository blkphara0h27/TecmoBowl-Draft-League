const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Serve frontend
app.use(express.static("public"))

/* ---------- STATE ---------- */

let teams = []        // draft users (Nick, Edric, etc.)
let nflTeams = []     // teams from JSON (Jets, Ravens)
let players = []      // player pool
let drafted = []      // picks (players OR teams)

let currentPick = 0
let draftOrder = []

let timer = 60
let interval = null

/* ---------- SNAKE ORDER ---------- */

function snakeOrder(teamCount, rounds){
  let order = []

  for(let r = 0; r < rounds; r++){
    if(r % 2 === 0){
      for(let i = 0; i < teamCount; i++) order.push(i)
    } else {
      for(let i = teamCount - 1; i >= 0; i--) order.push(i)
    }
  }

  return order
}

/* ---------- TIMER ---------- */

function startTimer(){

  clearInterval(interval)

  timer = 60

  interval = setInterval(()=>{

    timer--
    io.emit("timer", timer)

    if(timer <= 0){
      autoPick()
    }

  }, 1000)
}

/* ---------- AUTO PICK ---------- */

function autoPick(){

  // pick first available player
  let available = players.filter(p => !drafted.includes(p.name))

  if(!available.length) return

  let pick = available[0]

  drafted.push(pick.name)
  currentPick++

  emitState()
  startTimer()
}

/* ---------- EMIT STATE ---------- */

function emitState(){
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

  console.log("Client connected")

  // send current state immediately
  emitState()

  /* ---------- SETUP ---------- */

  socket.on("setup", data => {

    console.log("Setup received")

    if(!data) return

    teams = data.teams || []
    nflTeams = data.nflTeams || []
    players = data.players || []

    drafted = []
    currentPick = 0

    draftOrder = snakeOrder(teams.length, 20)

    startTimer()
    emitState()
  })

  /* ---------- DRAFT ---------- */

  socket.on("draft", name => {

    if(!name) return

    // prevent duplicates (players or teams)
    if(drafted.includes(name)) return

    drafted.push(name)
    currentPick++

    startTimer()
    emitState()
  })

  /* ---------- UNDO ---------- */

  socket.on("undo", () => {

    if(!drafted.length) return

    drafted.pop()
    currentPick--

    emitState()
  })

  /* ---------- PAUSE ---------- */

  socket.on("pause", () => {

    console.log("Draft paused")

    clearInterval(interval)
    interval = null
  })

})

/* ---------- START SERVER ---------- */

const PORT = 3000

server.listen(PORT, () => {
  console.log("Server running on port " + PORT)
})
