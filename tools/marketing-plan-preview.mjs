import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root='//192.168.1.71/nas/projects';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.md':'text/plain; charset=utf-8','.py':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name.includes('..')||name.includes('\\')||!/^\/(DigiStayBook\/(marketing|business-operations)\/|DigiGuestbook\/marketing\/MARKETING_PLAN.html$)/.test(name)){res.writeHead(404).end();return;}
  try{const body=await fs.readFile(root+name);res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(body);}catch{res.writeHead(404).end();}
}).listen(15184,'127.0.0.1',()=>console.log('Actual NAS plan: http://127.0.0.1:15184/DigiStayBook/marketing/MARKETING_PLAN.html'));
