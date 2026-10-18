import http from 'node:http';
import fs from 'node:fs/promises';
const root='//192.168.1.71/nas/projects/DigiStayBook/business-operations/';
http.createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'DIGISTAYBOOK_TEST_PROCEDURES.html';
  if(name.includes('..')||name.includes('\\')||!(name==='DIGISTAYBOOK_TEST_PROCEDURES.html'||name.startsWith('ai-testing-2026-10-17/'))){res.writeHead(404);res.end();return;}
  try{const body=await fs.readFile(root+name);res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.json')?'application/json':'text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(body);}catch{res.writeHead(404);res.end();}
}).listen(15183,'127.0.0.1',()=>console.log('NAS test document preview http://127.0.0.1:15183'));
