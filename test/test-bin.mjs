/* global describe:false */
import { chai } from '@environment-safe/chai';
import { it } from '@open-automaton/moka';
import { intercept } from '@environment-safe/console-intercept'; 
import { scanPackage, rewriteHTML } from '../src/index.mjs';
const should = chai.should();
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as url from 'url';
import * as mod from 'module';
let internalRequire = null;
if(typeof require !== 'undefined') internalRequire = require;
const ensureRequire = ()=> (!internalRequire) && (internalRequire = mod.createRequire(import.meta.url));

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const resolvedDepsJSONString = `{
        "imports": {
                "@environment-safe/chai": "/node_modules/@environment-safe/chai/src/index.mjs",
                "@environment-safe/console-intercept": "/node_modules/@environment-safe/console-intercept/index.js",
                "@environment-safe/package": "/node_modules/@environment-safe/package/index.js",
                "@open-automaton/moka": "/node_modules/@open-automaton/moka/index.js",
                "es6-template-strings": "/node_modules/es6-template-strings/index.js",
                "yargs": "/node_modules/yargs/index.mjs"`;

const executeCommand = async (command)=>{
    return new Promise((resolve, reject)=>{
        const cmd = command.shift();
        const ls = spawn(cmd, command);
        
        let err = null;
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
                    "./bin/wing-kong.mjs", 
                    "-i", 
                    "./test/demo/test.json", 
                    "generate", 
                    "dependencies"
                ]);
                try{
                    should.exist(result);
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
               ensureRequire();
                const html = await rewriteHTML(
                    path.join(__dirname, 'test.html'), 
                    internalRequire.resolve('../package.json')
                );
                html.should.contain(resolvedDepsJSONString);
            }catch(ex){
                console.log(ex);
                should.not.exist(ex);
            }
        });
        
        
    });
});
