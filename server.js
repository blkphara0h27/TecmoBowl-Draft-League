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
let teamsData = []

const SAVE_PATH = "/data/draft.json"

/* ---------- LOAD DATA ---------- */

function loadData(){
  try{
    const raw = fs.readFileSync(__dirname + "/public/players.json")
    const data = JSON.parse(raw)

    players = data.players || data
    teamsData = data.teams || []

    console.log("Players:", players.length)
    console.log("Teams:", teamsData.length)

  }catch(e){
    console.error("PLAYERS LOAD ERROR", e)
  }
}

loadData()

/* ---------- LOAD DRAFT ---------- */

function loadDraft(){
  try{
    if(fs.existsSync(SAVE_PATH)){
      const data = JSON.parse(fs.readFileSync(SAVE_PATH))

      teams = data.teams || []
      drafted = data.drafted || []
      currentPick = data.currentPick || 0
      draftOrder = data.draftOrder || []

      console.log("Draft restored ✅")
    }
  }catch(e){
    console.error("LOAD ERROR", e)
  }
}

loadDraft()

/* ---------- SAVE ---------- */

function saveDraft(){
  try{
    fs.writeFileSync(SAVE_PATH, JSON.stringify({
      teams,
      drafted,
      currentPick,
      draftOrder
    }, null, 2))

    console.log("Saved ✅")
  }catch(e){
    console.error("SAVE ERROR", e)
  }
}

/* ---------- SNAKE ---------- */

function snakeOrder(teamCount, rounds){
  let order=[]

  for(let r=0;r<rounds;r++){
    if(r%2===0){
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

/* ---------- AUTO PICK ---------- */

function autoPick(){
  let available = players.filter(p => !drafted.includes(p.name))
  if(!available.length) return

  drafted.push(available[0].name)
  currentPick++

  saveDraft()

  io.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})

  startTimer()
}

/* ---------- SOCKET ---------- */

io.on("connection", socket => {

  console.log("Client connected")

  socket.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})

  socket.on("setup", data => {

    console.log("SETUP:", data)

    if(!data || !data.teams || data.teams.length < 2){
      console.log("Invalid teams input")
      return
    }

    teams = data.teams

    drafted = []
    currentPick = 0
    draftOrder = snakeOrder(teams.length, 20)

    saveDraft()
    startTimer()

    io.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})
  })

  socket.on("draft", name => {

    if(drafted.includes(name)) return

    drafted.push(name)
    currentPick++

    saveDraft()
    startTimer()

    io.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})
  })

  socket.on("undo", () => {

    if(!drafted.length) return

    drafted.pop()
    currentPick--

    saveDraft()

    io.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})
  })

  socket.on("pause", () => clearInterval(interval))

})

const PORT = process.env.PORT || 3000

server.listen(PORT,()=>{
  console.log("Server running 🚀")
})
