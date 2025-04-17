#!/usr/bin/env node

//import * as yargs from 'yargs/yargs';
import * as fs from 'node:fs';
import * as mod from 'node:module';
import * as path from 'node:path';
import { hideBin } from 'yargs/helpers';
import { getPackage } from '@environment-safe/package';
import { ImportExport } from '../src/index.mjs';
let internalRequire = null;
if(typeof require !== 'undefined') internalRequire = require;
const ensureRequire = ()=> (!internalRequire) && (internalRequire = mod.createRequire(import.meta.url));
ensureRequire();
const yargs = internalRequire( 'yargs/yargs');
import { Logger, makeConsoleChannel } from '@environment-safe/logger';

(async ()=>{
    const packageData = await getPackage();
    let config = {};
    try{
        config = JSON.parse(fs.readFileSync('.import-config.json'));
    }catch(ex){
        console.log(ex);
    }
    const logger = new Logger({level: Logger.INFO});
    const wingKong = new ImportExport({ logger });
    logger.registerChannel(makeConsoleChannel(console));
    yargs(hideBin(process.argv))
        .command('generate [mode]', 'create new importmap', (yargs) => {
            return yargs.positional('mode', {
                describe: 'generate modes',
                default: 'dependencies'
            })
        }, async (argv) => {
            ensureRequire();
            const parts = argv.mode.split('+');
            const rootJSONLocation = internalRequire.resolve(path.join(process.cwd(), 'package.json'));
            const importMap = await wingKong.createImportMapForPackage(rootJSONLocation, parts, argv.i, config);
            const sortedKeys = Object.keys(importMap).sort();
            const sortedObj = {};
            for(let lcv=0; lcv < sortedKeys.length; lcv++){
                sortedObj[sortedKeys[lcv]] = importMap[sortedKeys[lcv]];
            }
            const result = JSON.stringify(sortedObj, null, '    ');
            if(argv.f){
              fs.writeFile(argv.f, result, {}, ()=>{
                  console.log(`File "${argv.f}" written.`);
              });
            }else{
                console.log(result);
            }
        })
        .command('rewrite [mode] [file]', 'rewrite importmap script tag', (yargs) => {
            return yargs.positional('mode', {
                describe: 'generate modes',
                default: 'dependencies'
            }).positional('file', {
                describe: 'file to rewrite',
                default: 'package.json'
            });
        }, async (argv) => {
            const rootJSONLocation = internalRequire.resolve(path.join(process.cwd(), 'package.json'));
            const fullPath = (
                argv.file[0] === '/' ||
                argv.file.indexOf('://') !== -1
            )?argv.file:path.join(process.cwd(), argv.file)
            const result = await wingKong.rewriteHTML(fullPath, rootJSONLocation, true);
        })
        .option('file', {
            alias: 'f',
            type: 'string',
            description: 'output to file'
        })
        .option('imports', {
          alias: 'i',
          type: 'string',
          description: 'import endpoint map'
        })
        .help('help')
        .parse();
})();