const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static("public"))

let teams = []        // draft users
let nflTeams = []     // NFL teams
let players = []
let drafted = []
let currentPick = 0
let draftOrder = []
let timer = 60
let interval = null

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

function autoPick(){
  let available = players.filter(p => !drafted.includes(p.name))
  if(!available.length) return

  drafted.push(available[0].name)
  currentPick++

  io.emit("state", { teams, nflTeams, players, drafted, currentPick, draftOrder })
  startTimer()
}

io.on("connection", socket => {

  socket.emit("state", { teams, nflTeams, players, drafted, currentPick, draftOrder })

  socket.on("setup", data => {

    teams = data.teams || []
    nflTeams = data.nflTeams || []
    players = data.players || []

    drafted = []
    currentPick = 0

    draftOrder = snakeOrder(teams.length, 20)

    startTimer()

    io.emit("state", { teams, nflTeams, players, drafted, currentPick, draftOrder })
  })

  socket.on("draft", name => {

    if(!name) return
    if(drafted.includes(name)) return

    drafted.push(name)
    currentPick++

    startTimer()

    io.emit("state", { teams, nflTeams, players, drafted, currentPick, draftOrder })
  })

  socket.on("undo", () => {
    if(!drafted.length) return
    drafted.pop()
    currentPick--

    io.emit("state", { teams, nflTeams, players, drafted, currentPick, draftOrder })
  })

  socket.on("pause", () => {
    clearInterval(interval)
    interval = null
  })

})

server.listen(3000, () => {
  console.log("Server running on port 3000")
})
