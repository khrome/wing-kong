const should = require('chai').should();
const interceptStdOut = require("intercept-stdout");
const { spawn } = require('node:child_process');
const { rewriteHTML } = require('../wing-kong.js');
const path = require('path');

const resolvedDepsJSONString = `{
            "imports": {
                "es6-template-strings": "/node_modules/es6-template-strings/index.js",
                "yargs": "/node_modules/yargs/index.mjs"
            }
        }`;

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
            let data = null;
            try{
                const result = await executeCommand([
                    "./bin/wing-kong", 
                    "-i", 
                    "./test/demo/test.json", 
                    "generate", 
                    "dependencies"
                ]);
                try{
                    data = JSON.parse(result);
                }catch(ex){
                    should.not.exist(ex, 'could not parse the returned JSON');
                }
            }catch(ex){
                console.log(ex);
                should.not.exist(ex);
            }
            should.exist(data['es6-template-strings']);
            data['es6-template-strings'].should.equal("https:/unpkg.com/es6-template-strings/index.js");
            should.exist(data['yargs']);
            data['yargs'].should.equal("https:/unpkg.com/yargs/index.mjs");
        });
        
        it('substitutes in html', async ()=>{
            try{
                const html = await rewriteHTML(
                    path.join(__dirname, 'test.html'), 
                    require.resolve('../package.json')
                );
                html.should.contain(resolvedDepsJSONString);
            }catch(ex){
                console.log(ex);
                should.not.exist(ex);
            }
        });
    });
});
