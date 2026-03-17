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

/* LOAD DATA */

function loadData(){
  if(fs.existsSync("players.json")){
    const data = JSON.parse(fs.readFileSync("players.json"))
    players = data.players || data
    teamsData = data.teams || []
  }
}
loadData()

/* LOAD DRAFT */

function loadDraft(){
  if(fs.existsSync("/tmp/draft.json")){
    let data = JSON.parse(fs.readFileSync("/tmp/draft.json"))
    teams = data.teams || []
    drafted = data.drafted || []
    currentPick = data.currentPick || 0
    draftOrder = data.draftOrder || []
  }
}
loadDraft()

/* SAVE */

function saveDraft(){
  let data = {teams,drafted,currentPick,draftOrder}
  fs.writeFileSync("/tmp/draft.json", JSON.stringify(data,null,2))
}

/* SNAKE */

function snakeOrder(teamCount, rounds){
  let order=[]
  for(let r=0;r<rounds;r++){
    if(r%2===0){
      for(let i=0;i<teamCount;i++) order.push(i)
    } else {
      for(let i=teamCount-1;i>=0;i--) order.push(i)
    }
  }
  return order
}

/* TIMER */

function startTimer(){
  clearInterval(interval)
  timer=60

  interval=setInterval(()=>{
    timer--
    io.emit("timer",timer)
    if(timer<=0) autoPick()
  },1000)
}

/* AUTO */

function autoPick(){
  let available = players.filter(p=>!drafted.includes(p.name))
  if(available.length===0) return

  let pick = available[0]
  drafted.push(pick.name)
  currentPick++

  saveDraft()

  io.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})

  startTimer()
}

/* SOCKET */

io.on("connection",socket=>{

  socket.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})

  socket.on("setup",data=>{
    teams = data.teams

    drafted=[]
    currentPick=0
    draftOrder=snakeOrder(teams.length,20)

    saveDraft()
    startTimer()

    io.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})
  })

  socket.on("draft",player=>{
    if(drafted.includes(player)) return

    drafted.push(player)
    currentPick++

    saveDraft()
    startTimer()

    io.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})
  })

  socket.on("undo",()=>{
    drafted.pop()
    currentPick--

    saveDraft()

    io.emit("state",{teams,players,drafted,currentPick,draftOrder,teamsData})
  })

  socket.on("pause",()=>{
    clearInterval(interval)
  })

})

const PORT = process.env.PORT || 3000
server.listen(PORT,()=>console.log("Server running"))
