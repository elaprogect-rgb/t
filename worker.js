const BLACKLIST=["nigg","nigr","fagg","retard","chink","kike","tranny","wetback","gook","beaner","cunt","whore","slut","rapist","nazi","hitler","kkk","bitch","fuck","shit","pussy","asshole","porn"];
const LEET={0:"o",1:"i",3:"e",4:"a",5:"s",7:"t","@":"a","$":"s","!":"i"};
const norm=s=>s.toLowerCase().replace(/[013457@$!]/g,c=>LEET[c]||"").replace(/[^a-z]/g,"").replace(/(.)\1+/g,"$1");
const rawNorm=s=>s.toLowerCase().replace(/[01347@$!]/g,c=>LEET[c]||"").replace(/[^a-z0-9]/g,"");
const badName=n=>{const a=norm(n),b=rawNorm(n);return BLACKLIST.some(w=>b.includes(w)||(norm(w).length>3&&a.includes(norm(w))))};
const MAX_REVIEWS=500;

export default {
async fetch(req,env){
const origin=env.ALLOWED_ORIGIN||"*";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
const out=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,"Content-Type":"application/json"}});
if(req.method==="OPTIONS")return new Response(null,{headers:cors});
if(req.method!=="POST")return out({error:"Method not allowed"},405);
let b;
try{b=await req.json()}catch{return out({error:"Bad request"},400)}
const id=String(b.id||"").slice(0,64);
const name=String(b.name||"").trim().replace(/\s+/g," ");
const note=String(b.note||"").trim();
const rating=Number(b.rating);
if(!/^[\w-]{8,64}$/.test(id))return out({error:"Bad id"},400);
if(name.length<2||name.length>30)return out({error:"Invalid name"},400);
if(badName(name))return out({error:"That name isn't allowed."},400);
if(!Number.isInteger(rating)||rating<1||rating>5)return out({error:"Invalid rating"},400);
if(note.length>1000)return out({error:"Note is over 1000 characters."},400);

const api="https://api.github.com/repos/"+env.REPO+"/contents/"+env.FILE;
const gh={Authorization:"Bearer "+env.GH_TOKEN,"User-Agent":"ela-progect-worker",Accept:"application/vnd.github+json"};
for(let attempt=0;attempt<3;attempt++){
const cur=await fetch(api+"?ref="+env.BRANCH,{headers:gh});
let list=[],sha;
if(cur.ok){
const j=await cur.json();
sha=j.sha;
try{list=JSON.parse(atob(j.content.replace(/\n/g,"")));if(!Array.isArray(list))list=[]}catch{list=[]}
}else if(cur.status!==404)return out({error:"Storage unavailable"},502);
const old=list.find(r=>r.id===id);
const entry={id,name,rating,note,t:Date.now()};
list=[entry,...list.filter(r=>r.id!==id)].slice(0,MAX_REVIEWS);
const body=JSON.stringify({
message:(old?"Update":"Add")+" review",
content:btoa(unescape(encodeURIComponent(JSON.stringify(list,null,1)))),
branch:env.BRANCH,
...(sha?{sha}:{})
});
const put=await fetch(api,{method:"PUT",headers:gh,body});
if(put.ok){
await fetch("https://purge.jsdelivr.net/gh/"+env.REPO+"@"+env.BRANCH+"/"+env.FILE).catch(()=>{});
return out({ok:true});
}
if(put.status!==409&&put.status!==422)return out({error:"Could not save your review."},502);
}
return out({error:"Busy, try again."},503);
}
};
