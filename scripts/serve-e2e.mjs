import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(pathname.split('/').some(part=>part.startsWith('.')&&part!=='')){res.writeHead(403);res.end();return}
    let file=path.resolve(root,'.'+pathname);
    if(path.relative(root,file).startsWith('..')||path.isAbsolute(path.relative(root,file))){res.writeHead(403);res.end();return}
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found')}
});
server.listen(48179,'127.0.0.1');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
