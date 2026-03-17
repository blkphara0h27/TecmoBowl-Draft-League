const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static("public"))

let teams = []
let players = []
let drafted = []
let currentPick = 0
let draftOrder = []
let timer = 60
let interval = null

/* ---------- SAVE ---------- */

function saveDraft(){
  let data = { teams, players, drafted, currentPick, draftOrder }
  fs.writeFileSync("draft.json", JSON.stringify(data, null, 2))
}

/* ---------- SNAKE ORDER ---------- */

function snakeOrder(teamCount, rounds){
  let order = []

  for(let r = 0; r < rounds; r++){
    if(r % 2 === 0){
      for(let i = 0; i < teamCount; i++) order.push(i)
    }else{
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
  let available = players.filter(p => !drafted.includes(p.name))
  if(!available.length) return

  let pick = available[0]

  drafted.push(pick.name)
  currentPick++

  saveDraft()

  io.emit("state", { teams, players, drafted, currentPick, draftOrder })

  startTimer()
}

/* ---------- SOCKET ---------- */

io.on("connection", socket => {

  console.log("Client connected")

  socket.emit("state", { teams, players, drafted, currentPick, draftOrder })

  /* ---------- SETUP (FIXED) ---------- */

  socket.on("setup", data => {

    console.log("SETUP RECEIVED")

    if(!data){
      console.log("Invalid setup ❌")
      return
    }

    // ✅ PLAYERS
    if(Array.isArray(data.players)){
      players = data.players
    }else if(data.players && Array.isArray(data.players.players)){
      players = data.players.players
    }else{
      console.log("Players format invalid ❌")
      return
    }

    // ✅ TEAMS (CRITICAL FIX)
    if(Array.isArray(data.teams)){
      teams = data.teams
    }else{
      console.log("Teams missing ❌")
      return
    }

    console.log("Teams loaded:", teams.map(t=>t.name))

    drafted = []
    currentPick = 0

    draftOrder = snakeOrder(teams.length, 20)

    saveDraft()
    startTimer()

    io.emit("state", { teams, players, drafted, currentPick, draftOrder })

  })

  /* ---------- DRAFT ---------- */

  socket.on("draft", name => {

    if(!name) return
    if(drafted.includes(name)) return

    drafted.push(name)
    currentPick++

    saveDraft()
    startTimer()

    io.emit("state", { teams, players, drafted, currentPick, draftOrder })

  })

  /* ---------- UNDO ---------- */

  socket.on("undo", () => {
    if(!drafted.length) return

    drafted.pop()
    currentPick--

    saveDraft()

    io.emit("state", { teams, players, drafted, currentPick, draftOrder })
  })

  /* ---------- PAUSE ---------- */

  socket.on("pause", () => {
    clearInterval(interval)
  })

})

/* ---------- START SERVER ---------- */

const PORT = 3000

server.listen(PORT, () => {
  console.log("Server running on port " + PORT)
})
