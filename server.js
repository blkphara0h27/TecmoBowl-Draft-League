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

/* ---------- LOAD SAVE ---------- */

function loadDraft(){
  try{
    if(fs.existsSync("draft.json")){
      let data = JSON.parse(fs.readFileSync("draft.json"))
      teams = data.teams || []
      players = data.players || []
      drafted = data.drafted || []
      currentPick = data.currentPick || 0
      draftOrder = data.draftOrder || []
    }
  }catch(e){
    console.log("Load error:", e)
  }
}
loadDraft()

function saveDraft(){
  fs.writeFileSync("draft.json", JSON.stringify({
    teams, players, drafted, currentPick, draftOrder
  }, null, 2))
}

/* ---------- SNAKE ---------- */

function snakeOrder(teamCount, rounds){
  let order = []

  for(let r=0;r<rounds;r++){
    if(r % 2 === 0){
      for(let i=0;i<teamCount;i++) order.push(i)
    } else {
      for(let i=teamCount-1;i>=0;i--) order.push(i)
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
  },1000)
}

/* ---------- AUTO PICK ---------- */

function autoPick(){
  let available = players.filter(p => !drafted.includes(p.name))
  if(!available.length) return

  let pick = available[0]

  drafted.push(pick.name)
  currentPick++

  saveDraft()
  io.emit("state",{teams,players,drafted,currentPick,draftOrder})

  startTimer()
}

/* ---------- SOCKET ---------- */

io.on("connection", socket => {

  console.log("Client connected")

  // ✅ Always send current state on reload
  socket.emit("state",{teams,players,drafted,currentPick,draftOrder})

  socket.on("setup", data => {

    if(!data || !data.teams){
      console.log("Invalid setup ❌")
      return
    }

    teams = data.teams

    // ✅ FIX: ensure correct player format
    if(Array.isArray(data.players)){
      players = data.players
    } else {
      console.log("Players format invalid ❌")
      return
    }

    drafted = []
    currentPick = 0
    draftOrder = snakeOrder(teams.length, 20)

    saveDraft()
    startTimer()

    io.emit("state",{teams,players,drafted,currentPick,draftOrder})
  })

  socket.on("draft", name => {

    if(drafted.includes(name)) return

    drafted.push(name)
    currentPick++

    saveDraft()
    startTimer()

    io.emit("state",{teams,players,drafted,currentPick,draftOrder})
  })

  socket.on("undo", () => {

    if(!drafted.length) return

    drafted.pop()
    currentPick--

    saveDraft()

    io.emit("state",{teams,players,drafted,currentPick,draftOrder})
  })

  socket.on("pause", () => {
    clearInterval(interval)
  })

})

/* ---------- START ---------- */

server.listen(3000,()=>{
  console.log("Server running http://localhost:3000 🚀")
})
