const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static("public"))

let state = {
  teams: [],
  players: [],
  drafted: [],
  currentPick: 0,
  draftOrder: []
}

let timer = 60
let interval = null

/* ---------- SAFE LOAD ---------- */

function loadDraft(){
  try{
    if(fs.existsSync("draft.json")){
      state = JSON.parse(fs.readFileSync("draft.json"))
    }
  }catch(e){
    console.log("Error loading draft:", e)
  }
}
loadDraft()

function saveDraft(){
  fs.writeFileSync("draft.json", JSON.stringify(state, null, 2))
}

/* ---------- SNAKE ORDER ---------- */

function snakeOrder(teamCount, rounds){
  let order = []

  for(let r=0;r<rounds;r++){
    if(r % 2 === 0){
      for(let i=0;i<teamCount;i++) order.push(i)
    }else{
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

/* ---------- AUTO PICK (SMART) ---------- */

function getBestPlayer(){
  let available = state.players.filter(p => !state.drafted.includes(p.name))

  if(!available.length) return null

  // 🔥 SIMPLE RANKING BASED ON STATS
  available.sort((a,b)=>{
    let aScore = (a.passing_accuracy || a.receptions || a.maximum_speed || 0)
    let bScore = (b.passing_accuracy || b.receptions || b.maximum_speed || 0)
    return bScore - aScore
  })

  return available[0]
}

function autoPick(){
  let pick = getBestPlayer()
  if(!pick) return

  state.drafted.push(pick.name)
  state.currentPick++

  saveDraft()
  io.emit("state", state)
  startTimer()
}

/* ---------- SOCKET ---------- */

io.on("connection", socket => {

  console.log("Client connected ✅")

  socket.emit("state", state)

  socket.on("setup", data => {

    try{
      if(!data || !data.teams || data.teams.length < 2){
        return console.log("Invalid teams ❌")
      }

      state.teams = data.teams

      // 🔥 ROBUST PLAYER PARSER
      if(Array.isArray(data.players)){
        state.players = data.players
      } else if(Array.isArray(data.players.players)){
        state.players = data.players.players
      } else {
        return console.log("Invalid player format ❌")
      }

      state.drafted = []
      state.currentPick = 0
      state.draftOrder = snakeOrder(state.teams.length, 20)

      saveDraft()
      startTimer()

      console.log("Draft started ✅")

      io.emit("state", state)

    }catch(e){
      console.log("SETUP ERROR:", e)
    }
  })

  socket.on("draft", name => {

    if(state.drafted.includes(name)) return

    state.drafted.push(name)
    state.currentPick++

    saveDraft()
    startTimer()

    io.emit("state", state)
  })

  socket.on("undo", () => {

    if(!state.drafted.length) return

    state.drafted.pop()
    state.currentPick--

    saveDraft()
    io.emit("state", state)
  })

  socket.on("pause", () => {
    clearInterval(interval)
  })

})

const PORT = 3000
server.listen(PORT,()=>{
  console.log("Server running on http://localhost:3000 🚀")
})
