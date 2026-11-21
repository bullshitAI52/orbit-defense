'use strict';
const http=require('node:http');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT)||8795;
const rooms=new Map();
const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/plain; charset=utf-8'});res.end('Orbit Defense match server online\n');});
const wss=new WebSocketServer({server,path:'/match',maxPayload:2048});
function send(ws,payload){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(payload));}
function cleanState(s){if(!s||typeof s!=='object')return null;return{x:limit(s.x,1,46),y:limit(s.y,1,40),a:limit(s.a,-100,100),hp:limit(s.hp,0,100),weapon:Math.floor(limit(s.weapon,0,4)),slide:limit(s.slide,0,.65),slideAngle:limit(s.slideAngle,-100,100),jumpZ:limit(s.jumpZ,0,2),walking:!!s.walking,walkPhase:limit(s.walkPhase,-1e6,1e6),name:typeof s.name==='string'?s.name.slice(0,20):'玩家'};}
function limit(x,min,max){x=Number(x);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):min;}
wss.on('connection',ws=>{
 let roomName='',joined=false,lastState=0;
 ws.on('message',raw=>{let msg;try{msg=JSON.parse(raw);}catch{return;}
 if(msg.type==='join'&&!joined){const code=String(msg.room||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);if(code.length<4){send(ws,{type:'error',message:'房间码至少 4 位'});return;}let room=rooms.get(code);if(!room){room={players:[],maps:[]};rooms.set(code,room);}if(room.players.length>=2){send(ws,{type:'error',message:'房间已满，请换一个房间码'});return;}roomName=code;joined=true;ws.room=room;ws.seat=room.players.length;room.players.push(ws);room.maps.push(Math.floor(limit(msg.mapId,0,100)));send(ws,{type:'waiting',room:code,seat:ws.seat});if(room.players.length===2){const chosen=room.maps[Math.random()<.5?0:1];room.players.forEach((player,seat)=>send(player,{type:'match_start',room:code,seat,mapId:chosen,playerMap:room.maps[seat],opponentMap:room.maps[1-seat]}));}return;}
 const room=ws.room;if(!room||room.players.length!==2)return;const peer=room.players[1-ws.seat];if(msg.type==='state'){const now=Date.now();if(now-lastState<45)return;lastState=now;const state=cleanState(msg.state);if(state)send(peer,{type:'state',state});}else if(msg.type==='hit'){const damage=Math.floor(limit(msg.damage,1,100));send(peer,{type:'hit',damage,weapon:Math.floor(limit(msg.weapon,0,4))});}
 });
 ws.on('close',()=>{if(!joined)return;const room=rooms.get(roomName);if(!room)return;room.players=room.players.filter(p=>p!==ws);room.maps=room.maps.filter((_,i)=>i!==ws.seat);for(const peer of room.players)send(peer,{type:'peer_left'});rooms.delete(roomName);});
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Orbit Defense match server listening on ${PORT}`));
