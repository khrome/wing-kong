const should = require('chai').should();
const interceptStdOut = require("intercept-stdout");
const { spawn } = require('node:child_process');

const executeCommand = async (command)=>{
    return new Promise((resolve, reject)=>{
        const cmd = command.shift();
        const ls = spawn(cmd, command);
        
        const err = null;
        let result = '';
        
        ls.stdout.on('data', (data) => {
            result += data
        });
        
        ls.stderr.on('data', (data) => {
            if(!err) err = data;
            else err += data;
        });
        
        ls.on('close', (code) => {
            if(code === 0){
                resolve(result);
            }else{
                const error = new Error(err);
                error.code = code;
                reject(error);
            }
        }); 
    });
}

describe('wing-kong', ()=>{
   describe('performs a simple test suite', ()=>{
        it('works as expected', async ()=>{
            try{
                const result = await executeCommand([
                    "./bin/wing-kong", 
                    "-i", 
                    "./test/demo/test.json", 
                    "generate", 
                    "dependencies"
                ]);
                let data = null;
                try{
                    data = JSON.parse(result);
                }catch(ex){
                    should.not.exist(ex, 'could not parse the returned JSON');
                }
                should.exist(data['es6-template-strings']);
                data['es6-template-strings'].should.equal("https:/unpkg.com/es6-template-strings/index.js");
                should.exist(data['yargs']);
                data['yargs'].should.equal("https:/unpkg.com/yargs/index.mjs");
            }catch(ex){
                should.not.exist(ex);
            }
        });
    });
});
