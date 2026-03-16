const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static("public"))

let teams=[]
let players=[]
let drafted=[]
let currentPick=0
let draftOrder=[]
let timer=60
let interval=null

/* -------------------------
   SNAKE DRAFT ORDER
-------------------------- */

function snakeOrder(teamCount, rounds){

let order=[]

for(let r=0;r<rounds;r++){

if(r % 2 === 0){

for(let i=0;i<teamCount;i++){
order.push(i)
}

}else{

for(let i=teamCount-1;i>=0;i--){
order.push(i)
}

}

}

return order

}

/* -------------------------
   TIMER
-------------------------- */

function startTimer(){

clearInterval(interval)

timer = 60

interval = setInterval(()=>{

timer--

io.emit("timer",timer)

if(timer <= 0){
autoPick()
}

},1000)

}

/* -------------------------
   AUTO PICK
-------------------------- */

function autoPick(){

let available = players.filter(p=>!drafted.includes(p.name))

if(available.length===0) return

let pick = available[0]

drafted.push(pick.name)

currentPick++

saveDraft()

startTimer()

io.emit("state",{teams,players,drafted,currentPick,draftOrder})

}

/* -------------------------
   SAVE DRAFT
-------------------------- */

function saveDraft(){

let data = {
teams,
players,
drafted,
currentPick,
draftOrder
}

fs.writeFileSync("draft.json", JSON.stringify(data,null,2))

}

/* -------------------------
   LOAD DRAFT
-------------------------- */

function loadDraft(){

if(fs.existsSync("draft.json")){

let data = JSON.parse(fs.readFileSync("draft.json"))

teams = data.teams || []
players = data.players || []
drafted = data.drafted || []
currentPick = data.currentPick || 0
draftOrder = data.draftOrder || []

}

}

/* -------------------------
   SOCKET CONNECTION
-------------------------- */

io.on("connection",socket=>{

socket.emit("state",{teams,players,drafted,currentPick,draftOrder})

/* START DRAFT */

socket.on("setup",data=>{

teams = data.teams
players = data.players

drafted = []
currentPick = 0

draftOrder = snakeOrder(teams.length,20)

saveDraft()

startTimer()

io.emit("state",{teams,players,drafted,currentPick,draftOrder})

})

/* DRAFT PLAYER */

socket.on("draft",player=>{

if(drafted.includes(player)) return

drafted.push(player)

currentPick++

saveDraft()

startTimer()

io.emit("state",{teams,players,drafted,currentPick,draftOrder})

})

/* UNDO PICK */

socket.on("undo",()=>{

if(drafted.length===0) return

drafted.pop()

currentPick--

saveDraft()

startTimer()

io.emit("state",{teams,players,drafted,currentPick,draftOrder})

})

/* PAUSE DRAFT */

socket.on("pause",()=>{

clearInterval(interval)

})

})

/* -------------------------
   LOAD SAVED DRAFT
-------------------------- */

loadDraft()

/* -------------------------
   START SERVER
-------------------------- */

const PORT = process.env.PORT || 3000

server.listen(PORT, ()=>{
console.log("Snake Draft Server Running")
})

})
