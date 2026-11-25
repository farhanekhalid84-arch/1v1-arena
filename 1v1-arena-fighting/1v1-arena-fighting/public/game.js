const socket = io();
const $ = id => document.getElementById(id);
let roomCode = null, myId = null, roomState = null;
const keys = { left:false,right:false,jump:false,attack:false,kick:false,block:false,special:false };
const canvas = $("stage"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

function notice(msg, error=false){ $("notice").textContent=msg; $("notice").classList.toggle("error",error); }
function enterGame(code){ roomCode=code; $("roomLabel").textContent=code; $("lobby").classList.add("hidden"); $("game").classList.remove("hidden"); }
$("createBtn").onclick=()=>socket.emit("createRoom",{name:$("createName").value.trim()||"Player 1"},res=>{if(!res.ok)return notice(res.error,true);myId=res.playerId;enterGame(res.code);notice("Room created! Share the code with your friend.");});
$("joinBtn").onclick=()=>socket.emit("joinRoom",{name:$("joinName").value.trim()||"Player 2",code:$("roomCode").value},res=>{if(!res.ok)return notice(res.error,true);myId=res.playerId;enterGame(res.code);});
$("copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copyBtn").textContent="COPIED!";setTimeout(()=>$("copyBtn").textContent="COPY",1300)}catch(e){$("copyBtn").textContent=roomCode}};
$("readyBtn").onclick=()=>socket.emit("ready");
$("leaveBtn").onclick=()=>location.reload();

socket.on("state",state=>{
  roomState=state;
  const ps=state.players;
  if(ps[0]){$("name0").textContent=ps[0].name;$("hp0").style.width=ps[0].hp+"%";$("en0").style.width=ps[0].energy+"%";}
  if(ps[1]){$("name1").textContent=ps[1].name;$("hp1").style.width=ps[1].hp+"%";$("en1").style.width=ps[1].energy+"%";}
  $("round").textContent=String(state.round).padStart(2,"0");
  $("fightMessage").textContent=state.status==="playing"?"":state.message;
  $("readyBtn").disabled=state.players.length!==2||state.status==="playing";
  $("readyBtn").textContent=state.status==="playing"?"FIGHT IN PROGRESS":state.players.length!==2?"WAITING FOR FRIEND...":"I'M READY — FIGHT!";
});

function setKey(k,v){keys[k]=v}
document.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  const map={"a":"left","d":"right","w":"jump","j":"attack","k":"kick","l":"block","u":"special",
  "arrowleft":"left","arrowright":"right","arrowup":"jump","1":"attack","2":"kick","3":"block","4":"special"};
  if(map[k]){e.preventDefault();setKey(map[k],true)}
});
document.addEventListener("keyup",e=>{
  const k=e.key.toLowerCase();
  const map={"a":"left","d":"right","w":"jump","j":"attack","k":"kick","l":"block","u":"special",
  "arrowleft":"left","arrowright":"right","arrowup":"jump","1":"attack","2":"kick","3":"block","4":"special"};
  if(map[k]){e.preventDefault();setKey(map[k],false)}
});
document.querySelectorAll(".mobile-controls button").forEach(btn=>{
  const k=btn.dataset.key;
  btn.addEventListener("pointerdown",e=>{e.preventDefault();setKey(k,true)});
  ["pointerup","pointerleave","pointercancel"].forEach(ev=>btn.addEventListener(ev,()=>setKey(k,false)));
});
setInterval(()=>{if(roomCode&&roomState?.status==="playing")socket.emit("input",keys);},45);

function fighter(p,index){
  const x=p.x, ground=410-p.y*1.1, dir=p.facing;
  const main=index===0?"#a66bff":"#25dce8", dark=index===0?"#5532a0":"#126d85";
  ctx.save();ctx.translate(x,ground);ctx.scale(dir,1);
  // shadow
  ctx.fillStyle="#05051099";ctx.beginPath();ctx.ellipse(0,5,47,10,0,0,Math.PI*2);ctx.fill();
  const punch=p.action==="punch", kick=p.action==="kick", special=p.action==="special", block=p.action==="block";
  // legs
  ctx.strokeStyle=dark;ctx.lineWidth=17;ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(-10,-62);ctx.lineTo(kick?40: -18,-12);ctx.stroke();
  ctx.beginPath();ctx.moveTo(12,-62);ctx.lineTo(kick?54:20,-12);ctx.stroke();
  ctx.fillStyle="#111326";ctx.fillRect(-32,-17,28,9);ctx.fillRect(10,-17,28,9);
  // torso
  ctx.fillStyle=main;ctx.shadowColor=main;ctx.shadowBlur=14;
  ctx.beginPath();ctx.roundRect(-24,-112,49,57,12);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle=dark;ctx.fillRect(-19,-102,39,8);
  // head
  ctx.fillStyle="#f1c5a7";ctx.beginPath();ctx.arc(0,-132,22,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#211b37";ctx.beginPath();ctx.arc(-3,-139,22,Math.PI,Math.PI*2);ctx.fill();
  ctx.fillStyle="#fff";ctx.fillRect(8,-135,7,4);
  // arms
  ctx.strokeStyle="#f1c5a7";ctx.lineWidth=13;
  ctx.beginPath();ctx.moveTo(-17,-103);ctx.lineTo(block?2: -30,-78);ctx.stroke();
  ctx.beginPath();ctx.moveTo(18,-102);ctx.lineTo(punch||special? (special?100:65):block?38:35,-88);ctx.stroke();
  ctx.fillStyle=main;ctx.beginPath();ctx.arc(punch||special? (special?100:65):35,-88,11,0,Math.PI*2);ctx.fill();
  if(special){ctx.shadowColor=main;ctx.shadowBlur=30;ctx.fillStyle=main;ctx.beginPath();ctx.arc(105,-90,25,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,W,H);
  // skyline
  for(let i=0;i<15;i++){let x=i*75;let h=75+(i*37%105);ctx.fillStyle=i%2?"#242448":"#1c1d3b";ctx.fillRect(x,205-h,52,h);ctx.fillStyle="#8b69d455";for(let j=0;j<3;j++)ctx.fillRect(x+9+j*13,220-h,5,8);}
  // floor grid
  ctx.strokeStyle="#a77cff35";ctx.lineWidth=1;
  for(let i=0;i<13;i++){ctx.beginPath();ctx.moveTo(0,420+i*10);ctx.lineTo(W,420+i*10);ctx.stroke();}
  for(let i=0;i<21;i++){ctx.beginPath();ctx.moveTo(500,410);ctx.lineTo(i*55-50,520);ctx.stroke();}
  // center light
  ctx.fillStyle="#9c5cff18";ctx.fillRect(493,180,14,230);
  if(roomState?.players){roomState.players.forEach((p,i)=>fighter(p,i));}
  requestAnimationFrame(draw);
}
draw();